/**
 * Types mirrored from the DarkPatternPrevent API (`app/api/v1/[...path]/route.ts`).
 * Keep these in sync with the backend; the UI only reads what is listed here.
 */
export type Stage = "product" | "cart" | "checkout";
export const stages: Stage[] = ["product", "cart", "checkout"];

export type Viewport = "DESKTOP" | "MOBILE";
export type PurchasePath = "CART" | "DIRECT";
export type ExecutionMode = "DEMO" | "STATIC" | "DYNAMIC";
export type ScanProfile = "CONTEST" | "DYNAMIC";
export type ScanStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
export type StageCoverage = "COVERED" | "BLOCKED" | "PENDING" | "SKIPPED";

export type SurfaceKind = "CATALOG" | "AUTH" | "COUPON" | "RECOMMENDATION" | "SUBSCRIPTION" | "CANCELLATION" | "POLICY";
export const surfaceKinds: SurfaceKind[] = ["CATALOG", "AUTH", "COUPON", "RECOMMENDATION", "SUBSCRIPTION", "CANCELLATION", "POLICY"];
export type SurfaceStatus = "COVERED" | "DISCOVERED" | "BLOCKED" | "NOT_FOUND" | "PENDING" | "SKIPPED";

export type FindingType =
  | "PRESELECTION" | "DRIP_PRICING" | "URGENCY_SCARCITY" | "HIDDEN_INFO" | "FALSE_DISCOUNT" | "DISGUISED_AD"
  | "CONFIRM_SHAMING" | "FORCED_ACTION" | "HIDDEN_SUBSCRIPTION" | "SNEAKY_CART_ADD" | "FALSE_RECOMMENDATION"
  | "BAIT_SELLING" | "TRICK_QUESTION" | "MISDIRECTED_HIERARCHY" | "CANCELLATION_OBSTRUCTION" | "PRICE_COMPARISON_OBSTRUCTION";
export type FindingStatus = "SUSPECTED" | "REVIEW_NEEDED";

export type Summary = { suspected: number; reviewNeeded: number; notTested: number; notObserved?: number };

/** Spec §4: purchase stages and the seven surfaces share one phase status system. */
export type PhaseStatus = "PENDING" | "RUNNING" | "COVERED" | "DISCOVERED" | "NOT_FOUND" | "BLOCKED" | "FAILED" | "SKIPPED";
export type PhaseId = Stage | `surface:${SurfaceKind}` | "site-crawl";
export type PhaseActivity = {
  visitedScreens: number;
  discoveredScreens: number;
  pendingScreens: number;
  visitedUrls: number;
  discoveredUrls: number;
  updatedAt: string;
};
export type PhaseResult = {
  status: PhaseStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  reason?: string;
  evidenceIds?: string[];
  activity?: PhaseActivity;
};
export type PhaseResults = Partial<Record<PhaseId, PhaseResult>>;

/** Spec §4/§5: one verdict per check type; a finished report always carries all 16. */
export type RuleStatus = "SUSPECTED" | "REVIEW_NEEDED" | "NOT_OBSERVED" | "NOT_TESTED";
export type DecisionMode = "BASIC_ENGINE" | "AI_CONTEXT";
/** decisionMode is absent only in legacy/demo fixtures; live report responses include it. */
export type RuleCoverageItem = { status: RuleStatus; decisionMode?: DecisionMode; decisionCriteria?: string; reason: string; evidenceIds: string[] };
export type RuleCoverage = Partial<Record<FindingType, RuleCoverageItem>>;

