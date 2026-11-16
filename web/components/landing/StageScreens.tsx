import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Status";

function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="browser">
      <div className="browser__bar"><span className="browser__dots" aria-hidden="true"><span /><span /><span /></span><span className="browser__url">{url}</span></div>
      <div className="browser__body">{children}</div>
    </div>
  );
}

const Pin = ({ color }: { color: string }) => <span className="flag__pin" aria-hidden="true" style={{ background: color }}>1</span>;

function Note({ badge, children, numbered = true }: { badge: ReactNode; children: ReactNode; numbered?: boolean }) {
  return (
    <div className="note-row">
      {numbered ? <span className="note-row__no" aria-hidden="true">1</span> : null}
      <span style={{ display: "flex", flexDirection: "column", gap: 6 }}><span>{badge}</span><span style={{ fontSize: 15, lineHeight: 1.6 }}>{children}</span></span>
    </div>
  );
}

/** What the scanner actually sees at each stage, with the flagged spot marked. */
export const stageScreens: { key: string; label: string; node: ReactNode }[] = [
  {
    key: "product",
    label: "상품 상세",
    node: <>
      <Browser url="linen-house.cafe24.com/product/linen-shirt">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 190px) minmax(0, 1fr)", gap: 22 }}>
          <div className="thumb" style={{ height: 250 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="faint" style={{ fontSize: 13 }}>Linen House</span>
            <b style={{ fontSize: 18 }}>데일리 린넨 셔츠</b>
            <b className="tnum" style={{ fontSize: 20 }}>29,000원</b>
            <span className="faint" style={{ fontSize: 13, marginTop: 4 }}>추가 옵션</span>
            <span className="flag flag--risk" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
              <span style={{ width: 15, height: 15, borderRadius: 3, background: "var(--ink)" }} />파손 보장 (+1,500원)<Pin color="var(--risk)" />
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 6, boxShadow: "inset 0 0 0 1px var(--line)" }}>
              <span style={{ width: 15, height: 15, borderRadius: 3, boxShadow: "inset 0 0 0 1.5px #a0a4ab" }} />선물 포장 (+2,000원)
            </span>
          </div>
        </div>
      </Browser>
      <Note badge={<Badge kind="risk">위험 신호</Badge>}>파손 보장 +1,500원이 손님이 고르기 전부터 체크돼 있어요. 해제하면 총액이 1,500원 줄어요.</Note>
    </>,
  },
  {
    key: "cart",
    label: "장바구니",
    node: <>
      <Browser url="linen-house.cafe24.com/order/basket">
        <div className="tnum" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <b style={{ fontSize: 18 }}>장바구니</b>
          <div style={{ display: "flex", gap: 14, alignItems: "center", paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
            <div className="thumb" style={{ width: 64, height: 64 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><b style={{ fontWeight: 600 }}>데일리 린넨 셔츠</b><span className="faint" style={{ fontSize: 13 }}>옵션: 파손 보장</span></div>
            <b>30,500원</b>
          </div>
          <div className="flag flag--brand" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px" }}>
            <div className="money muted"><span>상품 금액</span><span>29,000원</span></div>
            <div className="money muted"><span>옵션</span><span>1,500원</span></div>
            <div className="money money--total"><span>합계</span><span>30,500원</span></div>
            <Pin color="var(--brand)" />
          </div>
        </div>
      </Browser>
      <Note badge={<Badge kind="clear">금액 일치</Badge>}>화면의 합계 30,500원과 쇼핑몰이 주고받은 가격 데이터가 같아요. 같을 때만 판정에 써요.</Note>
    </>,
  },
  {
    key: "checkout",
    label: "주문서",
    node: <>
      <Browser url="linen-house.cafe24.com/order/orderform">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <b style={{ fontSize: 18 }}>주문/결제</b>
            <span className="faint" style={{ fontSize: 13, marginTop: 4 }}>배송지</span>
            <span>김** 010-****-****</span>
            <span className="faint">서울시 ***구 ****</span>
            <span className="faint" style={{ marginTop: 8, fontSize: 13 }}>개인정보는 가려서 기록해요</span>
          </div>
          <div className="tnum" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="faint" style={{ fontSize: 13 }}>결제 금액</span>
            <div className="money muted"><span>상품과 옵션</span><span>30,500원</span></div>
            <div className="money flag flag--risk" style={{ padding: "9px 10px", margin: "0 -10px", fontWeight: 700 }}><span>필수 처리비</span><span>2,500원</span><Pin color="var(--risk)" /></div>
            <div className="money muted"><span>배송비</span><span>0원</span></div>
            <div className="money money--total"><span>총 결제</span><span>33,000원</span></div>
            <div style={{ marginTop: 6, height: 42, borderRadius: 6, border: "1.5px dashed var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>33,000원 결제하기</div>
          </div>
        </div>
      </Browser>
      <Note badge={<Badge kind="risk">위험 신호</Badge>}>앞 단계에 없던 필수 처리비 2,500원이 주문서에서 새로 붙었어요. 결제 버튼은 누르지 않았어요.</Note>
    </>,
  },
  {
    key: "report",
    label: "보고서",
    node: <>
      <Browser url="baromi.app/report">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <b style={{ fontSize: 20, lineHeight: 1.3 }}>위험 신호 3건, 검토 필요 2건이 있어요</b>
          <div className="tnum" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, padding: "14px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
            {[["위험 신호", "3", "var(--risk)"], ["검토 필요", "2", "var(--review)"], ["미검사", "3", "#a0a4ab"]].map(([label, value, color]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="faint" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />{label}</span>
                <b style={{ fontSize: 28 }}>{value}</b>
              </div>
            ))}
          </div>
          <div className="quiet" style={{ fontSize: 13, lineHeight: 1.6 }}><b>개선 방법</b> 유료 옵션의 기본 선택을 해제하고 구매자가 직접 선택하게 하세요.</div>
        </div>
      </Browser>
      <Note badge={<Badge kind="done">보고서</Badge>} numbered={false}>16가지 항목을 위험, 검토 필요, 안전, 미검사로 나누고 스크린샷과 가격 원장으로 근거를 연결해요.</Note>
    </>,
  },
];
