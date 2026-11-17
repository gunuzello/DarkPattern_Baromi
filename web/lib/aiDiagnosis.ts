/**
 * AI 정밀 점검 (user-selected checks, 3-level AI verdict).
 *
 * AI verdict is kept separate from the base engine's RuleStatus.
 */
import type { FindingType, Stage } from "./types";
import { api, aiDiagnosisFetch, usesSample } from "./api";
import * as mock from "./aiDiagnosisMock";

/** AI's three-level verdict. "분석 자료 부족" is NOT a fourth verdict, see AiItemResult.status. */
export type AiVerdict = "RISK" | "PARTIAL" | "SAFE";
export type AiDiagnosisStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type AiEvidence = {
  /** What was actually collected: wording, selection state, price, action log. */
  text: string;
  evidenceId?: string;
  stage?: Stage;
};
export type AiRecommendation = { title: string; reason: string; action: string };

export type AiItemResult = {
  type: FindingType;
  /** FAILED is a provider/job failure; it must not be presented as missing evidence. */
  status: "ANALYZED" | "INSUFFICIENT" | "FAILED";
  verdict?: AiVerdict;
  conclusion: string;
  evidence: AiEvidence[];
  /** Only when the judgement depends on how the screen looks; never a generated image. */
  screenshotStage?: Stage;
  screenshotStages?: Stage[];
  reasoning: string;
  /** What this analysis could not confirm (spec §7.1: stored and shown per item). */
  limitations?: string[];
  recommendations: AiRecommendation[];
};

export type AiDiagnosis = {
  id: string;
  scanId: string;
  status: AiDiagnosisStatus;
  requestedTypes: FindingType[];
  createdAt: string;
  completedAt?: string;
  /** Items finished so far while RUNNING (for the progress view). */
  doneCount?: number;
  error?: string;
  summary?: { overview: string; keyRisks: string[]; priorities: string[] };
  items: AiItemResult[];
};

/**
 * Where AI 정밀 점검 data comes from:
 * - "mock": the sample/demo report, or NEXT_PUBLIC_AI_DIAGNOSIS=mock (for review builds)
 * - "api": use the backend's selected-rule review endpoint
 */
export function aiDiagnosisMode(scanId: string): "mock" | "api" {
  const flag = process.env.NEXT_PUBLIC_AI_DIAGNOSIS;
  if (usesSample(scanId) || flag === "mock") return "mock";
  return "api";
}

export const aiVerdictLabels: Record<AiVerdict, string> = { RISK: "위험", PARTIAL: "부분적 안전", SAFE: "안전" };
export const aiVerdictOrder: AiVerdict[] = ["RISK", "PARTIAL", "SAFE"];

const apiRequest = aiDiagnosisFetch;

/** AI 종합 의견 in the same words as the verdicts (spec §8.4: main risks, what to fix first). */
export function summarize(items: AiItemResult[]): NonNullable<AiDiagnosis["summary"]> {
  const analyzed = items.filter((item) => item.status === "ANALYZED");
  const count = (verdict: AiVerdict) => analyzed.filter((item) => item.verdict === verdict).length;
  const insufficient = items.filter((item) => item.status === "INSUFFICIENT").length;
  const failed = items.filter((item) => item.status === "FAILED").length;
  const notes = [insufficient ? `${insufficient}개는 분석 자료가 부족해 판정하지 않았어요.` : "", failed ? `${failed}개는 AI 요청에 실패했어요.` : ""].filter(Boolean).join(" ");
  const ordered = [...analyzed.filter((item) => item.verdict === "RISK"), ...analyzed.filter((item) => item.verdict === "PARTIAL")];
  return {
    overview: `선택한 ${items.length}개 항목 중 위험 ${count("RISK")}개, 부분적 안전 ${count("PARTIAL")}개, 안전 ${count("SAFE")}개로 판단했어요.${notes ? ` ${notes}` : ""}`,
    keyRisks: analyzed.filter((item) => item.verdict === "RISK").map((item) => item.conclusion),
    priorities: ordered.map((item) => item.recommendations[0]?.action).filter((action): action is string => Boolean(action)).slice(0, 3),
  };
}

