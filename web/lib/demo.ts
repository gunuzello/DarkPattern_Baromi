/**
 * Sample data for NEXT_PUBLIC_DEMO_MODE. Mirrors the backend's response shapes so every
 * screen can be reviewed on Vercel without the scan worker. All values are examples.
 */
import type {
  CreateScanResponse, CreateShopResponse, FindingDetail, HistoryItem, PhaseResult, PhaseResults, PriceLedger, Report,
  RuleCoverage, ScanState, Shop, SurfaceKind, SurfaceStatus, VerifyResponse,
} from "./types";
import type { ScanRequest } from "./api";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const KEY = "baromi-demo-scans";
const RUN_SECONDS = 24;

type Stored = { start: number; profile: ScanRequest["profile"]; viewport: ScanRequest["viewport"]; purchasePath: ScanRequest["purchasePath"]; cancelAt?: number };

function load(): Record<string, Stored> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
function save(all: Record<string, Stored>) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: the demo still works for the current page */
  }
}

export const ok = async () => ({ ok: true });

/** Shop names chosen in the demo, kept for this browser session. */
const NAMES_KEY = "baromi-demo-shop-names";
const defaultNames: Record<string, string> = { "demo-shop": "린넨하우스", "demo-shop-2": "오크테이블" };
function shopNames(): Record<string, string> {
  if (typeof window === "undefined") return defaultNames;
  try {
    return { ...defaultNames, ...JSON.parse(window.sessionStorage.getItem(NAMES_KEY) ?? "{}") };
  } catch {
    return defaultNames;
  }
}

export async function renameShop(shopId: string, nickname: string): Promise<Shop> {
  await wait(250);
  try {
    window.sessionStorage.setItem(NAMES_KEY, JSON.stringify({ ...shopNames(), [shopId]: nickname }));
  } catch {
    /* storage unavailable: the name still shows until reload */
  }
  return { id: shopId, url: shopId === "demo-shop-2" ? "https://oak-table.co.kr" : "https://linen-house.cafe24.com", nickname };
}

export async function createShop(url: string, nickname?: string): Promise<CreateShopResponse> {
  await wait(500);
  if (nickname?.trim()) await renameShop("demo-shop", nickname.trim());
  return {
    shopId: "demo-shop",
    url,
    nickname: nickname?.trim() || shopNames()["demo-shop"],
    verification: {
      name: "baromi-site-verification",
      token: "brm_7f3k9q2x",
      metaTag: '<meta name="baromi-site-verification" content="brm_7f3k9q2x">',
      filePath: "/.well-known/baromi-verification.txt",
      dnsRecord: "_baromi-verification.linen-house.cafe24.com TXT brm_7f3k9q2x",
    },
  };
}

export async function verifyShop(): Promise<VerifyResponse> {
  await wait(1200);
  return { verified: true, verifiedAt: new Date().toISOString(), method: "meta" };
}

export async function createScan(input: ScanRequest): Promise<CreateScanResponse> {
  await wait(400);
  const id = "demo-" + Math.random().toString(36).slice(2, 10);
  const all = load();
  all[id] = { start: Date.now(), profile: input.profile, viewport: input.viewport, purchasePath: input.purchasePath };
  save(all);
  return { scanId: id, status: "QUEUED", createdAt: new Date().toISOString() };
}

export async function cancelScan(scanId: string): Promise<{ status: string; cancelRequested?: boolean }> {
  const all = load();
  const stored = all[scanId];
  if (!stored) return { status: "CANCELLED" };
  const queued = (Date.now() - stored.start) / 1000 < 2;
  stored.cancelAt = Date.now() - (queued ? 2000 : 0);
  save(all);
  return queued ? { status: "CANCELLED" } : { status: "RUNNING", cancelRequested: true };
}

