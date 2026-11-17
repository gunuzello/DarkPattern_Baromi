import { createHash, randomUUID } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../src/db";
import { stages } from "../../../../src/demo";
import type { Stage } from "../../../../src/demo";
import { evidenceDirectory } from "../../../../src/evidence-directory";
import { deleteScanEvidence, readScanEvidence } from "../../../../src/object-storage";
import { scanTarget, demoOrigin } from "../../../../src/targets";
import { compareScans } from "../../../../src/scan-comparison";
import type { scanDemo } from "../../../../src/scan";
import type { Finding } from "../../../../src/rules";
import { fetchPublicHtml } from "../../../../src/public-html";
import { createSiteVerification, hashToken, matchesVerification, verificationDnsPrefix, verificationFile, verificationName } from "../../../../src/site-verification";
import { encryptCredentials } from "../../../../src/credential-vault";
import { deleteSpringScan, deleteSpringShop, listSpringShopScans, listSpringShops, mirrorSpringScan, mirrorSpringShop, notifySpringScanStatus, readSpringScan, readSpringShop, springAuthoritative, springReadiness } from "../../../../src/spring-status";
import { diagnosticSurfaceKinds, type DiagnosticSurfaceKind } from "../../../../src/diagnostic-surfaces";
import { scanStaleBefore } from "../../../../src/scan-timeout";
import { supabaseAuthEnabled, supabaseOwner } from "../../../../src/supabase-auth";
import { buildRuleCoverage, findingsForRuleCoverage, summarizeRuleCoverage, type RuleCoverage } from "../../../../src/rule-coverage";
import { buildAiCandidatePayload } from "../../../../src/ai-review-payload";
import { legalRules } from "../../../../src/legal-rules";
import { closeCancelledScanPhases, initialScanPhases, parseScanPhases } from "../../../../src/scan-phases";
import { cloudRunJobsEnabled, executeScanJob } from "../../../../src/cloud-run-jobs";