export const aiDiagnosis = {
  /** Latest AI 정밀 점검 for a scan, or null when none was requested. */
  get: (scanId: string): Promise<AiDiagnosis | null> =>
    aiDiagnosisMode(scanId) === "mock"
      ? mock.getDiagnosis(scanId)
      : (async () => {
        const report = await api.getReport(scanId);
        const review = report.aiReview;
        if (!review) return null;
        const result = review.result as ({ selectedRuleTypes?: FindingType[]; pendingRuleTypes?: FindingType[]; summary?: { safe?: number; partiallySafe?: number; risk?: number }; results?: { ruleType: FindingType; status: string; verdict?: string | null; summary?: string; reason?: string; observedFacts?: string[]; evidenceIds?: string[]; evidence?: { evidenceId: string; stage?: Stage; text: string }[]; screenshotStages?: Stage[]; screenshotStage?: Stage; recommendations?: string[]; limitations?: string[] }[] } | null) ?? null;
        const items: AiItemResult[] = (result?.results ?? []).map((item) => ({
          type: item.ruleType,
          status: item.status === "INSUFFICIENT_DATA" ? "INSUFFICIENT" : item.status === "FAILED" ? "FAILED" : "ANALYZED",
          verdict: item.verdict === "PARTIALLY_SAFE" ? "PARTIAL" : item.verdict === "RISK" || item.verdict === "SAFE" ? item.verdict : undefined,
          conclusion: item.status === "FAILED" ? "AI 제공자 오류로 이 항목을 분석하지 못했어요." : item.summary ?? item.reason ?? "분석 결과를 확인할 수 없어요.",
          reasoning: item.reason ?? "",
          limitations: item.limitations?.filter(Boolean),
          evidence: item.evidence?.map((evidence) => ({ text: evidence.text || "수집된 구조화 근거", evidenceId: evidence.evidenceId, stage: evidence.stage })) ?? (item.observedFacts ?? []).map((text) => ({ text })),
          screenshotStages: item.screenshotStages ?? (item.screenshotStage ? [item.screenshotStage] : undefined),
          screenshotStage: item.screenshotStages?.[0] ?? item.screenshotStage,
          recommendations: (item.recommendations ?? []).map((action) => ({ title: "개선 권고", reason: item.reason ?? "", action })),
        }));
        return { id: review.id, scanId, status: review.status, requestedTypes: result?.selectedRuleTypes ?? result?.pendingRuleTypes ?? items.map((item) => item.type), createdAt: review.requestedAt ?? "", completedAt: review.completedAt ?? undefined, doneCount: items.length, error: review.error ?? undefined,
          summary: items.length ? summarize(items) : undefined,
          items };
      })(),
  request: (scanId: string, types: FindingType[]): Promise<AiDiagnosis> =>
    aiDiagnosisMode(scanId) === "mock"
      ? mock.requestDiagnosis(scanId, types)
      : (async () => {
        const response = await apiRequest<{ id: string; status: AiDiagnosisStatus; selectedRuleTypes?: FindingType[]; candidateCount?: number }>(`scans/${encodeURIComponent(scanId)}/ai-review`, { method: "POST", body: JSON.stringify({ selectedRuleTypes: types }) });
        if (response.status === "COMPLETED") return (await aiDiagnosis.get(scanId))!;
        return { id: response.id, scanId, status: response.status, requestedTypes: response.selectedRuleTypes ?? types, createdAt: new Date().toISOString(), doneCount: 0, items: [] };
      })(),
  cancel: (scanId: string): Promise<void> =>
    aiDiagnosisMode(scanId) === "mock"
      ? mock.cancelDiagnosis(scanId)
      : (async () => { await apiRequest(`scans/${encodeURIComponent(scanId)}/ai-review`, { method: "DELETE" }); })(),
};