export async function listShops() {
  await wait(250);
  return {
    limit: 50,
    shops: [
      { shopId: "demo-shop", url: "https://linen-house.cafe24.com", nickname: shopNames()["demo-shop"] },
      { shopId: "demo-shop-2", url: "https://oak-table.co.kr", nickname: shopNames()["demo-shop-2"] },
    ],
  };
}

const doneSurfaces: Record<SurfaceKind, SurfaceStatus> = {
  CATALOG: "COVERED", AUTH: "DISCOVERED", COUPON: "NOT_FOUND", RECOMMENDATION: "COVERED",
  SUBSCRIPTION: "NOT_FOUND", CANCELLATION: "DISCOVERED", POLICY: "COVERED",
};
const surfaceAt: [SurfaceKind, number][] = [["CATALOG", 5], ["AUTH", 6], ["COUPON", 8], ["RECOMMENDATION", 8], ["SUBSCRIPTION", 10], ["CANCELLATION", 12], ["POLICY", 15]];

export async function getScan(scanId: string): Promise<ScanState> {
  const stored = load()[scanId] ?? { start: Date.now() - RUN_SECONDS * 1000, profile: "DYNAMIC", viewport: "DESKTOP", purchasePath: "CART" };
  const now = Date.now();
  const cancelled = stored.cancelAt != null && now - stored.cancelAt > 1500;
  const t = ((cancelled ? stored.cancelAt! : now) - stored.start) / 1000;
  const dynamic = stored.profile === "DYNAMIC";
  const direct = stored.purchasePath === "DIRECT";
  const status = cancelled ? "CANCELLED" : t < 2 ? "QUEUED" : t < RUN_SECONDS ? "RUNNING" : "COMPLETED";
  const active = status === "QUEUED" || status === "RUNNING";
  const reached = (from: number) => t >= from;
  const covered = (stageEnd: number) => (reached(stageEnd) ? "COVERED" : active ? "PENDING" : "BLOCKED") as "COVERED" | "PENDING" | "BLOCKED";
  const currentStage = !active || t < 7 ? null : t < 13 ? "product" : t < 17 && !direct ? "cart" : "checkout";
  const iso = (sec: number) => new Date(stored.start + sec * 1000).toISOString();
  const phase = (from: number, to: number, done: PhaseResult["status"], reason?: string): PhaseResult => {
    if (t >= to) return { status: done, startedAt: iso(from), finishedAt: iso(to), durationMs: (to - from) * 1000, reason, evidenceIds: done === "COVERED" ? [`ev_${Math.round(to * 10)}`] : [] };
    if (t >= from && active) return { status: "RUNNING", startedAt: iso(from), evidenceIds: [] };
    if (active) return { status: "PENDING", evidenceIds: [] };
    return { status: cancelled ? "SKIPPED" : "BLOCKED", reason: cancelled ? "사용자가 진단을 중단했어요." : "제한 시간 안에 도달하지 못했어요.", evidenceIds: [] };
  };
  const surfaceReasons: Partial<Record<SurfaceKind, string>> = {
    AUTH: "로그인 링크만 찾았고, 테스트 계정 없이 상세 화면은 열지 않았어요.",
    COUPON: "쿠폰·프로모션으로 이어지는 링크를 찾지 못했어요.",
    SUBSCRIPTION: "구독·멤버십 화면 링크를 찾지 못했어요.",
    CANCELLATION: "환불 안내 링크는 찾았지만 해지 버튼은 누르지 않았어요.",
  };
  const phaseResults: PhaseResults = {
    product: phase(7, 13, "COVERED"),
    cart: direct ? { status: "SKIPPED", reason: "바로구매 경로에서는 장바구니를 지나지 않아요.", evidenceIds: [] } : dynamic ? phase(13, 17, "COVERED") : { status: "SKIPPED", reason: "공개 화면 진단에서는 장바구니를 열지 않아요.", evidenceIds: [] },
    checkout: dynamic ? phase(direct ? 13 : 17, 22, "COVERED", "결제 버튼 앞에서 멈췄어요.") : { status: "SKIPPED", reason: "공개 화면 진단에서는 주문서를 열지 않아요.", evidenceIds: [] },
    ...Object.fromEntries(surfaceAt.map(([kind, at]) => [`surface:${kind}`, dynamic
      ? phase(Math.max(2, at - 3), at, doneSurfaces[kind] as PhaseResult["status"], surfaceReasons[kind])
      : { status: "SKIPPED", reason: "별도 영역 탐색은 전체 구매 흐름 진단에서 해요.", evidenceIds: [] }])),
    "site-crawl": dynamic
      ? phase(4, 20, "COVERED", "내부 경로 42곳을 읽기 전용으로 둘러봤어요.")
      : { status: "SKIPPED", reason: "전체 화면 탐색은 전체 구매 흐름 진단에서 해요.", evidenceIds: [] },
  };
  return {
    scanId,
    shopId: "demo-shop",
    executionMode: dynamic ? "DYNAMIC" : "STATIC",
    viewport: stored.viewport,
    purchasePath: stored.purchasePath,
    durationMs: active ? null : Math.round(Math.min(t, RUN_SECONDS) * 1000),
    status,
    cancelRequested: stored.cancelAt != null && !cancelled,
    currentStage,
    progress: active ? Math.round(Math.min(t, RUN_SECONDS) / RUN_SECONDS * 100) : 100,
    coverage: {
      product: covered(13),
      cart: direct ? "SKIPPED" : dynamic ? covered(17) : active ? "PENDING" : "BLOCKED",
      checkout: dynamic ? covered(22) : active ? "PENDING" : "BLOCKED",
    },
    surfaceCoverage: Object.fromEntries(surfaceAt.map(([kind, at]) => [kind,
      !dynamic ? "SKIPPED" : t >= at ? doneSurfaces[kind] : active ? "PENDING" : "NOT_FOUND"])) as Record<SurfaceKind, SurfaceStatus>,
    phaseResults,
    ruleCoverage: active || cancelled ? null : dynamic ? sampleRuleCoverage : undefined,
    hasReport: !active && !cancelled,
    summary: {
      suspected: (reached(11) ? 1 : 0) + (reached(19) ? 1 : 0) + (reached(12) ? 1 : 0),
      reviewNeeded: reached(9) ? 2 : 0,
      notTested: active ? 0 : 3,
      notObserved: active ? 0 : 8,
    },
  };
}