type Context = { params: Promise<{ path: string[] }> };
type Report = Omit<Awaited<ReturnType<typeof scanDemo>>, "scenario"> & { scenario: string; ruleCoverage?: RuleCoverage };
const cookie = "darkpattern-session";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeShopUrl = (value: string) => {
  const url = new URL(value);
  return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, "")}${url.search}`;
};
const error = (message: string, status: number) => Response.json({ error: message }, { status });
const normalizeScanStatus = (value: unknown) => {
  if (typeof value !== "string") return value;
  const normalized: Record<string, string> = {
    queued: "QUEUED", running: "RUNNING", partial: "PARTIAL", succeeded: "COMPLETED",
    completed: "COMPLETED", failed: "FAILED", cancelled: "CANCELLED",
  };
  return normalized[value.toLowerCase()] ?? value.toUpperCase();
};
const springProgress = (scan: Record<string, unknown>, status: string) => {
  const purchasePath = scan.purchasePath === "DIRECT" ? "DIRECT" : "CART";
  const required = purchasePath === "DIRECT" ? ["product", "checkout"] : stages;
  const phaseResults = typeof scan.phaseResults === "object" && scan.phaseResults !== null
    ? scan.phaseResults as Record<string, { status?: string }>
    : {};
  const active = status === "QUEUED" || status === "RUNNING";
  const coverage = Object.fromEntries(stages.map((stage) => [stage,
    !required.includes(stage) ? "SKIPPED" : phaseResults[stage]?.status ?? (active ? "PENDING" : "BLOCKED")]));
  const surfaceCoverage = Object.fromEntries(diagnosticSurfaceKinds.map((kind) => [kind,
    phaseResults[`surface:${kind}`]?.status ?? (active ? "PENDING" : "BLOCKED")]));
  const phaseValues = Object.values(phaseResults);
  const terminalCount = phaseValues.filter(({ status: phaseStatus }) => ["COVERED", "DISCOVERED", "NOT_FOUND", "BLOCKED", "FAILED", "SKIPPED"].includes(phaseStatus ?? "")).length;
  const progress = phaseValues.length ? Math.round(terminalCount * 100 / phaseValues.length) : 0;
  return {
    progress: active ? progress : 100,
    coverage,
    surfaceCoverage,
    phaseResults,
    // Spring exposes this as `reportAvailable`; keep the public Node API
    // contract consistent with the SQLite-backed `hasReport` field.
    hasReport: Boolean(scan.reportAvailable ?? scan.hasReport),
  };
};
const notFound = () => error("요청한 항목을 찾을 수 없습니다.", 404);
const rateBuckets = new Map<string, number[]>();
const hasInvalidBearer = async (request: NextRequest) => {
  const authorization = request.headers.get("authorization");
  return Boolean(authorization?.startsWith("Bearer ") && !await supabaseOwner(request));
};
const rateLimit = (request: NextRequest, key: string, limit: number, windowMs: number) => {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucketKey = `${address}:${key}`;
  const now = Date.now();
  const recent = (rateBuckets.get(bucketKey) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) return Response.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, {
    status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) },
  });
  recent.push(now);
  rateBuckets.set(bucketKey, recent);
  return null;
};

async function getReport(path: string | null): Promise<Report | null> {
  if (!path) return null;
  if (path.startsWith("db:")) {
    const scan = await db().scan.findUnique({ where: { id: path.slice(3) }, select: { reportJson: true } });
    return scan?.reportJson ? JSON.parse(scan.reportJson) as Report : null;
  }
  return JSON.parse(await readFile(path, "utf8")) as Report;
}

function serializeAiReview(review: {
  id: string; status: string; requestedAt: Date; completedAt: Date | null; provider: string | null; model: string | null;
  candidateCount: number; durationMs: number | null; error: string | null; resultJson: string | null; usageJson: string | null; operatorLabelsJson: string | null;
} | null) {
  return review ? {
    id: review.id, status: review.status, requestedAt: review.requestedAt,
    completedAt: review.completedAt, provider: review.provider, model: review.model,
    candidateCount: review.candidateCount, durationMs: review.durationMs, error: review.error,
    result: review.resultJson ? JSON.parse(review.resultJson) : null,
    usage: review.usageJson ? JSON.parse(review.usageJson) : null,
    operatorLabels: review.operatorLabelsJson ? JSON.parse(review.operatorLabelsJson) : null,
  } : null;
}

function ruleScreenshotRefs(report: Report, coverage: RuleCoverage, scanId: string) {
  return Object.fromEntries(Object.entries(coverage).map(([type, rule]) => [type,
    report.snapshots.filter((snapshot) => snapshot.screenshot && rule.evidenceIds.includes(snapshot.evidenceId ?? `evidence:${snapshot.stage}`))
      .map((snapshot) => ({ evidenceId: snapshot.evidenceId ?? `evidence:${snapshot.stage}`, url: `/api/v1/evidences/${scanId}-${snapshot.stage}` }))]));
}

async function normalizeSpringReport(raw: Record<string, unknown>, scanId: string, ownerHash: string) {
  const report = typeof raw.reportJson === "string" ? JSON.parse(raw.reportJson) as Record<string, unknown> : raw;
  const local = await db().scan.findFirst({
    where: { id: scanId, shop: { ownerHash } },
    include: { findings: { orderBy: { id: "asc" } }, aiReview: true, shop: { select: { plan: true } } },
  }).catch(() => null);
  const baseline = local?.baselineScanId ? await db().scan.findFirst({
    where: { id: local.baselineScanId, shopId: local.shopId, shop: { ownerHash } },
    select: { reportPath: true },
  }) : null;
  const baselineReport = await getReport(baseline?.reportPath ?? null).catch(() => null);
  const evidence = report as unknown as Parameters<typeof buildRuleCoverage>[0];
  // Recompute from the stored observations so legacy reports cannot leak a
  // partial/stale rule map that omits decisionMode, reason, or evidence IDs.
  const ruleCoverage = buildRuleCoverage({
    ...evidence,
    findings: Array.isArray(report.findings) ? report.findings as Parameters<typeof buildRuleCoverage>[0]["findings"] : [],
    snapshots: Array.isArray(report.snapshots) ? report.snapshots as Parameters<typeof buildRuleCoverage>[0]["snapshots"] : [],
    surfaceObservations: Array.isArray(report.surfaceObservations) ? report.surfaceObservations as Parameters<typeof buildRuleCoverage>[0]["surfaceObservations"] : [],
    reviewCandidates: Array.isArray(report.reviewCandidates) ? report.reviewCandidates as Parameters<typeof buildRuleCoverage>[0]["reviewCandidates"] : [],
    authContext: report.authContext === "ANONYMOUS" || report.authContext === "TEST_ACCOUNT" ? report.authContext : "UNKNOWN",
  });
  const phaseResults = report.phaseResults ?? (local?.phaseResultsJson ? JSON.parse(local.phaseResultsJson) : {});
  const purchasePath = report.purchasePath === "DIRECT" ? "DIRECT" : "CART";
  const requiredStages = purchasePath === "DIRECT" ? ["product", "checkout"] : stages;
  const snapshots = Array.isArray(report.snapshots) ? report.snapshots as { stage: string }[] : [];
  const observedStages = new Set(snapshots.map(({ stage }) => stage));
  const coverage = Object.fromEntries(stages.map((stage) => [stage,
    observedStages.has(stage) ? "COVERED" : !requiredStages.includes(stage) ? "SKIPPED" : "BLOCKED"]));
  const surfaceObservations = Array.isArray(report.surfaceObservations)
    ? report.surfaceObservations as { kind: DiagnosticSurfaceKind; outcome: string }[] : [];
  const surfaceCoverage = Object.fromEntries(diagnosticSurfaceKinds.map((kind) => {
    if (report.executionMode !== "DYNAMIC") return [kind, "SKIPPED"];
    const observations = surfaceObservations.filter((item) => item.kind === kind);
    return [kind, observations.some((item) => item.outcome === "OBSERVED") ? "COVERED"
      : observations.some((item) => item.outcome === "DISCOVERED") ? "DISCOVERED"
        : observations.length ? "BLOCKED" : "NOT_FOUND"];
  }));
  const reportFindings = Array.isArray(report.findings) ? report.findings as Record<string, unknown>[] : [];
  const findings = local ? local.findings.map((stored, index) => ({
    ...(reportFindings[index] ?? {}), id: stored.id, type: stored.type, status: stored.status,
    stage: stored.stage, reason: stored.reason, ruleVersion: stored.ruleVersion,
  })) : reportFindings;
  const summary = summarizeRuleCoverage(ruleCoverage);
  const aiReviewCandidateCount = buildAiCandidatePayload(report as Parameters<typeof buildAiCandidatePayload>[0]).length;
  const comparison = local?.baselineScanId ? {
    baselineScanId: local.baselineScanId,
    ...(baselineReport ? compareScans(baselineReport, report as unknown as Parameters<typeof compareScans>[1])
      : { status: "UNAVAILABLE" as const, reason: "기준 보고서를 읽을 수 없습니다." }),
  } : report.comparison ?? null;
  return {
    ...report,
    scanId,
    shopId: report.shopId ?? local?.shopId ?? null,
    scanStatus: normalizeScanStatus(report.scanStatus ?? local?.status ?? raw.status),
    executionMode: report.executionMode ?? local?.executionMode ?? raw.executionMode,
    viewport: report.viewport ?? local?.viewport ?? raw.viewport,
    purchasePath,
    durationMs: report.durationMs ?? local?.durationMs ?? null,
    phaseResults, coverage, surfaceCoverage, ruleCoverage, ruleScreenshotRefs: ruleScreenshotRefs(report as Report, ruleCoverage, scanId), summary, findings: findingsForRuleCoverage(findings as Finding[], ruleCoverage),
    comparison,
    aiEligible: true,
    aiReviewCandidateCount,
    aiReview: serializeAiReview(local?.aiReview ?? null),
    source: "SPRING_POSTGRES",
  };
}

export async function POST(request: NextRequest, context: Context) {
  const route = (await context.params).path;
  if (await hasInvalidBearer(request)) return error("유효하지 않은 인증 토큰입니다.", 401);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return error("JSON 요청이 필요합니다.", 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64 * 1024) return error("요청 본문이 너무 큽니다.", 413);
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([
    new URL(demoOrigin()).origin,
    ...(process.env.BAROMI_WEB_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  ]);
  if (origin && !allowedOrigins.has(origin)) return error("동일 출처 요청이 필요합니다.", 403);
  const body = await request.json().catch(() => null);
  const jwtOwner = await supabaseOwner(request);
  const session = jwtOwner ?? request.cookies.get(cookie)?.value;

  if (route.join("/") === "shops") {
    if (supabaseAuthEnabled() && !jwtOwner) return error("쇼핑몰을 등록하려면 Supabase 로그인이 필요합니다.", 401);
    const limited = rateLimit(request, "shops", 20, 60 * 60 * 1000);
    if (limited) return limited;
    const target = scanTarget(body?.url);
    if (body?.consent !== true || !target) {
      return error("공개 HTTPS 쇼핑몰 URL과 검사 동의가 필요합니다.", 400);
    }
    if (body?.nickname !== undefined && (typeof body.nickname !== "string" || body.nickname.trim().length > 80)) {
      return error("쇼핑몰 이름은 80자 이내로 입력해 주세요.", 400);
    }
    const token = session ?? randomUUID();
    if (springAuthoritative()) {
      let existing: Record<string, unknown> | null;
      try { existing = await listSpringShops(token, 100); }
      catch (cause) { return error(cause instanceof Error ? cause.message : "쇼핑몰 목록을 확인하지 못했습니다.", 503); }
      const match = (existing?.shops as { shopId: string; url: string; nickname?: string | null; verifiedAt?: string | null }[] | undefined)
        ?.find((item) => normalizeShopUrl(item.url) === normalizeShopUrl(target.url));
      if (match) return Response.json({ shopId: match.shopId, url: match.url, nickname: match.nickname ?? null, verifiedAt: match.verifiedAt ?? null, existing: true, verification: null });
    } else {
      const existing = await db().shop.findMany({ where: { ownerHash: hash(token) }, select: { id: true, url: true, nickname: true, verifiedAt: true } });
      const match = existing.find((item) => normalizeShopUrl(item.url) === normalizeShopUrl(target.url));
      if (match) return Response.json({ shopId: match.id, url: match.url, nickname: match.nickname, verifiedAt: match.verifiedAt, existing: true, verification: null });
    }
    const verification = createSiteVerification();
    const shop = await db().shop.create({
      data: { id: randomUUID(), url: target.url, ownerHash: hash(token), verificationHash: verification.hash, nickname: typeof body?.nickname === "string" && body.nickname.trim() ? body.nickname.trim().slice(0, 80) : null },
    });
    const response = NextResponse.json({
      shopId: shop.id, url: shop.url, nickname: shop.nickname, verifiedAt: shop.verifiedAt,
      verification: target.scenario === "public" ? {
        name: verificationName, token: verification.token,
        metaTag: `<meta name="${verificationName}" content="${verification.token}">`,
        filePath: `/${verificationFile}`,
        dnsRecord: `${verificationDnsPrefix}.${new URL(shop.url).hostname} TXT ${verification.token}`,
      } : null,
    }, { status: 201 });
    if (!await mirrorSpringShop(shop.id, shop.url, token, shop.nickname) && springAuthoritative()) {
      await db().shop.delete({ where: { id: shop.id } }).catch(() => undefined);
      return error("최종 상태 저장소에 연결할 수 없어 상점을 등록하지 못했습니다.", 503);
    }
    if (!session && !jwtOwner) response.cookies.set(cookie, token, {
      httpOnly: true, sameSite: "strict", path: "/", maxAge: 24 * 60 * 60,
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  }

  if (!session) return supabaseAuthEnabled() ? error("로그인이 필요합니다.", 401) : notFound();
  const ownerHash = hash(session);
  if (route[0] === "shops" && route[1] && route[2] === "verify" && route.length === 3) {
    const shop = await db().shop.findFirst({ where: { id: route[1], ownerHash } });
    if (!shop) return notFound();
    if (!shop.verificationHash) return error("확인 값을 다시 발급해 주세요.", 409);
    const target = scanTarget(shop.url);
    if (!target) return error("지원하는 쇼핑몰 주소가 아닙니다.", 400);
    if (target.scenario !== "public") {
      const verifiedAt = new Date();
      await db().shop.update({ where: { id: shop.id }, data: { verifiedAt } });
      return Response.json({ verified: true, verifiedAt });
    }
    // Prove control of the storefront itself, not merely a user-supplied deep URL.
    const verificationUrl = new URL("/", shop.url).href;
    const document = await fetchPublicHtml(verificationUrl).catch(() => null);
    let verifiedBy: "meta" | "file" | "dns" | null = document && matchesVerification(document.html, shop.verificationHash) ? "meta" : null;
    if (!verifiedBy) {
      const fileUrl = new URL(`/${verificationFile}`, shop.url).href;
      const fileToken = await fetch(fileUrl, { redirect: "manual", signal: AbortSignal.timeout(8000) })
        .then(async (response) => response.ok ? (await response.text()).trim() : null).catch(() => null);
      if (fileToken && fileToken.length <= 256 && /^[A-Za-z0-9_-]+$/.test(fileToken) && hashToken(fileToken) === shop.verificationHash) verifiedBy = "file";
    }
    if (!verifiedBy) {
      const hostname = new URL(shop.url).hostname;
      const txt = await resolveTxt(`${verificationDnsPrefix}.${hostname}`).catch(() => [] as string[][]);
      const values = txt.flat().map((value) => value.trim());
      if (values.some((value) => value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value) && hashToken(value) === shop.verificationHash)) verifiedBy = "dns";
    }
    if (!verifiedBy) return error(`메타 태그, ${verificationFile} 파일 또는 DNS TXT에서 확인 값을 찾지 못했습니다.`, 409);
    const verified = await db().shop.update({ where: { id: shop.id }, data: { verifiedAt: new Date() } });
    return Response.json({ verified: true, verifiedAt: verified.verifiedAt, method: verifiedBy });
  }
  if (route.join("/") === "scans" && typeof body?.shopId === "string") {
    const limited = rateLimit(request, "scans", 30, 60 * 60 * 1000);
    if (limited) return limited;
    const shop = await db().shop.findFirst({ where: { id: body.shopId, ownerHash } });
    if (!shop) return notFound();
    const target = scanTarget(shop.url);
    if (!target) return error("지원하는 쇼핑몰 주소가 아닙니다.", 400);
    if (body.purchasePath !== undefined && !["CART", "DIRECT"].includes(body.purchasePath)) {
      return error("구매 경로는 CART 또는 DIRECT여야 합니다.", 400);
    }
    const credentials = body.credentials;
    if (credentials !== undefined && (body.profile !== "DYNAMIC" || typeof credentials !== "object" ||
        typeof credentials.username !== "string" || typeof credentials.password !== "string")) {
      return error("테스트 계정은 동적 진단에서만 username/password 형식으로 제공해야 합니다.", 400);
    }
    let credentialCiphertext: string | undefined;
    if (body.profile === "DYNAMIC" && credentials) {
      try { credentialCiphertext = encryptCredentials(credentials); }
      catch (cause) { return error(cause instanceof Error ? cause.message : "테스트 계정을 보호할 수 없습니다.", 503); }
    }
    const purchasePath = body.purchasePath === "DIRECT" ? "DIRECT" : "CART";
    if (!["CONTEST", "DYNAMIC"].includes(body.profile) || !["DESKTOP", "MOBILE"].includes(body.viewport) ||
        !Array.isArray(body.flows) || body.flows.length !== 1 || body.flows[0] !== "PURCHASE" ||
        body.productLimit !== 1) {
      return error("PC 또는 모바일 구매 흐름에서 상품 1개를 진단할 수 있습니다.", 400);
    }
    if (body.profile === "DYNAMIC" && (target.scenario !== "public" || (!shop.verifiedAt && !body.credentials))) {
      return error("사이트 확인을 마친 외부 쇼핑몰만 동적 진단할 수 있습니다.", 409);
    }
    const baselineScanId = body.baselineScanId;
    if (baselineScanId !== undefined) {
      if (typeof baselineScanId !== "string") return error("기준 진단 ID를 확인해 주세요.", 400);
      const baseline = await db().scan.findFirst({
        where: {
          id: baselineScanId, shopId: shop.id, targetUrl: target.url, scenario: target.scenario,
          viewport: body.viewport, purchasePath,
          status: { in: ["COMPLETED", "PARTIAL"] }, reportPath: { not: null },
        },
        select: { id: true },
      });
      if (!baseline) return notFound();
    }
    if (baselineScanId === undefined) {
      const existing = await db().scan.findFirst({
        where: {
          shopId: shop.id, targetUrl: target.url, scenario: target.scenario,
          executionMode: body.profile === "DYNAMIC" ? "DYNAMIC" : "STATIC",
          viewport: body.viewport, purchasePath, status: { in: ["QUEUED", "RUNNING"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true },
      });
      if (existing) return Response.json({ scanId: existing.id, status: existing.status, createdAt: existing.createdAt, deduplicated: true }, { status: 202 });
    }
    const scan = await db().scan.create({
      data: {
        id: randomUUID(), shopId: shop.id, targetUrl: target.url, scenario: target.scenario,
        executionMode: body.profile === "DYNAMIC" ? "DYNAMIC" : "STATIC", viewport: body.viewport,
        purchasePath,
        credentialCiphertext,
        baselineScanId, status: "QUEUED",
      },
    });
    // During the Spring migration, mirror the queue state without making the
    // legacy SQLite path depend on the new service being available.
    if (!await mirrorSpringScan({ id: scan.id, shopId: shop.id, targetUrl: target.url, executionMode: body.profile === "DYNAMIC" ? "DYNAMIC" : "STATIC", viewport: body.viewport, purchasePath }, session!) && springAuthoritative()) {
      await db().scan.delete({ where: { id: scan.id } }).catch(() => undefined);
      return error("최종 상태 저장소에 연결할 수 없어 진단을 시작하지 못했습니다.", 503);
    }
    await notifySpringScanStatus(scan.id, "queued");
    if (cloudRunJobsEnabled()) {
      try {
        await executeScanJob(scan.id);
      } catch (cause) {
        console.error("Cloud Run Job dispatch failed", cause);
        await db().scan.updateMany({
          where: { id: scan.id, status: "QUEUED" },
          data: { status: "FAILED", durationMs: 0, currentStage: "FAILED:WORKER_DISPATCH" },
        }).catch(() => undefined);
        return error("진단 작업 서버를 시작하지 못했습니다. 배포 설정을 확인해 주세요.", 503);
      }
    }
    return Response.json({ scanId: scan.id, status: scan.status, createdAt: scan.createdAt }, { status: 202 });
  }

  const [resource, id, action] = route;
  if (resource === "scans" && id && action === "ai-review" && route.length === 3) {
    const limited = rateLimit(request, "ai-review", 10, 60 * 60 * 1000);
    if (limited) return limited;
    const scan = await db().scan.findFirst({
      where: { id, shop: { ownerHash }, status: { in: ["COMPLETED", "PARTIAL"] }, reportPath: { not: null } },
      select: { reportPath: true, aiReview: true },
    });
    if (!scan?.reportPath) return notFound();
    const selected = body?.selectedRuleTypes;
    if (!Array.isArray(selected) || !selected.length || selected.length > 16 || selected.some((type: unknown) => typeof type !== "string" || !Object.hasOwn(legalRules, type)) || new Set(selected).size !== selected.length) return error("서로 다른 진단 유형을 1~16개 선택해 주세요.", 400);
    if (scan.aiReview?.status === "QUEUED" || scan.aiReview?.status === "RUNNING") return Response.json({ id: scan.aiReview.id, status: scan.aiReview.status }, { status: 202 });
    const report = await getReport(scan.reportPath);
    if (!report) return error("기본 보고서를 읽을 수 없습니다.", 409);
    const previous = scan.aiReview?.resultJson ? JSON.parse(scan.aiReview.resultJson) as { results?: { ruleType: string; status?: string }[] } : null;
    const alreadyDone = new Set(previous?.results?.filter((item) => item.status === "COMPLETED" || item.status === "INSUFFICIENT_DATA").map((item) => item.ruleType) ?? []);
    const pending = (selected as (keyof typeof legalRules)[]).filter((type) => !alreadyDone.has(type));
    if (!pending.length) return Response.json({ id: scan.aiReview?.id, status: "COMPLETED", selectedRuleTypes: selected }, { status: 200 });
    const job = await db().aiReview.upsert({
      where: { scanId: id },
      create: { id: randomUUID(), scanId: id, status: "QUEUED", candidateCount: pending.length, resultJson: JSON.stringify({ selectedRuleTypes: pending, pendingRuleTypes: pending, results: [] }) },
      update: { status: "QUEUED", requestedAt: new Date(), startedAt: null, completedAt: null, resultJson: JSON.stringify({ ...previous, selectedRuleTypes: pending, pendingRuleTypes: pending, transientRetryAttempted: false, results: previous?.results ?? [] }), error: null, candidateCount: pending.length },
    });
    if (cloudRunJobsEnabled()) {
      try { await executeScanJob(`ai:${job.id}`); }
      catch {
        await db().aiReview.update({ where: { id: job.id }, data: { status: "FAILED", completedAt: new Date(), error: "AI 작업을 시작하지 못했습니다." } });
        return error("AI 작업을 시작하지 못했습니다.", 503);
      }
    }
    return Response.json({ id: job.id, status: job.status, selectedRuleTypes: pending, candidateCount: job.candidateCount }, { status: 202 });
  }
  if (resource === "scans" && id && action === "ai-review-labels" && route.length === 3) {
    const scan = await db().scan.findFirst({ where: { id, shop: { ownerHash } }, select: { aiReview: true, reportPath: true } });
    if (!scan?.aiReview) return notFound();
    const labels = body?.labels;
    const candidateIds = new Set((((await getReport(scan.reportPath)) as unknown as { reviewCandidates?: { id?: string }[] } | null)?.reviewCandidates ?? []).map((candidate) => candidate.id).filter((value): value is string => Boolean(value)));
    const seenCandidateIds = new Set<string>();
    if (!Array.isArray(labels) || labels.length > 40 || labels.some((item: unknown) => {
      const candidateId = item && typeof item === "object" ? (item as { candidateId?: unknown }).candidateId : undefined;
      const valid = Boolean(item && typeof item === "object" && typeof candidateId === "string" && candidateIds.has(candidateId) && !seenCandidateIds.has(candidateId) && ["LIKELY_RISK", "NEEDS_REVIEW", "LIKELY_BENIGN", "INSUFFICIENT_EVIDENCE"].includes((item as { label?: string }).label ?? "") && ((item as { adjudication?: unknown }).adjudication === undefined || ["PENDING", "AGREED"].includes((item as { adjudication?: string }).adjudication ?? "")));
      if (typeof candidateId === "string") seenCandidateIds.add(candidateId);
      return !valid;
    })) {
      return error("후보 ID와 허용된 라벨이 필요합니다.", 400);
    }
    const normalizedLabels = labels.map((item: { candidateId: string; label: string; adjudication?: "PENDING" | "AGREED" }) => ({ ...item, adjudication: item.adjudication ?? "PENDING" }));
    const saved = await db().aiReview.update({ where: { id: scan.aiReview.id }, data: { operatorLabelsJson: JSON.stringify(normalizedLabels), labeledAt: new Date(), labelSource: "OPERATOR" } });
    return Response.json({ id: saved.id, status: saved.status, labeledAt: saved.labeledAt });
  }
  if (resource === "scans" && id && action === "cancel" && route.length === 3) {
    const where = { id, shop: { ownerHash } };
    const running = await db().scan.updateMany({
      where: { ...where, status: "RUNNING" }, data: { cancelRequested: true },
    });
    if (running.count) return Response.json({ status: "RUNNING", cancelRequested: true }, { status: 202 });
    const queued = await db().scan.updateMany({
      where: { ...where, status: "QUEUED" }, data: { status: "CANCELLED", credentialCiphertext: null },
    });
    if (queued.count) {
      const scan = await db().scan.findUnique({ where: { id }, select: { purchasePath: true, executionMode: true, phaseResultsJson: true } });
      if (scan) {
        const phases = closeCancelledScanPhases(parseScanPhases(scan.phaseResultsJson,
          initialScanPhases(scan.purchasePath === "DIRECT" ? "DIRECT" : "CART", scan.executionMode === "DYNAMIC")));
        await db().scan.update({ where: { id }, data: { phaseResultsJson: JSON.stringify(phases), currentStage: "CANCELLED" } });
      }
      return Response.json({ status: "CANCELLED" });
    }
    const scan = await db().scan.findFirst({ where, select: { status: true } });
    if (scan?.status === "RUNNING") {
      const changed = await db().scan.updateMany({
        where: { ...where, status: "RUNNING" }, data: { cancelRequested: true },
      });
      if (changed.count) return Response.json({ status: "RUNNING", cancelRequested: true }, { status: 202 });
    }
    return scan ? error("진단이 이미 종료됐습니다.", 409) : notFound();
  }
  return notFound();
}

export async function PATCH(request: NextRequest, context: Context) {
  const route = (await context.params).path;
  if (route.length !== 2 || route[0] !== "shops" || !route[1]) return notFound();
  if (await hasInvalidBearer(request)) return error("유효하지 않은 인증 토큰입니다.", 401);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return error("JSON 요청이 필요합니다.", 415);
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([
    new URL(demoOrigin()).origin,
    ...(process.env.BAROMI_WEB_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  ]);
  if (origin && !allowedOrigins.has(origin)) return error("동일 출처 요청이 필요합니다.", 403);
  const jwtOwner = await supabaseOwner(request);
  const session = jwtOwner ?? request.cookies.get(cookie)?.value;
  if (!session) return supabaseAuthEnabled() ? error("로그인이 필요합니다.", 401) : notFound();
  const body = await request.json().catch(() => null);
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  if (!nickname || nickname.length > 80) return error("쇼핑몰 이름은 1~80자로 입력해 주세요.", 400);

  if (springAuthoritative()) {
    const base = process.env.BAROMI_SPRING_API_URL?.replace(/\/$/, "");
    if (!base) return error("최종 저장소에 연결할 수 없습니다.", 503);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const result = await fetch(`${base}/api/v1/shops/${encodeURIComponent(route[1])}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-baromi-owner": session },
        body: JSON.stringify({ nickname }),
        signal: controller.signal,
      });
      return new Response(result.body, { status: result.status, headers: { "content-type": result.headers.get("content-type") ?? "application/json" } });
    } catch {
      return error("쇼핑몰 이름을 저장소에 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503);
    } finally {
      clearTimeout(timeout);
    }
  }

  const shop = await db().shop.findFirst({ where: { id: route[1], ownerHash: hash(session) } });
  if (!shop) return notFound();
  return Response.json(await db().shop.update({ where: { id: shop.id }, data: { nickname } }));
}

