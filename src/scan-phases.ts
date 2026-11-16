import { diagnosticSurfaceKinds, type DiagnosticSurfaceKind } from "./diagnostic-surfaces";
import { stages, type Stage } from "./demo";

export type ScanPhaseId = Stage | `surface:${DiagnosticSurfaceKind}` | "site-crawl";
export type ScanPhaseStatus = "PENDING" | "RUNNING" | "COVERED" | "DISCOVERED" | "NOT_FOUND" | "BLOCKED" | "FAILED" | "SKIPPED";
export type ScanPhaseActivity = {
  visitedScreens: number;
  discoveredScreens: number;
  pendingScreens: number;
  visitedUrls: number;
  discoveredUrls: number;
  updatedAt: string;
};
export type ScanPhase = {
  status: ScanPhaseStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  reason?: string;
  evidenceIds: string[];
  activity?: ScanPhaseActivity;
};
export type ScanPhaseResults = Partial<Record<ScanPhaseId, ScanPhase>>;

export function nextPurchaseStage(stage: Stage, purchasePath: "CART" | "DIRECT"): Stage | undefined {
  if (stage === "product") return purchasePath === "DIRECT" ? "checkout" : "cart";
  if (stage === "cart") return "checkout";
  return undefined;
}

export function initialScanPhases(purchasePath: "CART" | "DIRECT", dynamic: boolean): ScanPhaseResults {
  const results: ScanPhaseResults = {};
  for (const stage of stages) {
    results[stage] = {
      status: stage === "cart" && purchasePath === "DIRECT" ? "SKIPPED" : "PENDING",
      evidenceIds: [],
      ...(stage === "cart" && purchasePath === "DIRECT" ? { reason: "바로구매 경로에서는 장바구니를 지나지 않습니다." } : {}),
    };
  }
  for (const surface of diagnosticSurfaceKinds) {
    results[`surface:${surface}`] = {
      status: dynamic ? "PENDING" : "SKIPPED",
      evidenceIds: [],
      ...(!dynamic ? { reason: "별도 영역 탐색은 동적 진단에서 수행합니다." } : {}),
    };
  }
  results["site-crawl"] = {
    status: dynamic ? "PENDING" : "SKIPPED",
    evidenceIds: [],
    ...(!dynamic ? { reason: "전체 사이트 크롤링은 동적 진단에서 수행합니다." } : {}),
  };
  return results;
}

export function parseScanPhases(value: string | null | undefined, fallback?: ScanPhaseResults): ScanPhaseResults {
  if (!value) return fallback ?? {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...(fallback ?? {}), ...(parsed as ScanPhaseResults) }
      : fallback ?? {};
  } catch {
    return fallback ?? {};
  }
}

export function updateScanPhase(
  phases: ScanPhaseResults,
  id: ScanPhaseId,
  update: Partial<ScanPhase> & Pick<ScanPhase, "status">,
  now = new Date(),
): ScanPhaseResults {
  const previous = phases[id] ?? { status: "PENDING" as const, evidenceIds: [] };
  const startedAt = update.status === "RUNNING" ? previous.startedAt ?? now.toISOString() : previous.startedAt;
  const finishedAt = ["COVERED", "DISCOVERED", "NOT_FOUND", "BLOCKED", "FAILED", "SKIPPED"].includes(update.status)
    ? now.toISOString()
    : undefined;
  const durationMs = startedAt && finishedAt
    ? Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt))
    : previous.durationMs;
  return {
    ...phases,
    [id]: {
      ...previous,
      ...update,
      ...(startedAt ? { startedAt } : {}),
      ...(finishedAt ? { finishedAt, durationMs } : {}),
      evidenceIds: update.evidenceIds ?? previous.evidenceIds,
    },
  };
}

export function closeCancelledScanPhases(phases: ScanPhaseResults, reason = "사용자가 진단을 중단했습니다."): ScanPhaseResults {
  let result = phases;
  for (const [id, phase] of Object.entries(phases) as [ScanPhaseId, ScanPhase][]) {
    if (phase.status === "RUNNING") result = updateScanPhase(result, id, { status: "FAILED", reason });
    else if (phase.status === "PENDING") result = updateScanPhase(result, id, { status: "SKIPPED", reason: "진단 중단으로 실행하지 않았습니다." });
  }
  return result;
}

/** Close a crashed/failed run without claiming that every unstarted phase failed. */
export function closeFailedScanPhases(phases: ScanPhaseResults, reason: string): ScanPhaseResults {
  let result = phases;
  const entries = Object.entries(phases) as [ScanPhaseId, ScanPhase][];
  const running = new Set(entries.filter(([, phase]) => phase.status === "RUNNING").map(([id]) => id));
  const firstPending = entries.find(([, phase]) => phase.status === "PENDING")?.[0];
  let failureAssigned = running.size > 0;

  for (const [id, phase] of entries) {
    if (running.has(id)) {
      result = updateScanPhase(result, id, { status: "FAILED", reason });
    } else if (phase.status === "PENDING") {
      if (!failureAssigned && id === firstPending) {
        result = updateScanPhase(result, id, { status: "FAILED", reason });
        failureAssigned = true;
      } else {
        result = updateScanPhase(result, id, { status: "SKIPPED", reason: "앞 단계 실패로 실행하지 않았습니다." });
      }
    }
  }
  return result;
}
