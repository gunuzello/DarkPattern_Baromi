import type { ReactNode } from "react";
import { Mark, plainLabels, VerdictBadge } from "@/components/ui/Status";
import { reportItems } from "@/components/report/model";
import { sampleReport } from "@/lib/demo";

const SHIRT = "/landing/linen-shirt.webp";

/** A plain browser window with the real product photo; only the flagged spot is marked. */
function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="browser">
      <div className="browser__bar">
        <span className="browser__dots" aria-hidden="true"><span /><span /><span /></span>
        <span className="browser__url">{url}</span>
      </div>
      <div className="browser__body">{children}</div>
    </div>
  );
}

/** The one thing each screen is about: an outline and a short label. */
function Spot({ tone, tag, children }: { tone: "risk" | "brand"; tag: string; children: ReactNode }) {
  return (
    <div className={`spot spot--${tone}`}>
      {children}
      <span className="spot__tag">{tag}</span>
    </div>
  );
}

function Note({ children, badge }: { children: ReactNode; badge: ReactNode }) {
  return (
    <div className="note-row">
      <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>{badge}</span>
        <span style={{ fontSize: 15, lineHeight: 1.6 }}>{children}</span>
      </span>
    </div>
  );
}

const items = reportItems(sampleReport);
const count = (kind: "risk" | "review" | "none" | "clear") => items.filter((item) => item.kind === kind).length;

/** What the scanner sees at each stage. */
export const stageScreens: { key: string; label: string; node: ReactNode }[] = [
  {
    key: "product",
    label: "상품 상세",
    node: <>
      <Browser url="linen-house.cafe24.com/product/linen-shirt">
        <div className="pp">
          <img className="pp__photo" src={SHIRT} alt="데일리 린넨 셔츠 상품 사진" width={720} height={900} loading="lazy" decoding="async" />
          <div className="pp__info">
            <span className="pp__brand">Linen House</span>
            <b className="pp__name">데일리 린넨 셔츠</b>
            <b className="pp__price tnum">29,000원</b>
            <span className="pp__label">추가 옵션</span>
            <Spot tone="risk" tag="미리 선택됨">
              <span className="pp__opt is-checked"><i />파손 보장 <span className="tnum">+1,500원</span></span>
            </Spot>
            <span className="pp__opt"><i />선물 포장 <span className="tnum">+2,000원</span></span>
          </div>
        </div>
      </Browser>
      <Note badge={<VerdictBadge kind="risk" />}>파손 보장 +1,500원이 손님이 고르기 전부터 체크돼 있어요. 해제하면 총액이 1,500원 줄어요.</Note>
    </>,
  },
  {
    key: "cart",
    label: "장바구니",
    node: <>
      <Browser url="linen-house.cafe24.com/order/basket">
        <div className="cart">
          <div className="cart__line">
            <img src={SHIRT} alt="" width={720} height={900} loading="lazy" decoding="async" />
            <div className="cart__meta">
              <b>데일리 린넨 셔츠</b>
              <span>옵션: 파손 보장</span>
            </div>
            <b className="tnum">30,500원</b>
          </div>
          <Spot tone="brand" tag="두 금액이 같아요">
            <div className="cart__sum tnum">
              <div className="money"><span>화면에 보인 합계</span><span>30,500원</span></div>
              <div className="money"><span>쇼핑몰 가격 데이터</span><span>30,500원</span></div>
            </div>
          </Spot>
        </div>
      </Browser>
      <Note badge={<span className="verdict verdict--clear"><Mark kind="clear" />금액 일치</span>}>화면의 합계와 쇼핑몰이 주고받은 가격 데이터가 같아요. 같을 때만 판정에 써요.</Note>
    </>,
  },
  {
    key: "checkout",
    label: "주문서",
    node: <>
      <Browser url="linen-house.cafe24.com/order/orderform">
        <div className="co">
          <div className="co__col">
            <b className="co__title">주문/결제</b>
            <span className="pp__label">배송지 (개인정보는 가려서 기록해요)</span>
            <span>김** · 010-****-****</span>
          </div>
          <div className="co__col tnum">
            <div className="money muted"><span>상품과 옵션</span><span>30,500원</span></div>
            <Spot tone="risk" tag="새로 붙은 비용">
              <div className="money" style={{ padding: "7px 8px", fontWeight: 700 }}><span>필수 처리비</span><span>2,500원</span></div>
            </Spot>
            <div className="money money--total"><span>총 결제</span><span>33,000원</span></div>
            <span className="co__stop">결제 버튼은 누르지 않고 여기서 멈춰요</span>
          </div>
        </div>
      </Browser>
      <Note badge={<VerdictBadge kind="risk" />}>앞 단계에 없던 필수 처리비 2,500원이 주문서에서 새로 붙었어요.</Note>
    </>,
  },
  {
    key: "report",
    label: "결과",
    node: <>
      <Browser url="baromi.app/report/sample">
        <div className="mini-report">
          <b className="mini-report__title">16가지 중 고쳐야 할 곳 {count("risk")}곳, 확인할 곳 {count("review")}곳이 있어요</b>
          <ul className="mini-report__counts tnum">
            {(["risk", "review", "none", "clear"] as const).map((kind) => (
              <li key={kind}><b className={`rv-count__num--${kind}`}>{count(kind)}</b><span><Mark kind={kind} />{plainLabels[kind]}</span></li>
            ))}
          </ul>
        </div>
      </Browser>
      <Note badge={<span className="verdict verdict--clear"><Mark kind="clear" />점검 완료</span>}>항목마다 확인 화면과 가격 기록을 연결하고, 무엇을 고치면 되는지 알려드려요.</Note>
    </>,
  },
];