export type Bounds = { x: number; y: number; width: number; height: number };
export type EvidenceLocation = { frame: string; visible: boolean; source: "dom" | "api" };
export type OptionEvidence = { label: string; won: number; selected: boolean; bounds: Bounds; location?: EvidenceLocation };
export type FeeEvidence = { id: string; label: string; won: number; required: boolean; bounds: Bounds; location?: EvidenceLocation };
export type ChoiceControl = { label: string; selected: boolean; amount?: number; kind: "CHECKBOX" | "RADIO" | "SELECT" | "SWITCH" };
export type DecisionControl = {
  label: string; kind: "BUTTON" | "LINK" | "CHECKBOX" | "RADIO"; bounds: Bounds;
  selected?: boolean; href?: string; color?: string; backgroundColor?: string; opacity?: number; tabIndex?: number; group?: string;
};
export type SnapshotInspection = {
  visibleText: "COMPLETE"; controls: "COMPLETE"; choiceControls: "COMPLETE" | "INCOMPLETE";
  prices: "COMPLETE"; feeRows: "COMPLETE"; cartCount: "OBSERVED" | "UNAVAILABLE" | "NOT_APPLICABLE";
};
export type Snapshot = {
  evidenceId?: string; stage: Stage; url: string; screenshot?: string; capturedAt?: string; screenshotArea?: Bounds;
  priceLines: string[]; textLines?: string[]; options?: OptionEvidence[]; choiceControls?: ChoiceControl[]; fees?: FeeEvidence[];
  precheckedSignals?: { label: string; bounds: Bounds; location?: EvidenceLocation }[];
  surfaceSignals?: { kind: "AUTH" | "SUBSCRIPTION" | "CANCELLATION" | "MARKETING_CONSENT" | "POPUP"; label: string; source: "link" | "button" | "text"; href?: string }[];
  decisionControls?: DecisionControl[]; cartItemCount?: number; productIdentity?: string; cartCountBeforeAdd?: number; cartBaselineVerified?: boolean;
  requestedQuantity?: number; cartLineIdentities?: string[]; cartLinesComplete?: boolean; requestedProductIdentity?: string;
  cartContentsVerified?: boolean; inspection?: SnapshotInspection;
};

/** Screen/network observations per stage; this is not an authoritative paid-price receipt. */
export type PriceVerification = "SCREEN_ONLY" | "SCREEN_NETWORK_AGREE" | "SCREEN_NETWORK_PARTIAL" | "SCREEN_NETWORK_DISAGREE";
export type PriceLedgerStage = {
  stage: Stage;
  evidence?: { id: string; url?: string; capturedAt?: string; screenshot?: string };
  verification: PriceVerification;
  displayedLines: string[];
  networkValues?: { evidenceId: string; won: number; matchedScreen: boolean }[];
  options?: OptionEvidence[];
  fees?: FeeEvidence[];
};
export type PriceLedger = {
  version: number;
  currency: "KRW";
  firstPriceExposure?: {
    status: "OBSERVED" | "NOT_VERIFIED"; evidenceId?: string; url?: string; productUrl?: string; text?: string;
    amounts?: number[]; feeMentions?: { key: string; won: number }[]; screenshot?: string; capturedAt?: string;
  };
  stages: PriceLedgerStage[];
};

export type Verification = { name: string; token: string; metaTag: string; filePath: string; dnsRecord: string };
export type CreateShopResponse = { shopId: string; url: string; verification: Verification | null };
export type VerifyResponse = { verified: true; verifiedAt: string; method?: "meta" | "file" | "dns" };
export type CreateScanResponse = { scanId: string; status?: string; createdAt?: string; deduplicated?: boolean };
export type CancelResponse = { status: string; cancelRequested?: boolean };
export type ShopListResponse = { limit: number; shops: { shopId: string; url: string }[] };

export type ScanState = {
  scanId: string;
  shopId: string;
  executionMode?: ExecutionMode;
  viewport: Viewport;
  purchasePath: PurchasePath;
  durationMs: number | null;
  status: ScanStatus;
  cancelRequested: boolean;
  currentStage?: Stage | null;
  progress: number;
  coverage: Record<Stage, StageCoverage>;
  surfaceCoverage: Record<SurfaceKind, SurfaceStatus>;
  phaseResults?: PhaseResults;
  ruleCoverage?: RuleCoverage | null;
  summary?: Summary;
  hasReport?: boolean;
};

