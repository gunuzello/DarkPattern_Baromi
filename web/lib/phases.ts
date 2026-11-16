import type { PhaseId, PhaseResult, PhaseResults, PhaseStatus, Stage, StageCoverage, SurfaceKind, SurfaceStatus } from "./types";

/**
 * Spec §4: the screen reads `phaseResults` first and never infers one phase's result from
 * a number or from `currentStage`. Older API responses without `phaseResults` fall back to
 * the per-stage `coverage` and `surfaceCoverage` values the server actually sent.
 */
type Source = {
  phaseResults?: PhaseResults;
  coverage: Record<Stage, StageCoverage>;
  surfaceCoverage: Record<SurfaceKind, SurfaceStatus>;
};

export const surfacePhase = (kind: SurfaceKind): PhaseId => `surface:${kind}`;

export function phaseFor(source: Source, id: PhaseId): PhaseResult {
  const reported = source.phaseResults?.[id];
  if (reported?.status) return reported;
  // Not reported is not the same as skipped: stay neutral until the server says otherwise.
  if (id === "site-crawl") return { status: "PENDING" };
  if (id.startsWith("surface:")) {
    const kind = id.slice("surface:".length) as SurfaceKind;
    return { status: (source.surfaceCoverage?.[kind] ?? "PENDING") as PhaseStatus };
  }
  return { status: (source.coverage?.[id as Stage] ?? "PENDING") as PhaseStatus };
}

export const terminalPhase = (status: PhaseStatus) => status !== "PENDING" && status !== "RUNNING";

export const phaseStatusLabels: Record<PhaseStatus, string> = {
  PENDING: "대기",
  RUNNING: "진행 중",
  COVERED: "검사 완료",
  DISCOVERED: "후보만 발견",
  NOT_FOUND: "경로 미발견",
  BLOCKED: "접근 차단",
  FAILED: "실패",
  SKIPPED: "건너뜀",
};

/** Visual tone of a phase. Shape + label carry the meaning; color only supports it. */
export type PhaseTone = "ok" | "run" | "wait" | "partial" | "stop" | "skip";
export const phaseTone: Record<PhaseStatus, PhaseTone> = {
  PENDING: "wait",
  RUNNING: "run",
  COVERED: "ok",
  DISCOVERED: "partial",
  NOT_FOUND: "stop",
  BLOCKED: "stop",
  FAILED: "stop",
  SKIPPED: "skip",
};