const sampleRuleCoverage: RuleCoverage = {
  PRESELECTION: { status: "SUSPECTED", reason: "유료 옵션 ‘파손 보장(+1,500원)’이 조작 전부터 선택돼 있고, 해제하면 총액이 1,500원 줄어요.", evidenceIds: ["ev_0142", "ev_0144"] },
  DRIP_PRICING: { status: "SUSPECTED", reason: "상품 상세에 없던 필수 처리비 2,500원이 주문서에서 처음 나타나요.", evidenceIds: ["ev_0187"] },
  URGENCY_SCARCITY: { status: "SUSPECTED", reason: "새 세션에서도 ‘오늘 마감’ 카운트다운과 ‘남은 수량 3개’가 그대로였어요.", evidenceIds: ["ev_0151", "ev_0203"] },
  HIDDEN_INFO: { status: "NOT_OBSERVED", reason: "상품 상세와 주문서에서 추가 비용 안내 누락 신호를 관찰하지 못했어요.", evidenceIds: ["page:product", "page:checkout"] },
  FALSE_DISCOUNT: { status: "REVIEW_NEEDED", reason: "할인 전 가격으로 판매한 근거를 공개 화면에서 찾지 못했어요.", evidenceIds: ["ev_0109"] },
  DISGUISED_AD: { status: "NOT_OBSERVED", reason: "추천 영역에서 광고·협찬 표현을 관찰하지 못했어요.", evidenceIds: ["ev_0312"] },
  CONFIRM_SHAMING: { status: "NOT_OBSERVED", reason: "주문서 선택지에서 거부 압박 문구를 관찰하지 못했어요.", evidenceIds: ["page:checkout"] },
  FORCED_ACTION: { status: "NOT_OBSERVED", reason: "비회원 주문으로 주문서까지 도달했어요.", evidenceIds: ["page:checkout"] },
  HIDDEN_SUBSCRIPTION: { status: "NOT_TESTED", reason: "구독·멤버십 별도 영역을 찾지 못해 판단할 수 없어요.", evidenceIds: [] },
  SNEAKY_CART_ADD: { status: "NOT_OBSERVED", reason: "담기 요청 1번 뒤 장바구니에 요청한 상품 1개만 있었어요.", evidenceIds: ["page:cart"] },
  FALSE_RECOMMENDATION: { status: "REVIEW_NEEDED", reason: "‘실시간 인기 1위’ 표시에 순위 기준과 기간이 없어요.", evidenceIds: ["ev_0098"] },
  BAIT_SELLING: { status: "NOT_OBSERVED", reason: "목록 상품과 상세의 구매 가능 여부가 일치했어요.", evidenceIds: ["ev_0310"] },
  TRICK_QUESTION: { status: "NOT_OBSERVED", reason: "주문서 동의 문구에서 부정·조건 표현을 관찰하지 못했어요.", evidenceIds: ["page:checkout"] },
  MISDIRECTED_HIERARCHY: { status: "NOT_OBSERVED", reason: "같은 결정군 버튼의 면적 비율이 기준(3배) 아래였어요.", evidenceIds: ["page:checkout"] },
  CANCELLATION_OBSTRUCTION: { status: "NOT_TESTED", reason: "구독 영역을 찾지 못해 가입과 해지 경로를 비교할 수 없어요.", evidenceIds: [] },
  PRICE_COMPARISON_OBSTRUCTION: { status: "NOT_TESTED", reason: "단위 가격을 같은 기준으로 비교할 자료가 부족해요.", evidenceIds: [] },
};