export async function GET(request: NextRequest, context: Context) {
  const route = (await context.params).path;
  if (route.join("/") === "health") {
    try {
      await db().$queryRaw`SELECT 1`;
      const spring = await springReadiness();
      const [queued, running, stale] = await Promise.all([
        db().scan.count({ where: { status: "QUEUED" } }),
        db().scan.count({ where: { status: "RUNNING" } }),
        db().scan.count({ where: { status: "RUNNING", startedAt: { lt: scanStaleBefore() } } }),
      ]);
      const healthy = stale === 0 && spring.ready;
      return Response.json({
        status: healthy ? "ok" : "degraded", service: "baromi", version: process.env.APP_VERSION ?? "0.1.0",
        storage: { mode: spring.configured ? "SPRING_POSTGRES" : "SQLITE_TRANSITION", spring: spring.ready ? "ready" : "unavailable" },
        worker: { queued, running, stale },
      }, { status: healthy ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return error("데이터베이스를 사용할 수 없습니다.", 503);
    }
  }
  if (await hasInvalidBearer(request)) return error("유효하지 않은 인증 토큰입니다.", 401);
  const session = await supabaseOwner(request) ?? request.cookies.get(cookie)?.value;
  if (!session) return supabaseAuthEnabled() ? error("로그인이 필요합니다.", 401) : notFound();
  const ownerHash = hash(session);
  if (route.join("/") === "shops") {
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 100) : 50;
    if (springAuthoritative()) {
      try {
        const spring = await listSpringShops(session, limit);
        if (spring) return Response.json(spring, { headers: { "Cache-Control": "private, no-store" } });
      } catch (cause) { return error(cause instanceof Error ? cause.message : "Spring 상태 저장소에 연결할 수 없습니다.", 503); }
    }
    const allShops = await db().shop.findMany({
      where: { ownerHash }, orderBy: { consentAt: "asc" },
      select: { id: true, url: true, nickname: true },
    });
    const keepers = new Map<string, (typeof allShops)[number]>();
    for (const shop of allShops) {
      const key = normalizeShopUrl(shop.url);
      const keeper = keepers.get(key);
      if (!keeper) { keepers.set(key, shop); continue; }
      await db().$transaction(async (tx) => {
        await tx.scan.updateMany({ where: { shopId: shop.id }, data: { shopId: keeper.id } });
        if (!keeper.nickname && shop.nickname) await tx.shop.update({ where: { id: keeper.id }, data: { nickname: shop.nickname } });
        await tx.shop.delete({ where: { id: shop.id } });
      });
      if (!keeper.nickname && shop.nickname) keeper.nickname = shop.nickname;
    }
    const shops = await db().shop.findMany({
      where: { ownerHash }, orderBy: { consentAt: "desc" }, take: limit,
      select: { id: true, url: true, nickname: true, consentAt: true, verifiedAt: true },
    });
    return Response.json({ limit, shops: shops.map((shop) => ({
      shopId: shop.id, url: shop.url, nickname: shop.nickname, consentAt: shop.consentAt, verifiedAt: shop.verifiedAt,
    })) });
  }
  const [resource, id, action, ...extra] = route;
  if (!id || extra.length) return notFound();

  if (resource === "shops" && action === "scans" && route.length === 3) {
    if (springAuthoritative()) {
      try {
        const spring = await listSpringShopScans(id, session);
        if (spring) return Response.json(spring, { headers: { "Cache-Control": "private, no-store" } });
      } catch (cause) { return error(cause instanceof Error ? cause.message : "Spring 상태 저장소에 연결할 수 없습니다.", 503); }
    }
    const shop = await db().shop.findFirst({ where: { id, ownerHash }, select: { id: true } });
    if (!shop) return notFound();
    const scans = await db().scan.findMany({
      where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 50,
      include: { findings: { select: { status: true } } },
    });
    return Response.json(await Promise.all(scans.map(async (scan) => {
      const report = await getReport(scan.reportPath);
      const ruleCoverage = report
        ? buildRuleCoverage({ ...report, reviewCandidates: [...(report.reviewCandidates ?? [])] })
        : null;
      const finalSummary = ruleCoverage ? summarizeRuleCoverage(ruleCoverage) : null;
      const notTested = finalSummary?.notTested ?? 0;
      return {
      scanId: scan.id, status: scan.status, executionMode: scan.executionMode,
      viewport: scan.viewport, purchasePath: scan.purchasePath, createdAt: scan.createdAt,
      durationMs: scan.durationMs,
      summary: {
        suspected: finalSummary?.suspected ?? scan.findings.filter((finding) => finding.status === "SUSPECTED").length,
        reviewNeeded: finalSummary?.reviewNeeded ?? scan.findings.filter((finding) => finding.status === "REVIEW_NEEDED").length,
        notTested,
      },
      reportAvailable: Boolean(report),
      };
    })));
  }
  if (resource === "shops" && !action) {
    if (springAuthoritative()) {
      try {
        const spring = await readSpringShop(id, session);
        if (spring) return Response.json(spring, { headers: { "Cache-Control": "private, no-store" } });
      } catch (cause) { return error(cause instanceof Error ? cause.message : "Spring 상태 저장소에 연결할 수 없습니다.", 503); }
    }
    const shop = await db().shop.findFirst({
      where: { id, ownerHash }, select: { id: true, url: true, nickname: true, consentAt: true, verifiedAt: true },
    });
    return shop ? Response.json(shop) : notFound();
  }
  if (resource === "findings" && !action && /^\d{1,9}$/.test(id)) {
    const finding = await db().finding.findFirst({ where: { id: Number(id), scan: { shop: { ownerHash } } } });
    if (!finding) return notFound();
    const scan = await db().scan.findUniqueOrThrow({ where: { id: finding.scanId }, include: { findings: { orderBy: { id: "asc" } } } });
    const report = await getReport(scan.reportPath);
    const detail = report?.findings[scan.findings.findIndex((item) => item.id === finding.id)];
    if (!detail || !report) return notFound();
    const ruleCoverage = buildRuleCoverage({ ...report, reviewCandidates: [...(report.reviewCandidates ?? [])] });
    const [visibleDetail] = findingsForRuleCoverage([{ ...detail, type: finding.type, status: finding.status }], ruleCoverage);
    return visibleDetail ? Response.json({ id: finding.id, scanId: scan.id, ...visibleDetail }) : notFound();
  }
  if (resource === "evidences" && !action) {
    const scanId = id.slice(0, 36);
    const stage = stages.find((value) => id === scanId + "-" + value);
    if (!stage) return notFound();
    const scan = await db().scan.findFirst({ where: { id: scanId, shop: { ownerHash } } });
    const report = await getReport(scan?.reportPath ?? null);
    if (!report?.snapshots.some((snapshot) => snapshot.stage === stage)) return notFound();
    const png = await readScanEvidence(scanId, stage + ".png")
      ?? await readFile(join(evidenceDirectory(scanId), stage + ".png")).catch(() => null);
    return png ? new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    }) : notFound();
  }
  if (resource !== "scans") return notFound();
  if (springAuthoritative() && action === "findings") {
    try {
      const spring = await readSpringScan(id, session, true);
      const report = spring && Array.isArray(spring.findings)
        ? spring as { findings?: unknown[] }
        : spring && typeof spring.reportJson === "string"
          ? JSON.parse(spring.reportJson) as { findings?: unknown[] }
          : null;
    if (report?.findings) {
      const ruleCoverage = buildRuleCoverage({
        ...report as Parameters<typeof buildRuleCoverage>[0],
        findings: report.findings as Finding[],
      });
      return Response.json(findingsForRuleCoverage(report.findings as Finding[], ruleCoverage), { headers: { "Cache-Control": "private, no-store" } });
    }
    } catch (cause) { return error(cause instanceof Error ? cause.message : "Spring 상태 저장소에 연결할 수 없습니다.", 503); }
  }
  if (springAuthoritative() && (action === undefined || action === "report")) {
    let spring: Record<string, unknown> | null;
    try {
      spring = await readSpringScan(id, session, action === "report");
    } catch (cause) {
      return error(cause instanceof Error ? cause.message : "Spring 상태 저장소에 연결할 수 없습니다.", 503);
    }
    if (spring) {
      const normalizedStatus = normalizeScanStatus(spring.status);
      if (action === "report") {
        const report = await normalizeSpringReport(spring, id, ownerHash);
        const response = Response.json(report, {
          headers: { "Cache-Control": "private, no-store" },
        });
        if (request.nextUrl.searchParams.get("download") === "1") {
          response.headers.set("Content-Disposition", `attachment; filename="baromi-${id}.json"`);
        }
        return response;
      }
      const progress = springProgress(spring, String(normalizedStatus));
      return Response.json({ ...spring, status: normalizedStatus, source: "SPRING_POSTGRES", ...progress }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
  }
  const scan = await db().scan.findFirst({
    where: { id, shop: { ownerHash } }, include: { findings: { orderBy: { id: "asc" } }, aiReview: true, shop: { select: { plan: true } } },
  });
  if (!scan) return notFound();
  const active = ["QUEUED", "RUNNING"].includes(scan.status);
  const phaseResults = parseScanPhases(scan.phaseResultsJson, initialScanPhases(scan.purchasePath === "DIRECT" ? "DIRECT" : "CART", scan.executionMode === "DYNAMIC"));
  const storedReport = !active && scan.reportPath ? await getReport(scan.reportPath).catch(() => null) : null;
  const reportEvidence = storedReport as unknown as Parameters<typeof buildRuleCoverage>[0] | null;
  const ruleCoverage: RuleCoverage | null = active ? null : reportEvidence
    ? buildRuleCoverage({
      ...reportEvidence,
      authContext: reportEvidence.authContext === "ANONYMOUS" || reportEvidence.authContext === "TEST_ACCOUNT" ? reportEvidence.authContext : "UNKNOWN",
    })
    : null;
  const observedStages = new Set(storedReport?.snapshots.map(({ stage }) => stage) ?? []);
  const requiredStages = scan.purchasePath === "DIRECT" ? new Set<Stage>(["product", "checkout"]) : new Set<Stage>(stages);
  const coverage = Object.fromEntries(stages.map((stage, index) => [stage,
    observedStages.has(stage) ? "COVERED"
      : !requiredStages.has(stage) ? "SKIPPED"
        : active ? (index < scan.progress ? "COVERED" : "PENDING") : "BLOCKED",
  ]));
  const phaseValues = Object.values(phaseResults);
  const terminalPhases = phaseValues.filter(({ status: phaseStatus }) => ["COVERED", "DISCOVERED", "NOT_FOUND", "BLOCKED", "FAILED", "SKIPPED"].includes(phaseStatus)).length;
  const progressStages = phaseValues.length;
  const summary = ruleCoverage ? summarizeRuleCoverage(ruleCoverage) : {
    suspected: scan.findings.filter((finding) => finding.status === "SUSPECTED").length,
    reviewNeeded: scan.findings.filter((finding) => finding.status === "REVIEW_NEEDED").length,
    notObserved: 0,
    notTested: active ? 0 : [...requiredStages].filter((stage) => !observedStages.has(stage)).length,
  };
  const surfaceObservations = ((storedReport as unknown as { surfaceObservations?: { kind: DiagnosticSurfaceKind; outcome: string }[] } | null)?.surfaceObservations ?? []);
  const surfaceCoverage = Object.fromEntries(diagnosticSurfaceKinds.map((kind) => {
    if (scan.executionMode !== "DYNAMIC") return [kind, "SKIPPED"];
    if (active) return [kind, "PENDING"];
    if (!storedReport) return [kind, "BLOCKED"];
    const observations = surfaceObservations.filter((item) => item.kind === kind);
    return [kind, observations.some((item) => item.outcome === "OBSERVED") ? "COVERED"
      : observations.some((item) => item.outcome === "DISCOVERED") ? "DISCOVERED"
        : observations.length ? "BLOCKED" : "NOT_FOUND"];
  }));
  if (!action) {
    return Response.json({
      scanId: scan.id, shopId: scan.shopId, scenario: scan.scenario, executionMode: scan.executionMode, viewport: scan.viewport,
      durationMs: scan.durationMs,
      purchasePath: scan.purchasePath,
      status: scan.status, cancelRequested: scan.cancelRequested, currentStage: scan.currentStage,
      progress: active ? Math.round(Math.min(terminalPhases, progressStages) * 100 / progressStages) : 100, coverage, surfaceCoverage, phaseResults, ruleCoverage, summary,
      // The stored path can outlive its file (for example after manual cleanup).
      // Only advertise the report when it was actually readable above.
      hasReport: Boolean(storedReport),
    });
  }
  if (action === "findings") {
    const report = storedReport as unknown as Parameters<typeof buildRuleCoverage>[0] | null;
    if (!report) return Response.json(scan.findings);
    const ruleCoverage = buildRuleCoverage({ ...report, findings: report.findings });
    return Response.json(findingsForRuleCoverage(scan.findings, ruleCoverage));
  }
  if (action === "report" && scan.reportPath) {
    const report = storedReport ?? await getReport(scan.reportPath);
    const baseline = scan.baselineScanId ? await db().scan.findFirst({
      where: { id: scan.baselineScanId, shopId: scan.shopId, shop: { ownerHash } },
      select: { reportPath: true },
    }) : null;
    const before = await getReport(baseline?.reportPath ?? null).catch(() => null);
    const comparison = scan.baselineScanId && report
      ? { baselineScanId: scan.baselineScanId, ...(before ? compareScans(before, report)
        : { status: "UNAVAILABLE" as const, reason: "기준 보고서를 읽을 수 없습니다." }) }
      : null;
    const finalRuleCoverage = report
      ? buildRuleCoverage({ ...report, reviewCandidates: [...(report.reviewCandidates ?? [])] })
      : null;
    const finalSummary = finalRuleCoverage ? summarizeRuleCoverage(finalRuleCoverage) : summary;
    const findings = report
      ? scan.findings.map((stored, index) => ({ ...(report.findings[index] ?? {}), id: stored.id, type: stored.type, status: stored.status, stage: stored.stage, reason: stored.reason, ruleVersion: stored.ruleVersion }))
      : scan.findings;
    const visibleFindings = report && finalRuleCoverage
      ? findingsForRuleCoverage(findings as { type: string; status: string }[], finalRuleCoverage)
      : findings;
    const aiReview = serializeAiReview(scan.aiReview);
    const aiReviewCandidateCount = report ? buildAiCandidatePayload(report as Parameters<typeof buildAiCandidatePayload>[0]).length : 0;
    const response = Response.json({ ...report, viewport: scan.viewport, purchasePath: scan.purchasePath,
      durationMs: scan.durationMs,
      comparison, scanId: scan.id, shopId: scan.shopId, coverage, surfaceCoverage,
      ruleCoverage: finalRuleCoverage, ruleScreenshotRefs: report && finalRuleCoverage ? ruleScreenshotRefs(report, finalRuleCoverage, scan.id) : {}, summary: finalSummary,
      aiEligible: true, aiReviewCandidateCount, aiReview,
      findings: visibleFindings });
    if (request.nextUrl.searchParams.get("download") === "1") {
      response.headers.set("Content-Disposition", `attachment; filename="baromi-${scan.id}.json"`);
    }
    return response;
  }
  return notFound();
}

export async function DELETE(request: NextRequest, context: Context) {
  if (await hasInvalidBearer(request)) return error("유효하지 않은 인증 토큰입니다.", 401);
  const session = await supabaseOwner(request) ?? request.cookies.get(cookie)?.value;
  const route = await context.params;
  if (route.path.length === 1 && route.path[0] === "session") {
    const response = NextResponse.json({ revoked: Boolean(session) });
    response.cookies.set(cookie, "", {
      httpOnly: true, sameSite: "strict", path: "/", maxAge: 0,
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  }
  if (!session) return supabaseAuthEnabled() ? error("로그인이 필요합니다.", 401) : notFound();
  const ownerHash = hash(session);
  const [resource, id, action] = route.path;
  if (resource === "scans" && id && action === "ai-review" && route.path.length === 3) {
    const scan = await db().scan.findFirst({
      where: { id, shop: { ownerHash } },
      select: { aiReview: { select: { id: true, status: true } } },
    });
    if (!scan?.aiReview) return notFound();
    const review = scan.aiReview;
    if (review.status !== "QUEUED" && review.status !== "RUNNING") {
      return error("중단할 AI 분석이 없습니다.", 409);
    }
    const cancelled = await db().aiReview.updateMany({
      where: { id: review.id, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "CANCELLED", completedAt: new Date(), error: "사용자가 AI 분석을 중단했습니다." },
    });
    const latest = cancelled.count ? null : await db().aiReview.findUnique({ where: { id: review.id }, select: { status: true } });
    if (!cancelled.count && latest?.status !== "CANCELLED") return error("AI 분석이 이미 종료됐습니다.", 409);
    return Response.json({ id: review.id, status: "CANCELLED" });
  }
  if (!id || route.path.length !== 2) return notFound();
  if (resource === "scans") {
    const scan = await db().scan.findFirst({ where: { id, shop: { ownerHash } }, select: { id: true, status: true } });
    if (scan && ["QUEUED", "RUNNING"].includes(scan.status)) return error("진행 중인 진단은 먼저 중단해 주세요.", 409);
    if (!scan && !springAuthoritative()) return notFound();
    if (springAuthoritative()) {
      try {
        const spring = await deleteSpringScan(id, session);
        if (!spring) return error("최종 상태 저장소에 연결할 수 없습니다.", 503);
        if (spring.status === 404) return notFound();
        if (spring.status === 409) return error(String(spring.body.error ?? "진행 중인 진단은 먼저 중단해 주세요."), 409);
        if (spring.status < 200 || spring.status >= 300) return error("진단 이력을 삭제하지 못했습니다.", 503);
      } catch (cause) { return error(cause instanceof Error ? cause.message : "Spring 상태 저장소에 연결할 수 없습니다.", 503); }
    }
    if (scan) await db().scan.delete({ where: { id: scan.id } });
    await deleteScanEvidence(id).catch((cause) => console.warn("Supabase evidence cleanup failed", cause));
    await rm(evidenceDirectory(id), { recursive: true, force: true }).catch(() => undefined);
    return Response.json({ deleted: true, scanId: id });
  }
  if (resource === "shops") {
    const shop = await db().shop.findFirst({ where: { id, ownerHash }, select: { id: true, scans: { select: { id: true, status: true } } } });
    if (shop?.scans.some((scan) => ["QUEUED", "RUNNING"].includes(scan.status))) return error("진행 중인 진단이 있어 상점을 삭제할 수 없습니다.", 409);
    if (!shop && !springAuthoritative()) return notFound();
    let deletedScanIds = shop?.scans.map((scan) => scan.id) ?? [];
    if (springAuthoritative()) {
      try {
        const spring = await deleteSpringShop(id, session);
        if (!spring) return error("최종 상태 저장소에 연결할 수 없어 상점을 삭제하지 못했습니다.", 503);
        if (spring.status === 404) return notFound();
        if (spring.status === 409) return error(String(spring.body.error ?? "진행 중인 진단이 있어 상점을 삭제할 수 없습니다."), 409);
        if (spring.status < 200 || spring.status >= 300) return error("쇼핑몰과 진단 이력을 삭제하지 못했습니다.", 503);
        if (Array.isArray(spring.body.deletedScanIds)) deletedScanIds = [...new Set([
          ...deletedScanIds, ...spring.body.deletedScanIds.filter((value): value is string => typeof value === "string"),
        ])];
      } catch (cause) { return error(cause instanceof Error ? cause.message : "Spring 상태 저장소에 연결할 수 없습니다.", 503); }
    }
    if (shop) {
      await db().scan.deleteMany({ where: { shopId: shop.id } });
      await db().shop.delete({ where: { id: shop.id } });
    }
    await Promise.all(deletedScanIds.map(async (scanId) => {
      await deleteScanEvidence(scanId).catch((cause) => console.warn("Supabase evidence cleanup failed", cause));
      await rm(evidenceDirectory(scanId), { recursive: true, force: true }).catch(() => undefined);
    }));
    return Response.json({ deleted: true, shopId: id, deletedScanCount: deletedScanIds.length });
  }
  return notFound();
}