export type Finding = {
  id: number;
  type: FindingType;
  status?: FindingStatus;
  stage: Stage;
  reason: string;
  ruleVersion?: string;
  evidenceIds?: string[];
};
export type ReviewCandidate = {
  id: string;
  kind: "FEE_SEMANTICS" | "OPTION_SEMANTICS" | "SURFACE_FLOW" | "EXPLORATION_UNVERIFIED" | "VISUAL_ACCESSIBILITY" | "SEMANTIC_REVIEW" | "POPUP_TEXT" | "SURFACE_TEXT";
  stage: Stage | "surface"; text: string; reason: string; evidenceIds: string[]; ruleType?: FindingType;
  observedFacts?: string[]; missingInformation?: string[];
};
export type SurfaceObservation = {
  evidenceId: string;
  kind: "AUTH" | "SUBSCRIPTION" | "CANCELLATION" | "COUPON" | "RECOMMENDATION" | "POLICY" | "CATALOG";
  url: string;
  status: number | null;
  title: string;
  text: string;
  outcome: string;
};
export type ComparisonSignal = { type: FindingType; stage: Stage; reason: string; ruleVersion?: string };
export type Comparison =
  | { baselineScanId: string; status: "UNAVAILABLE"; reason: string }
  | { baselineScanId: string; status?: "AVAILABLE"; added: ComparisonSignal[]; repeated: ComparisonSignal[]; notObserved: ComparisonSignal[] };
export type OperatorLabel = "LIKELY_RISK" | "NEEDS_REVIEW" | "LIKELY_BENIGN" | "INSUFFICIENT_EVIDENCE";
export type AiReview = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  model?: string | null;
  candidateCount: number;
  durationMs?: number | null;
  error?: string | null;
  result?: {
    promptVersion?: string;
    decisions?: { candidateId: string; label: string; confidence: number; rationale: string; suggestedRule?: string | null }[];
  } | null;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd: number } | null;
};
export type ExplorationBlocker = {
  stage: Stage;
  code: "ACTION_NOT_FOUND" | "ACTION_AMBIGUOUS" | "ACTION_FAILED" | "LOGIN_REQUIRED";
  action: "ADD_TO_CART" | "OPEN_CHECKOUT" | "DIRECT_BUY";
  candidateCount: number;
};
export type CollectionFailureCode = "FETCH_FAILED" | "PRODUCT_NOT_FOUND" | "DYNAMIC_RENDER_FAILED" | "DYNAMIC_JOURNEY_FAILED" | "AUTH_CHALLENGE";

export type Report = {
  scanId: string;
  shopId: string;
  targetUrl: string;
  scanStatus: ScanStatus;
  executionMode: ExecutionMode;
  viewport: Viewport;
  purchasePath: PurchasePath;
  authContext?: "ANONYMOUS" | "TEST_ACCOUNT" | "UNKNOWN";
  durationMs: number | null;
  stageTimingsMs?: Partial<Record<Stage | "site-crawl", number>>;
  collectionFailure?: string;
  collectionFailureCode?: CollectionFailureCode;
  coverage: Record<Stage, StageCoverage>;
  surfaceCoverage: Record<SurfaceKind, SurfaceStatus>;
  phaseResults?: PhaseResults;
  ruleCoverage?: RuleCoverage | null;
  priceLedger?: PriceLedger | null;
  snapshots?: Snapshot[];
  interactions?: InteractionEvidence[];
  siteCrawl?: SiteCrawlResult | null;
  surfaceDestinations?: SurfaceDestination[];
  explorationMetrics?: ExplorationMetrics;
  networkPriceEvidence?: NetworkPriceEvidence[];
  reviewClassifications?: ReviewClassification[];
  aiReviewCandidateCount?: number;
  summary: Summary;
  comparison?: Comparison | null;
  explorationBlocker?: ExplorationBlocker | null;
  findings: Finding[];
  reviewCandidates?: ReviewCandidate[];
  surfaceObservations?: SurfaceObservation[];
  aiEligible: boolean;
  aiReview?: AiReview | null;
  aiUsage?: { calls: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number };
};