const samplePriceLedger: PriceLedger = {
  version: 1,
  currency: "KRW",
  firstPriceExposure: { status: "OBSERVED", url: "https://linen-house.cafe24.com/", text: "데일리 린넨 셔츠 29,000원", amounts: [29000] },
  stages: [
    { stage: "product", evidence: { id: "page:product", url: "https://linen-house.cafe24.com/product/linen-shirt" }, verification: "SCREEN_NETWORK_AGREE", displayedLines: ["판매가 29,000원", "파손 보장 +1,500원 (선택됨)", "합계 30,500원"], networkValues: [{ evidenceId: "net_01", won: 29000, matchedScreen: true }] },
    { stage: "cart", evidence: { id: "page:cart", url: "https://linen-house.cafe24.com/order/basket" }, verification: "SCREEN_ONLY", displayedLines: ["상품 29,000원", "파손 보장 1,500원", "합계 30,500원"] },
    { stage: "checkout", evidence: { id: "page:checkout", url: "https://linen-house.cafe24.com/order/orderform" }, verification: "SCREEN_NETWORK_PARTIAL", displayedLines: ["상품과 옵션 30,500원", "필수 처리비 2,500원", "총 결제 33,000원"], networkValues: [{ evidenceId: "net_04", won: 33000, matchedScreen: true }, { evidenceId: "net_04", won: 31000, matchedScreen: false }] },
  ],
};

/** What the sample report shows in place of a screenshot, per finding. */
export const sampleEvidenceLines: Record<number, string[]> = {
  142: ["판매가 29,000원", "파손 보장 +1,500원 (선택됨)", "합계 30,500원"],
  187: ["상품과 옵션 30,500원", "필수 처리비 2,500원 (새로 표시)", "총 결제 33,000원"],
  151: ["오늘 마감까지 03:59:58", "남은 수량 3개", "새 세션에서도 같은 값"],
  109: ["정가 59,000원 (취소선)", "판매가 29,000원", "51% 할인"],
  98: ["실시간 인기 1위", "기준·기간 표시 없음"],
};

