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
export type AiDiagnosisStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type AiEvidence = {
  /** What was actually collected: wording, selection state, price, action log. */
  text: string;
  evidenceId?: string;
  stage?: Stage;
};
export type AiRecommendation = { title: string; reason: string; action: string };

export type AiItemResult = {
  type: FindingType;
  /** INSUFFICIENT = the AI could not analyse it (no verdict shown). */
  status: "ANALYZED" | "INSUFFICIENT";
  verdict?: AiVerdict;
  conclusion: string;
  evidence: AiEvidence[];
  /** Only when the judgement depends on how the screen looks; never a generated image. */
  screenshotStage?: Stage;
  reasoning: string;
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
 * - "legacy": keep the older review-candidate view
 */
export function aiDiagnosisMode(scanId: string): "mock" | "api" | "legacy" {
  const flag = process.env.NEXT_PUBLIC_AI_DIAGNOSIS;
  if (usesSample(scanId) || flag === "mock") return "mock";
  return "api";
}

export const aiVerdictLabels: Record<AiVerdict, string> = { RISK: "위험", PARTIAL: "부분적 안전", SAFE: "안전" };
export const aiVerdictOrder: AiVerdict[] = ["RISK", "PARTIAL", "SAFE"];

const apiRequest = aiDiagnosisFetch;

export const aiDiagnosis = {
  /** Latest AI 정밀 점검 for a scan, or null when none was requested. */
  get: (scanId: string): Promise<AiDiagnosis | null> =>
    aiDiagnosisMode(scanId) === "mock"
      ? mock.getDiagnosis(scanId)
      : (async () => {
        const report = await api.getReport(scanId);
        const review = report.aiReview;
        if (!review) return null;
        const result = review.result as ({ selectedRuleTypes?: FindingType[]; summary?: { safe?: number; partiallySafe?: number; risk?: number }; results?: { ruleType: FindingType; status: string; verdict?: string | null; summary?: string; reason?: string; observedFacts?: string[]; evidenceIds?: string[]; recommendations?: string[]; limitations?: string[] }[] } | null) ?? null;
        const items: AiItemResult[] = (result?.results ?? []).map((item) => ({
          type: item.ruleType,
          status: item.status === "INSUFFICIENT_DATA" || item.status === "FAILED" ? "INSUFFICIENT" : "ANALYZED",
          verdict: item.verdict === "PARTIALLY_SAFE" ? "PARTIAL" : item.verdict === "RISK" || item.verdict === "SAFE" ? item.verdict : undefined,
          conclusion: item.summary ?? item.reason ?? "분석 결과를 확인할 수 없어요.",
          reasoning: item.reason ?? item.limitations?.join(" ") ?? "",
          evidence: (item.observedFacts ?? []).map((text, index) => ({ text, evidenceId: item.evidenceIds?.[index] })),
          recommendations: (item.recommendations ?? []).map((action) => ({ title: "개선 권고", reason: item.reason ?? "", action })),
        }));
        return { id: review.id, scanId, status: review.status, requestedTypes: result?.selectedRuleTypes ?? items.map((item) => item.type), createdAt: "", completedAt: undefined, doneCount: items.length, error: review.error ?? undefined,
          summary: result?.summary ? { overview: `안전 ${result.summary.safe ?? 0}개, 부분 개선 ${result.summary.partiallySafe ?? 0}개, 위험 ${result.summary.risk ?? 0}개`, keyRisks: items.filter((item) => item.verdict === "RISK").map((item) => item.conclusion), priorities: items.flatMap((item) => item.recommendations.map((rec) => rec.action)).slice(0, 8) } : undefined,
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
};
