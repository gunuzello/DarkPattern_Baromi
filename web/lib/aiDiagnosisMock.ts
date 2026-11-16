/**
 * Mock AI 정밀 진단 (spec §6: build the screens on mock data until the backend ships).
 * Results are composed from the scan's own report (findings, price lines, review wording),
 * so the mock never shows evidence the base report does not have.
 */
import type { AiDiagnosis, AiEvidence, AiItemResult, AiVerdict } from "./aiDiagnosis";
import { api } from "./api";
import { sampleEvidenceLines } from "./demo";
import { guide } from "./guide";
import type { FindingType, Report } from "./types";
import { reportItems, type ReportItem } from "@/components/report/model";

type Stored = { id: string; startedAt: number; requestedTypes: FindingType[] };
const key = (scanId: string) => `baromi-ai-diagnosis:${scanId}`;
const QUEUE_MS = 2000;
const PER_ITEM_MS = 900;

/** sessionStorage keeps the request across reloads; the in-memory copy covers blocked storage. */
const memory = new Map<string, Stored>();

function read(scanId: string): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(key(scanId));
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* fall back to memory */
  }
  return memory.get(scanId) ?? null;
}

/** Checks whose AI judgement depends on how the screen looks (show the captured screen). */
const visual: FindingType[] = ["PRESELECTION", "MISDIRECTED_HIERARCHY", "DISGUISED_AD", "HIDDEN_INFO", "CONFIRM_SHAMING"];

function evidenceFor(report: Report, item: ReportItem): AiEvidence[] {
  const out: AiEvidence[] = [];
  for (const finding of item.findings) {
    const lines = sampleEvidenceLines[finding.id] ?? report.priceLedger?.stages.find((stage) => stage.stage === finding.stage)?.displayedLines ?? [];
    lines.forEach((text, index) => out.push({ text, evidenceId: finding.evidenceIds?.[index] ?? finding.evidenceIds?.[0], stage: finding.stage }));
  }
  for (const candidate of item.candidates) out.push({ text: `화면 문구 “${candidate.text}”`, evidenceId: candidate.evidenceIds[0] });
  if (!out.length && item.note) out.push({ text: item.note, evidenceId: item.evidenceIds[0] });
  return out;
}

function verdictFor(item: ReportItem): AiVerdict | null {
  if (item.kind === "risk") return "RISK";
  if (item.kind === "review") return "PARTIAL";
  if (item.kind === "clear") return "SAFE";
  return null;
}

function resultFor(report: Report, item: ReportItem): AiItemResult {
  const g = guide[item.type];
  const verdict = verdictFor(item);
  const evidence = evidenceFor(report, item);
  if (!verdict || !evidence.length) {
    return {
      type: item.type, status: "INSUFFICIENT", conclusion: "판단에 필요한 화면이나 문구를 확보하지 못해 분석하지 않았어요.",
      evidence, reasoning: item.note || "기본 점검에서 이 항목에 필요한 화면에 도달하지 못했어요.", recommendations: [],
    };
  }
  const finding = item.findings[0];
  const conclusion = {
    RISK: `${item.summary} 손님이 알아차리기 어려운 방식이라 고쳐야 해요.`,
    PARTIAL: `${item.summary} 표시 자체는 흔하지만 근거가 함께 보이지 않아 일부 개선이 필요해요.`,
    SAFE: `이번에 살펴본 범위에서는 ${g.plain}에 해당하는 표시가 없었어요.`,
  }[verdict];
  const reasoning = {
    RISK: `${g.criteria.replace(/‘[^’]+’로 (판단해요|남겨요)./, "위험으로 볼 수 있어요.")} 수집한 근거가 이 조건에 그대로 맞아요.`,
    PARTIAL: `표시는 확인했지만 이를 뒷받침할 근거가 화면에 없어요. ${g.limit} 그래서 ‘위험’이 아니라 ‘부분적 안전’으로 판단했어요.`,
    SAFE: `기준에 해당하는 신호를 찾지 못했어요. 다만 ${g.limit}`,
  }[verdict];
  const recommendations = verdict === "SAFE"
    ? [{ title: "현재 상태 유지", reason: "문제가 될 만한 표시가 없었어요.", action: "지금처럼 유지하고, 이 화면을 바꿀 때 다시 점검해 보세요." }]
    : g.fixes.map((action) => ({ title: g.plain, reason: item.summary, action }));
  return {
    type: item.type, status: "ANALYZED", verdict, conclusion, evidence, reasoning, recommendations,
    screenshotStage: finding && visual.includes(item.type) ? finding.stage : undefined,
  };
}

async function compose(scanId: string, stored: Stored): Promise<AiDiagnosis> {
  const elapsed = Date.now() - stored.startedAt;
  const total = stored.requestedTypes.length;
  const base = { id: stored.id, scanId, requestedTypes: stored.requestedTypes, createdAt: new Date(stored.startedAt).toISOString(), items: [] };
  if (elapsed < QUEUE_MS) return { ...base, status: "QUEUED", doneCount: 0 };
  const doneCount = Math.min(total, Math.floor((elapsed - QUEUE_MS) / PER_ITEM_MS));
  if (doneCount < total) return { ...base, status: "RUNNING", doneCount };

  const report = await api.getReport(scanId);
  const items = reportItems(report).filter((item) => stored.requestedTypes.includes(item.type)).map((item) => resultFor(report, item));
  const analyzed = items.filter((item) => item.status === "ANALYZED");
  const count = (verdict: AiVerdict) => analyzed.filter((item) => item.verdict === verdict).length;
  const insufficient = items.length - analyzed.length;
  const risky = analyzed.filter((item) => item.verdict === "RISK");
  const partial = analyzed.filter((item) => item.verdict === "PARTIAL");
  return {
    ...base,
    status: "COMPLETED",
    doneCount: total,
    completedAt: new Date(stored.startedAt + QUEUE_MS + total * PER_ITEM_MS).toISOString(),
    summary: {
      overview: `선택한 ${total}개 항목 중 위험 ${count("RISK")}개, 부분적 안전 ${count("PARTIAL")}개, 안전 ${count("SAFE")}개로 판단했어요.${insufficient ? ` ${insufficient}개는 분석 자료가 부족해 판정하지 않았어요.` : ""}`,
      keyRisks: risky.map((item) => `${guide[item.type].plain}: ${item.conclusion.split(". ")[0].replace(/\.$/, "")}`),
      priorities: [...risky, ...partial].slice(0, 3).map((item) => item.recommendations[0]?.action).filter(Boolean) as string[],
    },
    items,
  };
}

export async function getDiagnosis(scanId: string): Promise<AiDiagnosis | null> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const stored = read(scanId);
  return stored ? compose(scanId, stored) : null;
}

export async function requestDiagnosis(scanId: string, types: FindingType[]): Promise<AiDiagnosis> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const stored: Stored = { id: `ai-${Math.random().toString(36).slice(2, 9)}`, startedAt: Date.now(), requestedTypes: types };
  memory.set(scanId, stored);
  try {
    window.sessionStorage.setItem(key(scanId), JSON.stringify(stored));
  } catch {
    /* storage unavailable: the in-memory copy still works for this visit */
  }
  return compose(scanId, stored);
}
