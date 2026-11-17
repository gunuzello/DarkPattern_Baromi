import type { ResultKind } from "@/components/ui/Status";
import { ruleSurface, rules, stageLabels, surfaceStatusLabels } from "./labels";
import type { Finding, FindingType, Report, RuleStatus, Stage } from "./types";

/** The stage a check needs before "not observed" can be said honestly (fallback only). */
const ruleStage: Partial<Record<FindingType, Stage>> = {
  DRIP_PRICING: "checkout",
  HIDDEN_INFO: "checkout",
  SNEAKY_CART_ADD: "cart",
};

export const ruleKind: Record<RuleStatus, ResultKind> = {
  SUSPECTED: "risk",
  REVIEW_NEEDED: "review",
  NOT_OBSERVED: "clear",
  NOT_TESTED: "none",
};

export type CheckResult = {
  type: FindingType;
  name: string;
  kind: ResultKind;
  note: string;
  evidenceIds: string[];
  findings: Finding[];
};

/**
 * One result per check, always all 16 in the same order.
 * The server's `ruleCoverage` (spec §5) wins. Without it, a check is "미관찰" (NOT_OBSERVED) only when
 * the screens it depends on were actually inspected; otherwise "미검사" with the reason.
 */
export function checkResults(report: Report): CheckResult[] {
  return rules.map((rule) => {
    const findings = report.findings.filter((finding) => finding.type === rule.type);
    const server = report.ruleCoverage?.[rule.type];
    if (server) {
      const kind = ruleKind[server.status] ?? "none";
      const related = kind === "risk"
        ? findings.map((finding) => ({ ...finding, status: "SUSPECTED" as const }))
        : kind === "review"
          ? findings.map((finding) => ({ ...finding, status: "REVIEW_NEEDED" as const }))
          : [];
      return { type: rule.type, name: rule.name, kind, note: server.reason ?? "", evidenceIds: server.evidenceIds ?? [], findings: related };
    }

    const suspected = findings.filter((finding) => finding.status !== "REVIEW_NEEDED");
    const review = findings.filter((finding) => finding.status === "REVIEW_NEEDED");
    const where = (list: Finding[]) => `${stageLabels[list[0].stage]} ${list.length}건`;
    const ids = (list: Finding[]) => list.flatMap((finding) => finding.evidenceIds ?? []);
    const base = { type: rule.type, name: rule.name };
    if (suspected.length) return { ...base, kind: "risk", note: where(suspected), evidenceIds: ids(suspected), findings: suspected };
    if (review.length) return { ...base, kind: "review", note: where(review), evidenceIds: ids(review), findings: review };

    const surface = ruleSurface[rule.type];
    if (surface && report.surfaceCoverage?.[surface] !== "COVERED") {
      const status = report.surfaceCoverage?.[surface] ?? "NOT_FOUND";
      return { ...base, kind: "none", note: surfaceStatusLabels[status], evidenceIds: [], findings: [] };
    }
    const stage = ruleStage[rule.type] ?? "product";
    const coverage = report.coverage?.[stage];
    if (coverage === "SKIPPED") return { ...base, kind: "none", note: `${stageLabels[stage]}: 선택 경로에 없음`, evidenceIds: [], findings: [] };
    if (coverage !== "COVERED") return { ...base, kind: "none", note: `${stageLabels[stage]} 미검사`, evidenceIds: [], findings: [] };
    return { ...base, kind: "clear", note: "", evidenceIds: [], findings: [] };
  });
}

export function comparisonTag(report: Report, finding: Finding): string | null {
  const comparison = report.comparison;
  if (!comparison || comparison.status === "UNAVAILABLE") return null;
  const same = (signal: { type: FindingType; stage: Stage }) => signal.type === finding.type && signal.stage === finding.stage;
  if (comparison.repeated.some(same)) return "재발견";
  if (comparison.added.some(same)) return "신규";
  return null;
}