export const sampleReport: Report = {
  scanId: "sample",
  shopId: "demo-shop",
  targetUrl: "https://linen-house.cafe24.com/product/linen-shirt",
  scanStatus: "COMPLETED",
  executionMode: "DYNAMIC",
  viewport: "DESKTOP",
  purchasePath: "CART",
  durationMs: 42300,
  stageTimingsMs: { product: 6100, cart: 14800, checkout: 23500 },
  coverage: { product: "COVERED", cart: "COVERED", checkout: "COVERED" },
  surfaceCoverage: doneSurfaces,
  phaseResults: {
    product: { status: "COVERED", durationMs: 6100, evidenceIds: ["page:product"] },
    cart: { status: "COVERED", durationMs: 8700, evidenceIds: ["page:cart"] },
    checkout: { status: "COVERED", durationMs: 8700, reason: "결제 버튼 앞에서 멈췄어요.", evidenceIds: ["page:checkout"] },
    "surface:CATALOG": { status: "COVERED", durationMs: 2400, evidenceIds: ["ev_0310"] },
    "surface:AUTH": { status: "DISCOVERED", durationMs: 900, reason: "로그인 링크만 찾았고, 테스트 계정 없이 상세 화면은 열지 않았어요.", evidenceIds: ["ev_0301"] },
    "surface:COUPON": { status: "NOT_FOUND", durationMs: 1100, reason: "쿠폰·프로모션으로 이어지는 링크를 찾지 못했어요.", evidenceIds: [] },
    "surface:RECOMMENDATION": { status: "COVERED", durationMs: 3100, evidenceIds: ["ev_0312"] },
    "surface:SUBSCRIPTION": { status: "NOT_FOUND", durationMs: 1000, reason: "구독·멤버십 화면 링크를 찾지 못했어요.", evidenceIds: [] },
    "surface:CANCELLATION": { status: "DISCOVERED", durationMs: 1300, reason: "환불 안내 링크는 찾았지만 해지 버튼은 누르지 않았어요.", evidenceIds: ["ev_0305"] },
    "surface:POLICY": { status: "COVERED", durationMs: 1900, evidenceIds: ["ev_0320"] },
  },
  ruleCoverage: sampleRuleCoverage,
  priceLedger: samplePriceLedger,
  summary: { suspected: 3, reviewNeeded: 2, notTested: 3, notObserved: 8 },
  findings: [
    { id: 142, type: "PRESELECTION", status: "SUSPECTED", stage: "product", reason: "유료 옵션 ‘파손 보장(+1,500원)’이 사용자가 조작하기 전에 선택돼 있고, 선택을 풀면 총액이 30,500원에서 29,000원으로 줄어요.", ruleVersion: "2", evidenceIds: ["ev_0142", "ev_0144"] },
    { id: 187, type: "DRIP_PRICING", status: "SUSPECTED", stage: "checkout", reason: "공개 첫 화면과 상품 상세에는 29,000원만 보였는데, 반드시 내야 하는 처리비 2,500원이 주문서에서 처음 나타나요.", ruleVersion: "2", evidenceIds: ["ev_0187"] },
    { id: 151, type: "URGENCY_SCARCITY", status: "SUSPECTED", stage: "product", reason: "새 브라우저 세션으로 다시 들어가도 ‘오늘 마감’ 카운트다운이 처음부터 시작되고 ‘남은 수량 3개’도 같았어요.", ruleVersion: "1", evidenceIds: ["ev_0151", "ev_0203"] },
    { id: 109, type: "FALSE_DISCOUNT", status: "REVIEW_NEEDED", stage: "product", reason: "‘정가 59,000원에서 51% 할인’의 할인 전 가격으로 판매한 근거를 공개 화면에서 찾지 못했어요.", ruleVersion: "1", evidenceIds: ["ev_0109"] },
    { id: 98, type: "FALSE_RECOMMENDATION", status: "REVIEW_NEEDED", stage: "product", reason: "‘실시간 인기 1위’ 표시에 순위의 기준과 기간이 적혀 있지 않아요.", ruleVersion: "1", evidenceIds: ["ev_0098"] },
  ],
  reviewCandidates: [
    { id: "review:rule:false_discount", kind: "SEMANTIC_REVIEW", stage: "product", ruleType: "FALSE_DISCOUNT", text: "정가 59,000원 → 29,000원 (51% 할인)", reason: "표시된 할인 기준 가격의 실제 판매 이력은 화면만으로 검증할 수 없어요.", evidenceIds: ["ev_0109"] },
    { id: "review:rule:false_recommendation", kind: "SEMANTIC_REVIEW", stage: "product", ruleType: "FALSE_RECOMMENDATION", text: "실시간 인기 1위", reason: "인기 순위의 산정 기준과 기간을 화면에서 찾지 못했어요.", evidenceIds: ["ev_0098"] },
  ],
  surfaceObservations: [
    { evidenceId: "ev_0301", kind: "AUTH", url: "https://linen-house.cafe24.com/member/login", status: 200, title: "로그인", text: "", outcome: "DISCOVERED" },
    { evidenceId: "ev_0305", kind: "CANCELLATION", url: "https://linen-house.cafe24.com/board/refund", status: 200, title: "교환·환불 안내", text: "", outcome: "DISCOVERED" },
  ],
  comparison: {
    baselineScanId: "sample-1105",
    added: [{ type: "DRIP_PRICING", stage: "checkout", reason: "주문서 필수 처리비 공개" }, { type: "URGENCY_SCARCITY", stage: "product", reason: "상품 상세 긴급성 표시" }],
    repeated: [{ type: "PRESELECTION", stage: "product", reason: "상품 상세 옵션 사전선택" }],
    notObserved: [{ type: "CONFIRM_SHAMING", stage: "checkout", reason: "주문서 쿠폰 거절 문구" }],
  },
  aiEligible: true,
  aiReview: null,
  aiUsage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
};

