import type { RuleType } from "./rule-strategy";

/** These are interpretation boundaries, not substitute evidence. */
export const aiRuleRubrics: Record<RuleType, string> = {
  PRESELECTION: "초기 선택 상태와 비용·동의의 선택 가능 여부를 대조한다. 사용자가 직접 선택했다면 안전 근거다.",
  DRIP_PRICING: "동일 상품의 초기 가격과 최종 필수 총액을 비교한다. 미리 명시한 배송비와 선택형 비용은 구별한다.",
  URGENCY_SCARCITY: "타이머·재고·접속자 표현과 실제 관찰된 변화만 판단한다. 실재고나 실제 접속자 수는 화면만으로 단정하지 않는다.",
  HIDDEN_INFO: "중요 조건의 고지 시점과 화면상 가시성을 본다. 단순히 정보량이 많다는 이유로 위험이라 하지 않는다.",
  FALSE_DISCOUNT: "표시 기준가·할인율의 산술 일치 여부를 확인한다. 과거 실제 판매가는 외부 이력 없이는 확인 불가다.",
  DISGUISED_AD: "추천·후기·광고 표시의 위치와 관계를 본다. 광고 계약 존재 여부는 화면만으로 확정하지 않는다.",
  CONFIRM_SHAMING: "같은 결정의 수락·거절 문구를 함께 비교한다. 명확하고 중립적인 거절 문구는 안전 근거다.",
  FORCED_ACTION: "구매 진행에 가입·권한 동의가 실제로 필수인지 본다. 선택 가능한 가입 제안은 강제가 아니다.",
  HIDDEN_SUBSCRIPTION: "체험 가격·향후 청구액·주기·자동 갱신 고지의 시점과 가시성을 함께 본다.",
  SNEAKY_CART_ADD: "장바구니 전후의 상품·수량·서비스 변화를 비교한다. 사용자가 명시적으로 추가한 것은 제외한다.",
  FALSE_RECOMMENDATION: "인기·순위·후기의 객관적 주장과 제공된 근거를 대조한다. 실제 판매·후기 데이터 없이 허위라고 단정하지 않는다.",
  BAIT_SELLING: "동일 상품의 목록 광고와 상세 구매 가능 상태, 대체 상품 유도 여부를 대조한다.",
  TRICK_QUESTION: "질문의 부정·조건 표현과 실제 선택 결과를 함께 본다. 단순히 복잡한 문장만으로 위험이라 하지 않는다.",
  MISDIRECTED_HIERARCHY: "동일 결정군의 수락·거절 버튼 크기·대비·위치·접근성을 비교한다. 서로 다른 행동은 비교하지 않는다.",
  CANCELLATION_OBSTRUCTION: "가입·결제 경로와 해지·환불 경로의 실제 단계·필수 입력·접근성을 대조한다.",
  PRICE_COMPARISON_OBSTRUCTION: "월액·약정·총액의 표시 시점을 비교한다. 계산 가능한 총액이 처음부터 명확하면 안전 근거다.",
};