export type FindingDetail = {
  id: number;
  scanId: string;
  type: FindingType;
  status?: FindingStatus;
  stage: Stage;
  reason: string;
  ruleVersion?: string;
  evidence: Snapshot[];
  evidenceIds?: string[];
  elementBounds?: Bounds;
};

export type HistoryItem = {
  scanId: string;
  status: ScanStatus;
  executionMode: ExecutionMode;
  viewport: Viewport;
  purchasePath: PurchasePath;
  createdAt: string;
  durationMs: number | null;
  summary: { suspected: number; reviewNeeded: number };
};
export type InteractionEvidence = {
  id: string; stage: Stage; kind: "INITIAL_STATE" | "PAID_OPTION_TOGGLE" | "REQUIRED_OPTION_SELECTION" | "NAVIGATION";
  capturedAt: string; controlLabel?: string; beforeSelected?: boolean; afterSelected?: boolean;
  beforeTotalWon?: number | null; afterTotalWon?: number | null; amountDeltaWon?: number | null;
  outcome: "OBSERVED" | "NO_LIVE_CHANGE" | "NOT_APPLICABLE"; revealedText?: string[];
};
export type NetworkPriceEvidence = {
  id: string; stage: Stage; url: string; capturedAt: string; values: { path: string; won: number }[];
};
export type SurfaceDestination = { kind: SurfaceKind; text: string; href: string; source: "LINK" | "BUTTON" };
export type SiteCrawlPage = {
  evidenceId: string; url: string; discoveredFrom: string | null; depth: number; statePath: string[];
  status: number | null; outcome: "OBSERVED" | "FETCH_FAILED"; title: string; text: string; linksFound: number;
  controlsFound: string[]; productCardsFound: string[];
  domText: { tag: string; text: string; visible: boolean; fontSize: string; color: string; opacity: string; bounds: Bounds; href?: string }[];
  interactives: { tag: string; label: string; role: string; type: string; visible: boolean; disabled: boolean; selected?: boolean; href?: string }[];
  formsFound: { method: string; action: string }[]; elementCount: number; hiddenTextElementCount: number;
  outgoingLinks: string[]; bodyTextLength: number; anchorCount: number; interactiveCount: number;
  interactiveInventoryComplete?: boolean;
  capturedAt: string; durationMs?: number; failureReason?: string;
};
export type SiteCrawlResult = {
  complete: boolean; pages: SiteCrawlPage[]; skippedLinks: { url: string; discoveredFrom: string; reason: string }[];
  unexploredControls: { url: string; label: string; reason: string; statePath?: string[] }[];
  nonNavigatingControls: { url: string; label: string; reason: string }[];
  skippedControls: { url: string; label: string; reason: string }[]; pendingUrls: string[];
  discoveredUrlCount: number; visitedUrlCount: number; discoveredStateCount: number; visitedStateCount: number;
  uniqueDiscoveredUrlCount: number; uniqueVisitedUrlCount: number; productCardCount: number; failedUrlCount: number;
  maxDepth: number; durationMs: number; duplicateStates: { url: string; statePath: string[]; duplicateOf: string }[];
  loginReplayed: boolean; stopReason?: string;
};
export type ExplorationMetrics = {
  productLinksFound: number; productLinksConsidered: number; productLinksUnselected: number; productLinksVisited: number;
  surfaceCandidates: number; surfaceCandidatesInspected: number; surfaceCandidatesUninspected: number;
  purchaseActions: number; priceResponses: number;
};
export type ReviewClassification = {
  candidateId: string; label: "FEE" | "PAID_OPTION" | "FLOW" | "UNRESOLVED";
  confidence: number; method: "candidate_kind_mapping" | "unresolved";
};
export type Shop = { id: string; url: string; consentAt?: string | null; verifiedAt?: string | null };