let aiStartedAt: number | null = null;

export async function getReport(scanId: string): Promise<Report> {
  await wait(300);
  const stored = load()[scanId];
  const base: Report = { ...sampleReport, scanId };
  if (stored && stored.profile !== "DYNAMIC") {
    return {
      ...base, executionMode: "STATIC", durationMs: 8400, stageTimingsMs: { product: 3200 },
      coverage: { product: "COVERED", cart: "BLOCKED", checkout: "BLOCKED" },
      surfaceCoverage: Object.fromEntries(Object.keys(doneSurfaces).map((k) => [k, "SKIPPED"])) as Record<SurfaceKind, SurfaceStatus>,
      summary: { suspected: 2, reviewNeeded: 2, notTested: 2 },
      findings: base.findings.filter((f) => f.stage === "product"),
      comparison: null,
      phaseResults: undefined,
      ruleCoverage: null,
      priceLedger: { ...samplePriceLedger, stages: samplePriceLedger.stages.filter((s) => s.stage === "product") },
    };
  }
  if (aiStartedAt) {
    const s = (Date.now() - aiStartedAt) / 1000;
    base.aiReview = s < 1.5 ? { id: "ai1", status: "QUEUED", candidateCount: 2 }
      : s < 4 ? { id: "ai1", status: "RUNNING", candidateCount: 2 }
        : {
          id: "ai1", status: "COMPLETED", candidateCount: 2, durationMs: 4200, model: "sample-model",
          usage: { inputTokens: 1800, outputTokens: 240, estimatedCostUsd: 0.00042 },
          result: {
            promptVersion: "v3",
            decisions: [
              { candidateId: "review:rule:false_discount", label: "NEEDS_REVIEW", confidence: 0.72, rationale: "정가 59,000원으로 판매한 기간이 화면에 없어요. 판매 이력을 확인해 주세요." },
              { candidateId: "review:rule:false_recommendation", label: "INSUFFICIENT_EVIDENCE", confidence: 0.55, rationale: "순위 기준이 없지만 실제 판매 데이터 없이는 거짓인지 단정할 수 없어요." },
            ],
          },
        };
  }
  return base;
}

