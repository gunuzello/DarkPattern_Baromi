import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { evidenceDirectory } from "./evidence-directory";
import { db } from "./db";
import { scanDemo } from "./scan";
import { scanPublicShop } from "./public-scan";
import { scanTarget } from "./targets";
import { scanDynamicPublicShop } from "./dynamic-public-scan";
import { startSafeBrowserProxy } from "./safe-browser-proxy";
import { buildPriceLedger } from "./price-ledger";
import { scanComparisonVersion } from "./scan-comparison";
import { decryptCredentials, type TestCredentials } from "./credential-vault";
import { notifySpringScanStatus } from "./spring-status";
import { classifyDynamicFailure } from "./scan-failure";
import { closeCancelledScanPhases, closeFailedScanPhases, initialScanPhases, nextPurchaseStage, parseScanPhases, updateScanPhase, type ScanPhaseActivity, type ScanPhaseId, type ScanPhaseStatus } from "./scan-phases";
import { buildRuleCoverage } from "./rule-coverage";

type ScanJobCallbacks = {
  onPhase?: (id: ScanPhaseId, status: ScanPhaseStatus, details?: { reason?: string; evidenceIds?: string[]; activity?: ScanPhaseActivity }) => Promise<void>;
};

export async function runScanJob(id: string, targetUrl: string, callbacks: ScanJobCallbacks = {}) {
  const store = db();
  const startedAt = Date.now();
  try {
    const target = scanTarget(targetUrl);
    if (!target) throw new Error("허용 목록에 없는 진단 대상입니다.");
    const requested = await store.scan.findUnique({
      where: { id }, select: { executionMode: true, viewport: true, purchasePath: true, credentialCiphertext: true, phaseResultsJson: true, shop: { select: { verifiedAt: true } } },
    });
    if (!requested) throw new Error("진단 작업을 찾을 수 없습니다.");
    if (requested.executionMode === "DYNAMIC" && (target.scenario !== "public" || (!requested.shop?.verifiedAt && !requested.credentialCiphertext))) {
      throw new Error("사이트 확인이 없는 동적 진단은 실행할 수 없습니다.");
    }
    let credentials: TestCredentials | undefined;
    if (requested.credentialCiphertext) {
      try { credentials = decryptCredentials(requested.credentialCiphertext); }
      catch (error) {
        await store.scan.update({ where: { id }, data: { credentialCiphertext: null } }).catch(() => undefined);
        throw error;
      }
    }
    const browserLaunchOptions = {
      timeout: 20_000,
      headless: true,
      // Keep Chromium usable in container/CI workers where /dev/shm is small.
      args: ["--disable-dev-shm-usage"],
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    };
    let browser = await chromium.launch(browserLaunchOptions);
    const proxy = requested.executionMode === "DYNAMIC"
      ? await startSafeBrowserProxy().catch(async (error) => { await browser.close(); throw error; })
      : null;
    const configuredTimeout = Number(process.env.SCAN_TIMEOUT_MS ?? 280_000);
    const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 30_000), 300_000) : 280_000;
    const timeout = setTimeout(() => void browser.close().catch(() => {}), timeoutMs);
    try {
      const directory = evidenceDirectory(id);
      let progress = 0;
      let lastCrawlWriteAt = 0;
      let lastCrawlVisited = -1;
      let phases = parseScanPhases(requested.phaseResultsJson, initialScanPhases(requested.purchasePath === "DIRECT" ? "DIRECT" : "CART", requested.executionMode === "DYNAMIC"));
      const recordPhase = async (phaseId: ScanPhaseId, status: ScanPhaseStatus, details: { reason?: string; evidenceIds?: string[]; activity?: ScanPhaseActivity } = {}) => {
        phases = updateScanPhase(phases, phaseId, { status, ...details });
        await store.scan.update({ where: { id }, data: { phaseResultsJson: JSON.stringify(phases), currentStage: `${phaseId}:${status}` } });
        void notifySpringScanStatus(id, "running", `${phaseId}:${status}`, undefined, phases);
        await callbacks.onPhase?.(phaseId, status, details);
      };
      const onStage = async (snapshot: { stage: string; evidenceId?: string }) => {
        const stage = snapshot.stage as ScanPhaseId;
        const scan = await store.scan.update({ where: { id }, data: { progress: ++progress } });
        await recordPhase(stage, "COVERED", snapshot.evidenceId ? { evidenceIds: [...(phases[stage]?.evidenceIds ?? []), snapshot.evidenceId] } : {});
        if (scan.cancelRequested) throw new Error("진단 중단");
        const nextStage = stage === "product" || stage === "cart" || stage === "checkout"
          ? nextPurchaseStage(stage, requested.purchasePath === "DIRECT" ? "DIRECT" : "CART")
          : undefined;
        if (nextStage && phases[nextStage]?.status === "PENDING") await recordPhase(nextStage, "RUNNING");
      };
      let report;
      const scanWithBrowser = (instance: typeof browser) => target.scenario === "public"
        ? requested.executionMode === "DYNAMIC" && proxy
          ? scanDynamicPublicShop(instance, target.url, directory, proxy.server, requested.viewport === "MOBILE" ? "MOBILE" : "DESKTOP", onStage, requested.purchasePath === "DIRECT" ? "DIRECT" : "CART", credentials, async (surface, status, details) => recordPhase(`surface:${surface}`, status, details), async (crawl) => {
            const now = Date.now();
            if (crawl.visited !== 0 && crawl.visited !== lastCrawlVisited && now - lastCrawlWriteAt < 1_000 && crawl.visited - lastCrawlVisited < 5) return;
            lastCrawlWriteAt = now;
            lastCrawlVisited = crawl.visited;
            const activity: ScanPhaseActivity = {
              visitedScreens: crawl.visited,
              discoveredScreens: crawl.discovered,
              pendingScreens: crawl.pending,
              visitedUrls: crawl.uniqueVisitedUrls,
              discoveredUrls: crawl.uniqueDiscoveredUrls,
              updatedAt: new Date(now).toISOString(),
            };
            await recordPhase("site-crawl", "RUNNING", {
              reason: `고유 URL ${crawl.uniqueVisitedUrls}/${crawl.uniqueDiscoveredUrls} · 화면 상태 ${crawl.visited}/${crawl.discovered} · 대기 ${crawl.pending} · 현재 ${crawl.currentUrl.slice(0, 180)}`,
              activity,
            });
          })
          : scanPublicShop(instance, target.url, directory, onStage, undefined, requested.viewport === "MOBILE" ? "MOBILE" : "DESKTOP", requested.purchasePath === "DIRECT" ? "DIRECT" : "CART")
        : scanDemo(instance, new URL(target.url).origin, target.scenario, directory, onStage, requested.viewport === "MOBILE" ? "MOBILE" : "DESKTOP", requested.purchasePath === "DIRECT" ? "DIRECT" : "CART");
      try {
        await recordPhase("product", "RUNNING");
        let scanPromise: Promise<any> = scanWithBrowser(browser);
        const dynamicTimeoutMs = requested.executionMode === "DYNAMIC"
          ? Math.min(Math.max(Number(process.env.DYNAMIC_SCAN_TIMEOUT_MS ?? 270_000), 30_000), 270_000)
          : 0;
        let dynamicTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          report = dynamicTimeoutMs
            ? await Promise.race([
              scanPromise,
              new Promise<never>((_, reject) => { dynamicTimer = setTimeout(() => reject(new Error(`동적 전체 탐색 시간 초과(${dynamicTimeoutMs}ms)`)), dynamicTimeoutMs); }),
            ])
            : await scanPromise;
        } finally {
          if (dynamicTimer) clearTimeout(dynamicTimer);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (requested.executionMode === "STATIC" && /browser|context|Target\.createBrowserContext/i.test(message)) {
          await browser.close().catch(() => {});
          browser = await chromium.launch(browserLaunchOptions);
          report = await scanWithBrowser(browser);
        } else {
        if (requested.executionMode !== "DYNAMIC") throw error;
        const dynamicMessage = message || "동적 구매 흐름을 수집하지 못했습니다.";
        report = {
          comparisonVersion: scanComparisonVersion,
          // No snapshot, crawl page, or observation survived this exception,
          // so a partial result would imply evidence that the report does not have.
          scanStatus: "FAILED" as const, executionMode: "DYNAMIC" as const,
          authContext: "UNKNOWN" as const,
          viewport: requested.viewport === "MOBILE" ? "MOBILE" as const : "DESKTOP" as const,
          purchasePath: requested.purchasePath === "DIRECT" ? "DIRECT" as const : "CART" as const,
          scenario: "public" as const, targetUrl, snapshots: [], interactions: [],
          explorationBlocker: null, networkPriceEvidence: [], priceLedger: buildPriceLedger([]), findings: [],
          collectionFailure: dynamicMessage,
          collectionFailureCode: classifyDynamicFailure(dynamicMessage),
        };
        await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
        }
      }
      // Keep the report and database duration identical so smoke tests and the
      // UI can explain where time was spent without relying on a second clock.
      report = { ...report, durationMs: Date.now() - startedAt };
      const snapshots = report.snapshots ?? [];
      const failedBeforeEvidence = report.scanStatus === "FAILED" && snapshots.length === 0
        && !(report.surfaceObservations ?? []).some((item: { outcome: string }) => item.outcome === "OBSERVED")
        && !(report.siteCrawl?.pages ?? []).length;
      let failureRecorded = false;
      for (const stage of ["product", "cart", "checkout"] as const) {
        const evidence = snapshots.filter((item: { stage: string }) => item.stage === stage);
        if (evidence.length) {
          if (phases[stage]?.status !== "COVERED") await recordPhase(stage, "COVERED", { evidenceIds: evidence.map((item: { evidenceId?: string }) => item.evidenceId).filter(Boolean) as string[] });
        } else if (phases[stage]?.status !== "SKIPPED") {
          if (failedBeforeEvidence) {
            const firstFailure: boolean = !failureRecorded;
            failureRecorded = failureRecorded || firstFailure;
            await recordPhase(stage, firstFailure ? "FAILED" : "SKIPPED", {
              reason: firstFailure ? report.collectionFailure ?? "진단이 증거를 수집하기 전에 실패했습니다."
                : "앞 단계에서 진단이 실패해 이 단계는 시작하지 않았습니다.",
            });
          } else await recordPhase(stage, report.explorationBlocker?.stage === stage ? "BLOCKED" : "NOT_FOUND", { reason: report.explorationBlocker?.stage === stage ? report.explorationBlocker.code : stage === "cart" && report.explorationBlocker?.action === "ADD_TO_CART"
            ? `상품 화면에서 장바구니 담기 동작을 하나로 확정하지 못했습니다(${report.explorationBlocker.code}). 주문서는 바로 주문 경로로만 확인했습니다.`
            : "검사 중 이 단계의 화면에 도달하지 못했습니다." });
        }
      }
      for (const surface of ["CATALOG", "AUTH", "COUPON", "RECOMMENDATION", "SUBSCRIPTION", "CANCELLATION", "POLICY"] as const) {
        if (!phases[`surface:${surface}`] || phases[`surface:${surface}`]?.status === "SKIPPED") continue;
        if (failedBeforeEvidence) {
          await recordPhase(`surface:${surface}`, "SKIPPED", { reason: "진단이 화면 증거를 수집하기 전에 실패해 별도 영역 탐색을 시작하지 않았습니다." });
          continue;
        }
        const found = (report.surfaceObservations ?? []).filter((item: { kind: string }) => item.kind === surface);
        const inspected = found.find((item: { outcome: string }) => item.outcome === "OBSERVED");
        const discovered = found.find((item: { outcome: string }) => item.outcome === "DISCOVERED");
        const blocked = found.length > 0 && !inspected && !discovered;
        await recordPhase(`surface:${surface}`, inspected ? "COVERED" : discovered ? "DISCOVERED" : blocked ? "BLOCKED" : "NOT_FOUND", {
          reason: inspected ? undefined : discovered ? "화면 후보를 찾았지만 내부 상호작용 검사는 아직 미완료입니다." : blocked ? "접근이 제한되거나 경로를 읽지 못했습니다." : "정적 탐색 후보에서 이 영역을 찾지 못했습니다.",
          evidenceIds: found.map((item: { evidenceId: string }) => item.evidenceId),
        });
      }
      if (requested.executionMode === "DYNAMIC" && phases["site-crawl"]?.status !== "SKIPPED") {
        const crawl = report.siteCrawl as {
          complete?: boolean; pages?: { evidenceId: string }[];
          visitedUrlCount?: number; discoveredUrlCount?: number; visitedStateCount?: number; discoveredStateCount?: number;
          uniqueVisitedUrlCount?: number; uniqueDiscoveredUrlCount?: number;
          failedUrlCount?: number; pendingUrls?: string[]; skippedLinks?: { reason: string }[]; durationMs?: number; stopReason?: string;
        } | undefined;
        if (failedBeforeEvidence) {
          await recordPhase("site-crawl", "SKIPPED", { reason: "진단이 화면 증거를 수집하기 전에 실패해 사이트 크롤링을 시작하지 않았습니다." });
        } else {
          const complete = crawl?.complete === true;
          const pageEvidenceIds = (crawl?.pages ?? []).map(({ evidenceId }) => evidenceId);
          const failures = crawl?.failedUrlCount ?? 0;
          const pending = crawl?.pendingUrls?.length ?? 0;
          const visitedUrls = crawl?.uniqueVisitedUrlCount ?? 0;
          const discoveredUrls = crawl?.uniqueDiscoveredUrlCount ?? 0;
          const visitedStates = crawl?.visitedStateCount ?? crawl?.visitedUrlCount ?? 0;
          const discoveredStates = crawl?.discoveredStateCount ?? crawl?.discoveredUrlCount ?? 0;
          const reason = complete
            ? `발견된 안전 경로 큐 소진 · 고유 URL ${visitedUrls}/${discoveredUrls} · 화면 상태 ${visitedStates}/${discoveredStates} · 안전상 미방문 링크 ${crawl?.skippedLinks?.length ?? 0}개 · ${(crawl?.durationMs ?? 0)}ms`
            : `순회 미완료 · 고유 URL ${visitedUrls}/${discoveredUrls} · 화면 상태 ${visitedStates}/${discoveredStates} · 실패 ${failures} · 대기 ${pending} · ${crawl?.stopReason ?? "미완료 경로 존재"}`;
          await recordPhase("site-crawl", complete ? "COVERED" : failures > 0 && (crawl?.visitedUrlCount ?? 0) === 0 ? "FAILED" : "BLOCKED", {
            reason, evidenceIds: pageEvidenceIds,
          });
        }
      }
      report = { ...report, phaseResults: phases, ruleCoverage: buildRuleCoverage(report) };
      await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n");
      const finished = await store.scan.update({
        where: { id, status: "RUNNING", cancelRequested: false },
        data: {
          status: report.scanStatus,
          durationMs: Date.now() - startedAt,
          reportPath: join(directory, "report.json"),
          findings: { create: report.findings.map(({ type, status, stage, reason, ruleVersion }: { type: string; status: string; stage: string; reason: string; ruleVersion: number }) => ({
            type, status, stage, reason, ruleVersion,
          })) },
        },
      });
      await store.scan.update({ where: { id }, data: { credentialCiphertext: null } });
      await notifySpringScanStatus(id, report.scanStatus === "COMPLETED" ? "succeeded" : report.scanStatus === "FAILED" ? "failed" : "partial", undefined, JSON.stringify(report), phases);
      return finished.reportPath;
    } finally {
      clearTimeout(timeout);
      await proxy?.close().catch(() => {});
      // Cleanup after a report is already committed must not turn a successful
      // terminal state into a second, conflicting failure notification.
      await browser.close().catch(() => {});
      await store.scan.update({ where: { id }, data: { credentialCiphertext: null } }).catch(() => undefined);
    }
  } catch (error) {
    const cancelled = await store.scan.updateMany({
      where: { id, status: "RUNNING", cancelRequested: true },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count) {
      const scan = await store.scan.findUnique({ where: { id }, select: { purchasePath: true, executionMode: true, phaseResultsJson: true } }).catch(() => null);
      if (scan) {
        const phases = closeCancelledScanPhases(parseScanPhases(scan.phaseResultsJson,
          initialScanPhases(scan.purchasePath === "DIRECT" ? "DIRECT" : "CART", scan.executionMode === "DYNAMIC")));
        await store.scan.update({ where: { id }, data: { phaseResultsJson: JSON.stringify(phases), currentStage: "CANCELLED" } }).catch(() => undefined);
      }
      const cancelledScan = await store.scan.findUnique({ where: { id }, select: { phaseResultsJson: true } }).catch(() => null);
      const cancelledPhases = cancelledScan?.phaseResultsJson ? JSON.parse(cancelledScan.phaseResultsJson) as Record<string, unknown> : undefined;
      await notifySpringScanStatus(id, "cancelled", undefined, undefined, cancelledPhases); return null;
    }
    const message = error instanceof Error ? error.message : "진단 처리 중 알 수 없는 오류가 발생했습니다.";
    const existing = await store.scan.findUnique({
      where: { id },
      select: { status: true, scenario: true, executionMode: true, viewport: true, purchasePath: true, targetUrl: true, phaseResultsJson: true },
    }).catch(() => null);
    let failedPhasesForMirror: Record<string, unknown> | undefined;
    let failedReportForMirror: string | undefined;
    if (existing?.status === "RUNNING") {
      const dynamic = existing.executionMode === "DYNAMIC";
      const purchasePath = existing.purchasePath === "DIRECT" ? "DIRECT" : "CART";
      const phases = closeFailedScanPhases(
        parseScanPhases(existing.phaseResultsJson, initialScanPhases(purchasePath, dynamic)),
        message,
      );
      const reportPath = join(evidenceDirectory(id), "report.json");
      const preservedReport = await readFile(reportPath, "utf8")
        .then((contents) => JSON.parse(contents) as Record<string, any>)
        .catch(() => null);
      const failedReportBase = {
        ...preservedReport,
        comparisonVersion: scanComparisonVersion,
        scanStatus: "FAILED" as const,
        executionMode: existing.executionMode,
        authContext: preservedReport?.authContext ?? "UNKNOWN" as const,
        viewport: preservedReport?.viewport ?? (existing.viewport === "MOBILE" ? "MOBILE" as const : "DESKTOP" as const),
        purchasePath,
        scenario: existing.scenario,
        targetUrl: existing.targetUrl,
        durationMs: Date.now() - startedAt,
        snapshots: preservedReport?.snapshots ?? [], interactions: preservedReport?.interactions ?? [],
        explorationBlocker: preservedReport?.explorationBlocker ?? null,
        networkPriceEvidence: preservedReport?.networkPriceEvidence ?? [],
        priceLedger: preservedReport?.priceLedger ?? buildPriceLedger([]),
        findings: preservedReport?.findings ?? [],
        collectionFailure: message,
        collectionFailureCode: classifyDynamicFailure(message),
        phaseResults: phases,
      };
      const failedReport = { ...failedReportBase, ruleCoverage: buildRuleCoverage(failedReportBase) };
      failedPhasesForMirror = phases;
      failedReportForMirror = JSON.stringify(failedReport);
      await mkdir(evidenceDirectory(id), { recursive: true });
      await writeFile(reportPath, JSON.stringify(failedReport, null, 2) + "\n");
      await store.scan.updateMany({ where: { id, status: "RUNNING" }, data: {
        status: "FAILED", durationMs: Date.now() - startedAt,
        phaseResultsJson: JSON.stringify(phases), currentStage: `FAILED:${message.slice(0, 160)}`,
        reportPath,
      } });
    } else {
      await store.scan.updateMany({ where: { id, status: "RUNNING" }, data: { status: "FAILED", durationMs: Date.now() - startedAt } });
    }
    await notifySpringScanStatus(id, "failed", undefined, failedReportForMirror, failedPhasesForMirror);
    throw error;
  }
}
