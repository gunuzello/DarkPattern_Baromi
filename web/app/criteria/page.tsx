import type { Metadata } from "next";
import { DocBlock, SitePage } from "@/components/site/SiteChrome";
import { ResultBadge } from "@/components/ui/Status";
import { rules } from "@/lib/labels";
import type { FindingType } from "@/lib/types";

export const metadata: Metadata = { title: "탐지 기준", description: "바로미가 매번 점검하는 16가지 다크패턴 유형과 각 유형의 증거 방향, 현재 한계입니다." };

/** Spec §5 (evidence direction) and §14 (current limits), in plain wording. */
const detail: Record<FindingType, { evidence: string; limit: string }> = {
  PRESELECTION: { evidence: "사용자가 조작하기 전 유료 옵션이 선택돼 있는지, 해제하면 총액이 바뀌는지", limit: "옵션이 정말 필수인지, 화면 밖 고지가 있었는지는 확정하지 못할 수 있어요." },
  DRIP_PRICING: { evidence: "첫 가격 고지 뒤 장바구니·주문서에서 새로 붙는 필수 비용", limit: "예외 고지나 비용의 법적 성격은 판단하지 않아요." },
  URGENCY_SCARCITY: { evidence: "남은 시간·재고 문구와 확인할 수 있는 근거", limit: "서버의 실제 재고나 카운트다운 데이터는 검증하지 않아요." },
  HIDDEN_INFO: { evidence: "가격·조건·추가 비용의 표시 위치와 누락 신호", limit: "색 대비, 접힘, 정책 문서 전체와의 비교는 아직 하지 않아요." },
  FALSE_DISCOUNT: { evidence: "할인 기준 가격·기간·조건을 확인할 자료", limit: "과거 가격 이력이 없어 할인의 진위를 자동으로 확정하지 않아요." },
  DISGUISED_AD: { evidence: "광고·협찬 표기와 추천·콘텐츠 요소의 관계", limit: "광고주 관계나 표시 가독성은 확인하지 않아요." },
  CONFIRM_SHAMING: { evidence: "같은 결정의 수락·거부 문구 쌍과 압박 표현", limit: "단어 맥락을 잘못 읽을 수 있어 대부분 검토 필요로 둬요." },
  FORCED_ACTION: { evidence: "구매와 무관한 가입·권한 허용 요구와 막힌 위치", limit: "비회원 대안이 있는지 끝까지 확인하지 못할 수 있어요." },
  HIDDEN_SUBSCRIPTION: { evidence: "구독 주기, 체험 종료 후 결제, 기본 선택, 해지 정보", limit: "실제 반복 결제 예약 조건은 검증하지 않아요." },
  SNEAKY_CART_ADD: { evidence: "담기 요청 한 번 뒤 장바구니 품목·수량 변화", limit: "수량을 정확히 읽지 못하거나 장바구니가 비어 있지 않으면 미검사로 둬요." },
  FALSE_RECOMMENDATION: { evidence: "추천·인기·후기 표시와 산정 근거", limit: "추천 산정 데이터나 후기 구매 여부는 확인하지 않아요." },
  BAIT_SELLING: { evidence: "목록의 노출·가격과 상세의 구매 가능 여부 대조", limit: "장기 노출 조건이나 가격 변경 이력은 보지 않아요." },
  TRICK_QUESTION: { evidence: "질문 문구의 부정·조건 표현과 선택 결과의 대응", limit: "언어 모델처럼 의미를 완전히 해석하지 않아요." },
  MISDIRECTED_HIERARCHY: { evidence: "같은 결정군 버튼의 면적 비율과 선택지 노출", limit: "색·명도·스크롤 위치는 아직 평가하지 않아요." },
  CANCELLATION_OBSTRUCTION: { evidence: "취소 경로의 발견 여부, 단계와 차단 사유", limit: "가입과 해지의 단계 수를 자동으로 비교하지 않아요." },
  PRICE_COMPARISON_OBSTRUCTION: { evidence: "단위 가격·총액·조건을 같은 기준으로 비교할 자료", limit: "상품 간 단위 가격 비교 엔진은 아직 없어요." },
};

export default function CriteriaPage() {
  return (
    <SitePage
      title={<>매번 같은 16가지를<br />같은 기준으로 봐요</>}
      lede="모든 보고서에 16가지 유형이 빠짐없이 들어가요. 유형이 들어 있다고 모든 쇼핑몰에서 자동 판정이 가능하다는 뜻은 아니에요. 필요한 증거가 없으면 이유와 함께 미검사로 표시해요."
    >
      <DocBlock title="점검 유형">
        <div className="table-wrap panel">
          <table className="table criteria-table">
            <thead><tr><th style={{ width: 44 }}>#</th><th>유형</th><th>증거 방향</th><th>현재 한계</th></tr></thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.type}>
                  <td className="tnum faint">{String(index + 1).padStart(2, "0")}</td>
                  <td>
                    <span style={{ display: "block", fontWeight: 700 }}>{rule.title}</span>
                    <span className="faint" style={{ fontSize: 13 }}>{rule.name}</span>
                  </td>
                  <td>{detail[rule.type].evidence}</td>
                  <td className="muted">{detail[rule.type].limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocBlock>
      <DocBlock title="판정의 4가지 상태">
        <dl className="doc-dl">
          <div><dt><ResultBadge kind="risk" large /></dt><dd>확인된 사실 증거가 규칙 조건을 충족해 위험 신호가 있어요. 법률 위반 확정은 아니에요.</dd></div>
          <div><dt><ResultBadge kind="review" large /></dt><dd>자동 증거만으로 의미 해석이 끝나지 않아 사람이 더 봐야 해요.</dd></div>
          <div><dt><ResultBadge kind="clear" large /></dt><dd>필요한 범위를 실제로 봤지만 신호를 관찰하지 못했어요. 적법함을 보증하지 않아요.</dd></div>
          <div><dt><ResultBadge kind="none" large /></dt><dd>범위에 도달하지 못했거나 차단됐거나 자료가 부족해요. 구체적인 이유를 함께 보여드려요.</dd></div>
        </dl>
      </DocBlock>
      <DocBlock title="참고한 기준">
        <p className="muted">전자상거래법 제21조의2, 공정거래위원회 온라인 다크패턴 자율관리 가이드라인과 온라인 인터페이스 운영 가이드라인을 참고해요. 기준 링크는 정보 제공용이며 법률 자문을 대신하지 않아요.</p>
      </DocBlock>
    </SitePage>
  );
}
