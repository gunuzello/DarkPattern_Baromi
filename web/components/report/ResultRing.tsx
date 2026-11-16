import type { CheckResult } from "@/lib/checks";
import { plainLabels } from "@/components/ui/Status";

export const kindOrder: CheckResult["kind"][] = ["risk", "review", "none", "clear"];
const color: Record<CheckResult["kind"], string> = {
  risk: "var(--risk)",
  review: "var(--review)",
  none: "var(--untested)",
  clear: "var(--clear)",
};

/**
 * Report donut (wireframe R-01): a thin ring with rounded ends and small gaps, one arc per
 * result in list order, the total in the middle. Counts sit next to it with shape badges,
 * so color is never the only signal.
 */
export function ResultRing({ results, size = 164 }: { results: CheckResult[]; size?: number }) {
  const total = results.length || 16;
  const stroke = 12;
  const r = 70;
  const c = 2 * Math.PI * r;
  const gap = stroke + 6; // round caps eat half the stroke on each side
  const parts = kindOrder.map((kind) => ({ kind, count: results.filter((result) => result.kind === kind).length })).filter((part) => part.count);
  let offset = 0;
  const arcs = parts.map((part) => {
    const length = (part.count / total) * c;
    const visible = Math.max(0.5, length - (parts.length > 1 ? gap : 0));
    const arc = { ...part, dash: `${visible} ${c - visible}`, offset: -offset };
    offset += length;
    return arc;
  });
  const label = parts.map((part) => `${plainLabels[part.kind]} ${part.count}`).join(", ");
  return (
    <svg className="rv-ring" width={size} height={size} viewBox="0 0 164 164" role="img" aria-label={`${total}가지 점검 결과: ${label}`}>
      <circle cx="82" cy="82" r={r} fill="none" stroke="var(--surface-sub)" strokeWidth={stroke} />
      {arcs.map((arc) => (
        <circle
          key={arc.kind}
          cx="82" cy="82" r={r}
          fill="none"
          stroke={color[arc.kind]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arc.dash}
          strokeDashoffset={arc.offset - (parts.length > 1 ? gap / 2 : 0)}
          transform="rotate(-90 82 82)"
        />
      ))}
      <text x="82" y="86" textAnchor="middle" fontSize="38" fontWeight="800" fill="var(--ink)" className="tnum">{total}</text>
      <text x="82" y="108" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink-3)">가지 점검</text>
    </svg>
  );
}