export async function requestAiReview(_scanId: string) {
  aiStartedAt = Date.now();
  return { id: "ai1", status: "QUEUED" };
}

export async function getFinding(findingId: string): Promise<FindingDetail> {
  await wait(300);
  const finding = sampleReport.findings.find((f) => String(f.id) === findingId) ?? sampleReport.findings[0];
  const own = sampleEvidenceLines[finding.id];
  return {
    id: finding.id, scanId: "sample", type: finding.type, status: finding.status, stage: finding.stage, reason: finding.reason, ruleVersion: finding.ruleVersion,
    evidenceIds: finding.evidenceIds,
    evidence: [
      { stage: "product", url: "https://linen-house.cafe24.com/product/linen-shirt", priceLines: finding.stage === "product" && own ? own : ["판매가 29,000원", "파손 보장 +1,500원 (선택됨)", "선물 포장 +2,000원"] },
      { stage: "cart", url: "https://linen-house.cafe24.com/order/basket", priceLines: ["상품 29,000원", "파손 보장 1,500원", "합계 30,500원"] },
      { stage: "checkout", url: "https://linen-house.cafe24.com/order/orderform", priceLines: ["상품과 옵션 30,500원", "필수 처리비 2,500원", "총 결제 33,000원"] },
    ],
  };
}

export async function getShop(shopId: string): Promise<Shop> {
  await wait(200);
  return { id: shopId, url: shopId === "demo-shop-2" ? "https://oak-table.co.kr" : "https://linen-house.cafe24.com", nickname: shopNames()[shopId], consentAt: "2026-11-05T13:39:00+09:00", verifiedAt: "2026-11-05T13:40:00+09:00" };
}

export async function getShopScans(): Promise<HistoryItem[]> {
  await wait(300);
  const item = (scanId: string, createdAt: string, status: HistoryItem["status"], executionMode: HistoryItem["executionMode"], viewport: HistoryItem["viewport"], purchasePath: HistoryItem["purchasePath"], durationMs: number | null, suspected = 0, reviewNeeded = 0): HistoryItem =>
    ({ scanId, createdAt, status, executionMode, viewport, purchasePath, durationMs, summary: { suspected, reviewNeeded } });
  return [
    item("demo-q", "2026-11-14T14:22:00+09:00", "QUEUED", "DYNAMIC", "MOBILE", "DIRECT", null),
    item("demo-r", "2026-11-14T14:20:00+09:00", "RUNNING", "DYNAMIC", "DESKTOP", "CART", null),
    item("sample", "2026-11-12T14:20:00+09:00", "COMPLETED", "DYNAMIC", "DESKTOP", "CART", 42300, 3, 2),
    item("sample-1111", "2026-11-11T10:05:00+09:00", "COMPLETED", "STATIC", "DESKTOP", "CART", 8400, 1, 0),
    item("sample-1110", "2026-11-10T16:42:00+09:00", "PARTIAL", "DYNAMIC", "MOBILE", "CART", 72000, 1, 1),
    item("sample-1109", "2026-11-09T11:30:00+09:00", "CANCELLED", "DYNAMIC", "DESKTOP", "DIRECT", 19000),
    item("sample-1108", "2026-11-08T09:12:00+09:00", "FAILED", "DYNAMIC", "DESKTOP", "CART", 31600),
    item("sample-1105", "2026-11-05T13:40:00+09:00", "COMPLETED", "DYNAMIC", "DESKTOP", "CART", 39800, 2, 1),
  ];
}
