import type { CheckResult } from "@/lib/checks";
import { resultLabels } from "@/components/ui/Status";

const color: Record<CheckResult["kind"], string> = {
  risk: "var(--risk)",
  review: "var(--review)",
  clear: "var(--clear)",
  none: "var(--line-strong)",
};

/**
 * 16 segments, one per check, ordered by result. Replaces the redesign's single "risk score":
 * the API has no such score, so the ring only shows the counts the report actually contains.
 */
export function ResultRing({ results }: { results: CheckResult[] }) {
  const order: CheckResult["kind"][] = ["risk", "review", "clear", "none"];
  const sorted = order.flatMap((kind) => results.filter((result) => result.kind === kind));
  const total = sorted.length || 16;
  const r = 34;
  const c = 2 * Math.PI * r;
  const gap = 2.2;
  const seg = c / total - gap;
  const label = order.map((kind) => `${resultLabels[kind]} ${results.filter((x) => x.kind === kind).length}`).join(", ");
  const flagged = results.filter((x) => x.kind === "risk" || x.kind === "review").length;
  return (
    <svg className="rpt-ring" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={`16개 항목 중 주의 ${flagged}개 (${label})`}>
      {sorted.map((result, index) => (
        <circle
          key={result.type}
          cx="48" cy="48" r={r}
          fill="none"
          stroke={color[result.kind]}
          strokeWidth="9"
          strokeDasharray={`${seg} ${c - seg}`}
          strokeDashoffset={-index * (seg + gap)}
          transform="rotate(-90 48 48)"
        />
      ))}
      <text x="48" y="48" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--ink)" className="tnum">{flagged}</text>
      <text x="48" y="64" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink-2)">{total}개 중 주의</text>
    </svg>
  );
}
