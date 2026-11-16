import "dotenv/config";
import { db } from "../src/db";
import { runScanJob } from "../src/scan-job";
import { initialScanPhases } from "../src/scan-phases";
import { runAiReviewJob } from "../src/ai-review-job";

async function main() {
  const scanId = process.argv[2];
  if (!scanId) throw new Error("Cloud Run Job에는 진단 ID가 필요합니다.");
  if (scanId.startsWith("ai:")) {
    const store = db();
    try {
      const id = scanId.slice(3);
      const claimed = await store.aiReview.updateMany({ where: { id, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date() } });
      if (!claimed.count) throw new Error("AI 작업을 시작할 수 없습니다.");
      await runAiReviewJob(id);
    } finally { await store.$disconnect(); }
    return;
  }
  const store = db();
  try {
    const scan = await store.scan.findUnique({
      where: { id: scanId },
      select: { id: true, targetUrl: true, status: true, purchasePath: true, executionMode: true, phaseResultsJson: true },
    });
    if (!scan) throw new Error("요청한 진단 작업을 찾을 수 없습니다.");
    if (scan.status !== "QUEUED") throw new Error(`대기 상태가 아닌 진단은 실행하지 않습니다 (${scan.status}).`);
    const purchasePath = scan.purchasePath === "DIRECT" ? "DIRECT" : "CART";
    const started = await store.scan.updateMany({
      where: { id: scanId, status: "QUEUED" },
      data: {
        status: "RUNNING", startedAt: new Date(), durationMs: null,
        phaseResultsJson: scan.phaseResultsJson === "{}"
          ? JSON.stringify(initialScanPhases(purchasePath, scan.executionMode === "DYNAMIC"))
          : scan.phaseResultsJson,
      },
    });
    if (!started.count) throw new Error("다른 작업에서 먼저 시작한 진단입니다.");
    const reportPath = await runScanJob(scanId, scan.targetUrl);
    if (!reportPath) throw new Error("진단이 취소되었습니다.");
  } finally {
    await store.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
