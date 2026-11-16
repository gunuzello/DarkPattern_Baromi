import type {
  CollectionFailureCode, ExplorationBlocker, FindingType, ScanStatus, Stage, StageCoverage, SurfaceKind, SurfaceStatus,
} from "./types";

export const stageLabels: Record<Stage, string> = { product: "상품 상세", cart: "장바구니", checkout: "주문서" };

export const surfaceLabels: Record<SurfaceKind, string> = {
  CATALOG: "상품 목록·카테고리·검색",
  AUTH: "로그인·회원가입",
  COUPON: "쿠폰·프로모션",
  RECOMMENDATION: "추천·인기·후기",
  SUBSCRIPTION: "구독·멤버십·자동 갱신",
  CANCELLATION: "해지·탈퇴·환불",
  POLICY: "배송·교환·반품·정책",
};

export const surfaceStatusLabels: Record<SurfaceStatus, string> = {
  COVERED: "검사 완료",
  DISCOVERED: "후보 발견, 상세 미검사",
  BLOCKED: "접근 실패",
  NOT_FOUND: "경로 미발견",
  PENDING: "탐색 대기",
  SKIPPED: "전체 구매 흐름 점검에서 확인",
};

export function stageCoverageLabel(value: StageCoverage, staticMode: boolean): string {
  if (value === "COVERED") return staticMode ? "초기 HTML만 확인" : "검사 완료";
  if (value === "SKIPPED") return "선택 경로에 없음";
  if (value === "BLOCKED") return "미검사";
  return "대기";
}

/** One expectation for scan length everywhere it is mentioned (form, progress). */
export const scanDurationHint = "보통 5분 안팎이에요. 사이트 응답에 따라 달라져요.";

export const scanStatusLabels: Record<ScanStatus, string> = {
  QUEUED: "대기 중",
  RUNNING: "점검 중",
  COMPLETED: "점검 완료",
  PARTIAL: "일부만 점검",
  FAILED: "점검 실패",
  CANCELLED: "점검 중단",
};

/**
 * The 16 checks, in the order the report always shows them.
 * `name` is the plain wording for shop owners, `title`/`reference`/`recommendation`
 * follow `src/legal-rules.ts` in the backend.
 */
