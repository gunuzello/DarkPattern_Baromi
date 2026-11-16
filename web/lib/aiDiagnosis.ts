/**
 * AI 정밀 점검 (user-selected checks, 3-level AI verdict).
 *
 * DRAFT CONTRACT. The backend has not shipped this yet (spec §6), so every field name here
 * is a proposal to agree on with the backend team, and screens run on mock data. Keep the
 * AI verdict separate from the base engine's RuleStatus: they are different data.
 */
import type { FindingType, Stage } from "./types";
import { aiDiagnosisFetch, usesSample } from "./api";
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
 * - "api": NEXT_PUBLIC_AI_DIAGNOSIS=api once the backend ships the endpoints
 * - "legacy": real scans until then keep the existing AI 정밀 점검 (review candidates only)
 */
export function aiDiagnosisMode(scanId: string): "mock" | "api" | "legacy" {
  const flag = process.env.NEXT_PUBLIC_AI_DIAGNOSIS;
  if (usesSample(scanId) || flag === "mock") return "mock";
  if (flag === "api") return "api";
  return "legacy";
}

export const aiVerdictLabels: Record<AiVerdict, string> = { RISK: "위험", PARTIAL: "부분적 안전", SAFE: "안전" };
export const aiVerdictOrder: AiVerdict[] = ["RISK", "PARTIAL", "SAFE"];

const apiRequest = aiDiagnosisFetch;

export const aiDiagnosis = {
  /** Latest AI 정밀 점검 for a scan, or null when none was requested. */
  get: (scanId: string): Promise<AiDiagnosis | null> =>
    aiDiagnosisMode(scanId) === "mock"
      ? mock.getDiagnosis(scanId)
      : apiRequest<AiDiagnosis | null>(`scans/${encodeURIComponent(scanId)}/ai-diagnosis`),
  request: (scanId: string, types: FindingType[]): Promise<AiDiagnosis> =>
    aiDiagnosisMode(scanId) === "mock"
      ? mock.requestDiagnosis(scanId, types)
      : apiRequest<AiDiagnosis>(`scans/${encodeURIComponent(scanId)}/ai-diagnosis`, { method: "POST", body: JSON.stringify({ ruleTypes: types }) }),
};
