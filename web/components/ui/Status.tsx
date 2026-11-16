import type { ReactNode } from "react";
import type { ScanStatus } from "@/lib/types";
import { scanStatusLabels } from "@/lib/labels";

/** Result of one of the 16 checks. Shape + label, never color alone. */
export type ResultKind = "risk" | "review" | "clear" | "none";
export const resultLabels: Record<ResultKind, string> = { risk: "위험", review: "검토 필요", clear: "안전", none: "미검사" };
/** Plain wording for shop owners (report wireframe): what the result asks them to do. */
export const plainLabels: Record<ResultKind, string> = { risk: "고쳐야 해요", review: "확인해 보세요", clear: "괜찮아요", none: "점검 못 했어요" };

type MarkKind = ResultKind | "run" | "wait" | "done" | "stop" | "partial";

export function Mark({ kind }: { kind: MarkKind }) {
  const common = { width: 10, height: 10, viewBox: "0 0 12 12", "aria-hidden": true as const, className: "mark" };
  switch (kind) {
    case "risk":
      return <svg {...common}><path d="M6 1 L11.2 10.5 H0.8 Z" fill="var(--risk)" /></svg>;
    case "review":
      return <svg {...common}><rect x="2.5" y="2.5" width="7" height="7" transform="rotate(45 6 6)" fill="var(--review)" /></svg>;
    case "clear":
      return <svg {...common}><circle cx="6" cy="6" r="5" fill="var(--clear)" /></svg>;
    case "none":
      return <svg {...common}><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--untested)" strokeWidth="1.8" /></svg>;
    case "done":
      return <svg {...common}><circle cx="6" cy="6" r="5" fill="var(--brand)" /></svg>;
    case "wait":
      return <svg {...common}><circle cx="6" cy="6" r="4.5" fill="none" stroke="#868c96" strokeWidth="1.5" /></svg>;
    case "stop":
      return <svg {...common}><rect x="1.5" y="1.5" width="9" height="9" rx="2" fill="none" stroke="var(--risk-ink)" strokeWidth="1.6" /></svg>;
    case "partial":
      return <svg {...common}><circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--review)" strokeWidth="1.6" /><path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" fill="var(--review)" /></svg>;
    case "run":
      return (
        <svg {...common} className="mark spin">
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="#d0d3d9" strokeWidth="1.6" />
          <path d="M6 1.5 A4.5 4.5 0 0 1 10.5 6" fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}

export function Badge({ kind, children, large }: { kind: MarkKind; children: ReactNode; large?: boolean }) {
  return <span className={large ? "badge badge--lg" : "badge"}><Mark kind={kind} />{children}</span>;
}

export function ResultBadge({ kind, large }: { kind: ResultKind; large?: boolean }) {
  return <Badge kind={kind} large={large}>{resultLabels[kind]}</Badge>;
}

/** Tinted verdict badge used in report group headers and detail panels (shape + label). */
export function VerdictBadge({ kind }: { kind: ResultKind }) {
  return <span className={`verdict verdict--${kind}`}><Mark kind={kind} />{resultLabels[kind]}</span>;
}

const statusMark: Record<ScanStatus, MarkKind> = {
  QUEUED: "wait", RUNNING: "run", COMPLETED: "done", PARTIAL: "partial", FAILED: "stop", CANCELLED: "none",
};
export function ScanStatusBadge({ status, label }: { status: ScanStatus; label?: string }) {
  return <Badge kind={statusMark[status]}>{label ?? scanStatusLabels[status]}</Badge>;
}