export const rules: { type: FindingType; name: string; title: string; reference: string; source: string; recommendation: string; where: string }[] = [
  { type: "PRESELECTION", name: "특정 옵션·부가서비스 사전 선택", title: "특정 옵션의 사전선택", reference: "전자상거래법 제21조의2제1항제2호", source: "https://law.go.kr/LSW/lsRvsDocListP.do?lsId=009318", recommendation: "유료 옵션의 기본 선택을 해제하고 구매자가 직접 선택하게 하세요.", where: "상품 상세" },
  { type: "DRIP_PRICING", name: "상품·장바구니·주문서에서 뒤늦게 붙는 비용", title: "순차공개 가격책정", reference: "전자상거래법 제21조의2제1항제1호", source: "https://law.go.kr/LSW/lsRvsDocListP.do?lsId=009318", recommendation: "첫 가격 표시 화면에 필수 비용을 포함한 총금액을 표시하세요. 예외 사유가 있다면 고지 요건을 확인하세요.", where: "상품, 장바구니, 주문서" },
  { type: "URGENCY_SCARCITY", name: "마감 임박·재고 부족을 이용한 긴급성/희소성 표시", title: "긴급성·희소성 표현 검토 필요", reference: "공정위 다크패턴 자율관리 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "카운트다운과 재고 표시가 실제 근거와 일치하는지 확인하고, 근거 없는 압박성 표현은 제거하세요.", where: "공개 화면, 상품 상세" },
  { type: "HIDDEN_INFO", name: "숨겨진 비용·중요 정보", title: "중요 정보의 축소·누락", reference: "공정위 온라인 다크패턴 자율관리 가이드라인", source: "https://tf2.ftc.go.kr/DATA/download/www/cts304_2023_file.pdf", recommendation: "구매 조건과 추가 비용을 같은 화면에서 확인할 수 있게 표시하세요.", where: "구매 흐름 전체" },
  { type: "FALSE_DISCOUNT", name: "허위 할인·과장된 할인율", title: "할인·정가 표시 검토", reference: "공정위 온라인 다크패턴 자율관리 가이드라인", source: "https://tf2.ftc.go.kr/DATA/download/www/cts304_2023_file.pdf", recommendation: "할인 기준 가격, 적용 조건, 기간을 소비자가 확인할 수 있게 표시하세요.", where: "공개 화면, 상품 상세" },
  { type: "DISGUISED_AD", name: "광고를 일반 콘텐츠처럼 위장", title: "위장 광고 검토", reference: "공정위 온라인 다크패턴 자율관리 가이드라인", source: "https://tf2.ftc.go.kr/DATA/download/www/cts304_2023_file.pdf", recommendation: "광고·협찬·추천 콘텐츠임을 일반 콘텐츠와 구분되게 표시하세요.", where: "공개 화면" },
  { type: "CONFIRM_SHAMING", name: "취소·거절을 어렵게 만드는 문구", title: "거부 선택지 압박 검토", reference: "공정위 온라인 다크패턴 자율관리 가이드라인", source: "https://tf2.ftc.go.kr/DATA/download/www/cts304_2023_file.pdf", recommendation: "거부 선택지를 불리하거나 모욕적으로 표현하지 마세요.", where: "팝업, 선택지" },
  { type: "FORCED_ACTION", name: "특정 행동을 강제로 유도하는 흐름", title: "불필요한 행동 요구 검토", reference: "공정위 온라인 다크패턴 자율관리 가이드라인", source: "https://tf2.ftc.go.kr/DATA/download/www/cts304_2023_file.pdf", recommendation: "구매와 직접 관련 없는 가입·공유·알림 허용을 필수 단계로 만들지 마세요.", where: "로그인, 회원가입" },
  { type: "HIDDEN_SUBSCRIPTION", name: "멤버십·구독 자동 연장", title: "자동 갱신·구독 조건 검토", reference: "공정위 온라인 다크패턴 자율관리 가이드라인", source: "https://tf2.ftc.go.kr/DATA/download/www/cts304_2023_file.pdf", recommendation: "무료 체험 종료 후 결제와 자동 갱신 조건을 결제 전에 명확히 알리세요.", where: "구독·멤버십 화면" },
  { type: "SNEAKY_CART_ADD", name: "장바구니에 상품이나 옵션을 몰래 추가", title: "몰래 장바구니 추가", reference: "공정위 온라인 인터페이스 운영 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "사용자가 요청하지 않은 상품·서비스를 장바구니에 추가하지 마세요.", where: "장바구니" },
  { type: "FALSE_RECOMMENDATION", name: "근거가 불명확한 추천·인기 표시", title: "거짓 추천", reference: "공정위 온라인 인터페이스 운영 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "추천·인기·후기 근거와 대상 상품을 실제 데이터와 일치시키세요.", where: "추천·인기 영역" },
  { type: "BAIT_SELLING", name: "광고 상품과 실제 판매 상품의 불일치", title: "유인 판매", reference: "공정위 온라인 인터페이스 운영 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "유인에 사용한 상품을 실제로 구매할 수 있게 하고 재고·판매 조건을 정확히 표시하세요.", where: "공개 화면, 상품 상세" },
  { type: "TRICK_QUESTION", name: "헷갈리게 만든 질문·선택지", title: "속임수 질문", reference: "공정위 온라인 인터페이스 운영 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "질문 문구와 선택지의 의미를 명확히 하고 의도와 반대되는 선택을 유도하지 마세요.", where: "선택지, 동의 화면" },
  { type: "MISDIRECTED_HIERARCHY", name: "강조 버튼·배치로 특정 선택 유도", title: "잘못된 계층구조", reference: "공정위 온라인 인터페이스 운영 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "구매·동의 버튼만 과도하게 강조하거나 거부·취소 선택지를 숨기지 마세요.", where: "구매 흐름 전체" },
  { type: "CANCELLATION_OBSTRUCTION", name: "해지·환불 경로 방해", title: "취소·탈퇴 등의 방해", reference: "공정위 온라인 인터페이스 운영 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "마이페이지 등에서 취소·탈퇴 경로를 쉽게 찾고 가입보다 어렵게 만들지 마세요.", where: "해지·환불 링크와 흐름" },
  { type: "PRICE_COMPARISON_OBSTRUCTION", name: "가격 비교 기준을 불리하게 제시", title: "가격비교 방해", reference: "공정위 온라인 인터페이스 운영 가이드라인", source: "https://www.korea.kr/briefing/pressReleaseView.do?newsId=156784349", recommendation: "단위 가격·총액·조건을 동일한 기준으로 비교할 수 있게 표시하세요.", where: "상품 상세, 목록" },
];
export const ruleByType = Object.fromEntries(rules.map((rule) => [rule.type, rule])) as Record<FindingType, (typeof rules)[number]>;

/** Which checks depend on a surface that may not have been reached. */
export const ruleSurface: Partial<Record<FindingType, SurfaceKind>> = {
  FORCED_ACTION: "AUTH",
  HIDDEN_SUBSCRIPTION: "SUBSCRIPTION",
  CANCELLATION_OBSTRUCTION: "CANCELLATION",
  FALSE_RECOMMENDATION: "RECOMMENDATION",
};

export const collectionFailureLabels: Record<CollectionFailureCode, string> = {
  FETCH_FAILED: "첫 화면 접근 실패",
  PRODUCT_NOT_FOUND: "상품 상세 미발견",
  DYNAMIC_RENDER_FAILED: "동적 화면 렌더링 실패",
  DYNAMIC_JOURNEY_FAILED: "구매 흐름 수집 실패",
  AUTH_CHALLENGE: "추가 인증으로 중단",
};

export function blockerText(blocker: ExplorationBlocker): string {
  const action = blocker.action === "ADD_TO_CART" ? "장바구니 담기" : blocker.action === "DIRECT_BUY" ? "바로구매" : "주문서 이동";
  const reason = {
    LOGIN_REQUIRED: "승인된 테스트 계정이나 로그인 세션이 없어 확인하지 못했어요.",
    ACTION_AMBIGUOUS: `후보 ${blocker.candidateCount}개 중 하나로 확정하지 못했어요. 임의로 누르지 않았어요.`,
    ACTION_FAILED: "누른 뒤 화면 상태가 바뀌는 것을 확인하지 못했어요.",
    ACTION_NOT_FOUND: "버튼을 찾지 못했어요.",
  }[blocker.code];
  return `${stageLabels[blocker.stage]}에서 ${action} 경로를 ${reason}`;
}

export const operatorLabelOptions = [
  { value: "LIKELY_RISK", label: "위험 가능성" },
  { value: "NEEDS_REVIEW", label: "검토 필요" },
  { value: "LIKELY_BENIGN", label: "정상 가능성" },
  { value: "INSUFFICIENT_EVIDENCE", label: "증거 부족" },
] as const;
