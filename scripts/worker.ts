import { setTimeout as delay } from "node:timers/promises";
import { db } from "../src/db";
import { runScanJob } from "../src/scan-job";
import { notifySpringScanStatus } from "../src/spring-status";
import { claimSpringScan, isClaimCompatible, recoverSpringScans } from "../src/spring-queue";
import { runAiReviewJob } from "../src/ai-review-job";
import { scanStaleBefore } from "../src/scan-timeout";
import { initialScanPhases, parseScanPhases, updateScanPhase } from "../src/scan-phases";

async function main() {
  const store = db();
  let stopping = false;
  let lastSpringRecovery = 0;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });

  try {
    while (!stopping) {
      if (Date.now() - lastSpringRecovery >= 30_000) {
        lastSpringRecovery = Date.now();
        await recoverSpringScans(scanStaleBefore()).catch((error) => console.warn(error instanceof Error ? error.message : error));
        await store.aiReview.updateMany({
          where: { status: "RUNNING", startedAt: { lt: scanStaleBefore() } },
          data: { status: "FAILED", completedAt: new Date(), error: "워커 재시작으로 작업이 만료되었습니다." },
        }).catch((error) => console.warn(error instanceof Error ? error.message : error));
      }
      const springJob = await claimSpringScan().catch((error) => { console.warn(error instanceof Error ? error.message : error); return null; });
      if (springJob) {
        const local = await store.scan.findUnique({ where: { id: springJob.scanId }, select: { status: true, targetUrl: true, phaseResultsJson: true } });
        const targetMatches = isClaimCompatible(local, springJob);
        const started = targetMatches
          ? await store.scan.updateMany({ where: { id: springJob.scanId, status: "QUEUED" }, data: {
            status: "RUNNING", startedAt: new Date(), durationMs: null,
            phaseResultsJson: local?.phaseResultsJson && local.phaseResultsJson !== "{}" ? local.phaseResultsJson : JSON.stringify(initialScanPhases(springJob.purchasePath === "DIRECT" ? "DIRECT" : "CART", springJob.executionMode === "DYNAMIC")),
          } })
          : { count: 0 };
        if (started.count) {
          const dynamicPhases = springJob.executionMode === "DYNAMIC";
          const purchasePath = springJob.purchasePath === "DIRECT" ? "DIRECT" : "CART";
          await runScanJob(springJob.scanId, springJob.targetUrl ?? "", {
            onPhase: async (phaseId, status, details = {}) => {
              const current = await store.scan.findUnique({ where: { id: springJob.scanId }, select: { phaseResultsJson: true } });
              const phases = updateScanPhase(parseScanPhases(current?.phaseResultsJson, initialScanPhases(purchasePath, dynamicPhases)), phaseId, { status, ...details });
              await store.scan.update({ where: { id: springJob.scanId }, data: { phaseResultsJson: JSON.stringify(phases), currentStage: `${phaseId}:${status}` } });
            },
          }).catch((error) => console.error(springJob.scanId, error));
        } else {
          if (local && !targetMatches) console.error(`${springJob.scanId} Spring/SQLite target mismatch; refusing to run`);
          await notifySpringScanStatus(springJob.scanId, "failed");
        }
        continue;
      }
      // Reconcile jobs from an interrupted worker once their execution limit has passed.
      await store.scan.updateMany({
        where: { status: "RUNNING", cancelRequested: true },
        data: { status: "CANCELLED" },
      });
      await store.scan.updateMany({
        where: { status: "RUNNING", startedAt: { lt: scanStaleBefore() } },
        data: { status: "FAILED" },
      });
      const alreadyRunning = await store.scan.findFirst({ where: { status: "RUNNING", startedAt: { not: null } }, select: { id: true } });
      const candidate = alreadyRunning ? null : await store.scan.findFirst({
        where: { status: "QUEUED" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, targetUrl: true, purchasePath: true, executionMode: true, phaseResultsJson: true },
      });
      let job: typeof candidate = null;
      if (candidate) {
        const purchasePath = candidate.purchasePath === "DIRECT" ? "DIRECT" : "CART";
        const initial = initialScanPhases(purchasePath, candidate.executionMode === "DYNAMIC");
        const claimed = await store.scan.updateMany({
          where: { id: candidate.id, status: "QUEUED" },
          data: {
            status: "RUNNING", startedAt: new Date(), durationMs: null,
            phaseResultsJson: candidate.phaseResultsJson === "{}" ? JSON.stringify(initial) : candidate.phaseResultsJson,
          },
        });
        if (claimed.count) job = candidate;
      }
      if (job) {
        const dynamicPhases = job.executionMode === "DYNAMIC";
        const purchasePath = job.purchasePath === "DIRECT" ? "DIRECT" : "CART";
        await notifySpringScanStatus(job.id, "running");
        await runScanJob(job.id, job.targetUrl, {
          onPhase: async (phaseId, status, details = {}) => {
            const current = await store.scan.findUnique({ where: { id: job.id }, select: { phaseResultsJson: true } });
            const phases = updateScanPhase(parseScanPhases(current?.phaseResultsJson, initialScanPhases(purchasePath, dynamicPhases)), phaseId, { status, ...details });
            await store.scan.update({ where: { id: job.id }, data: { phaseResultsJson: JSON.stringify(phases), currentStage: `${phaseId}:${status}` } });
          },
        }).catch((error) => console.error(job.id, error));
      } else {
        const activeAi = await store.aiReview.findFirst({ where: { status: "RUNNING" }, select: { id: true } });
        const candidateAi = activeAi ? null : await store.aiReview.findFirst({ where: { status: "QUEUED" }, orderBy: [{ requestedAt: "asc" }, { id: "asc" }], select: { id: true } });
        const claimedAi = candidateAi ? await store.aiReview.updateMany({
          where: { id: candidateAi.id, status: "QUEUED" },
          data: { status: "RUNNING", startedAt: new Date(), error: null },
        }) : { count: 0 };
        if (candidateAi && claimedAi.count) await runAiReviewJob(candidateAi.id).catch((error) => console.error(candidateAi.id, error));
        else await delay(500);
      }
    }
  } finally {
    await store.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
