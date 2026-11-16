import { checkResults, type CheckResult } from "@/lib/checks";
import { guide } from "@/lib/guide";
import { rules } from "@/lib/labels";
import type { AiReview, Report, ReviewCandidate } from "@/lib/types";

export type AiDecision = NonNullable<NonNullable<AiReview["result"]>["decisions"]>[number] & { candidate?: ReviewCandidate };

/** One of the 16 checks as the report shows it: fixed number, plain title, one-line summary. */
export type ReportItem = CheckResult & {
  no: string;
  plain: string;
  summary: string;
  candidates: ReviewCandidate[];
  ai: AiDecision[];
};

const fallbackSummary: Record<CheckResult["kind"], string> = {
  risk: "기준에 해당하는 신호를 찾았어요",
  review: "관련 내용을 찾았지만 더 살펴봐야 해요",
  clear: "점검한 범위에서 문제가 안 보였어요",
  none: "판단에 필요한 자료를 얻지 못했어요",
};

export function reportItems(report: Report): ReportItem[] {
  const results = checkResults(report);
  const candidates = (report.reviewCandidates ?? []).filter((candidate) => candidate.ruleType);
  const decisions = report.aiReview?.status === "COMPLETED" ? report.aiReview.result?.decisions ?? [] : [];
  return results.map((result) => {
    const no = String(rules.findIndex((rule) => rule.type === result.type) + 1).padStart(2, "0");
    const mine = result.kind === "review" ? candidates.filter((candidate) => candidate.ruleType === result.type) : [];
    const ai = decisions
      .map((decision) => ({ ...decision, candidate: candidates.find((candidate) => candidate.id === decision.candidateId) }))
      .filter((decision) => decision.candidate?.ruleType === result.type);
    const summary = result.note || result.findings[0]?.reason || fallbackSummary[result.kind];
    return { ...result, no, plain: guide[result.type].plain, summary, candidates: mine, ai };
  });
}

/** AI follow-up targets: every 확인해 보세요 check that has a candidate to send (spec §6–§7). */
export function aiTargets(items: ReportItem[]): ReportItem[] {
  return items.filter((item) => item.kind === "review" && item.candidates.length);
}

/** Plain wording for the AI's per-candidate label; the free result badge never changes. */
export const aiOpinionText: Record<string, string> = {
  LIKELY_RISK: "문제일 가능성이 높아 보여요",
  NEEDS_REVIEW: "사람이 한 번 더 확인해야 해요",
  LIKELY_BENIGN: "문제가 아닐 가능성이 높아 보여요",
  INSUFFICIENT_EVIDENCE: "근거가 부족해 판단하지 않았어요",
};

export function methodText(report: Report): string {
  if (report.executionMode !== "DYNAMIC") return "공개된 화면에 보이는 내용을 읽어서 확인했어요. 장바구니와 주문서는 열지 않았어요.";
  const path = report.purchasePath === "DIRECT" ? "상품 → 바로구매 → 주문서" : "상품 → 장바구니 → 주문서";
  return `실제 구매 과정처럼 ${path} 순서로 확인했어요. 결제 버튼은 누르지 않았어요.`;
}
