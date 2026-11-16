import type { CSSProperties, ReactNode } from "react";
import { Mark, plainLabels, VerdictBadge } from "@/components/ui/Status";
import { ResultRing } from "@/components/report/ResultRing";
import { reportItems } from "@/components/report/model";
import { sampleReport } from "@/lib/demo";

const SHIRT = "/landing/linen-shirt.webp";

type LogLine = { tone: "ok" | "warn" | "info"; text: string };

/**
 * A browser window the scanner is working in: "점검 중" chip in the bar, a sweep over the
 * page, and a short inspection log docked at the bottom. Lines appear one by one while the
 * screen is the active step (see .live rules in site.css).
 */
function Browser({ url, log, children }: { url: string; log: LogLine[]; children: ReactNode }) {
  return (
    <div className="browser live">
      <div className="browser__bar">
        <span className="browser__dots" aria-hidden="true"><span /><span /><span /></span>
        <span className="browser__url">{url}</span>
        <span className="live-chip" aria-hidden="true"><i />점검 중</span>
      </div>
      <div className="browser__body live-body">
        <span className="live-sweep" aria-hidden="true" />
        {children}
      </div>
      <ol className="scan-log" aria-label="바로미가 기록한 내용">
        {log.map((line, index) => (
          <li key={line.text} className={`scan-log__line scan-log__line--${line.tone}`} style={{ "--i": index } as CSSProperties}>
            <span aria-hidden="true">{line.tone === "ok" ? "✓" : line.tone === "warn" ? "!" : "›"}</span>{line.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Detection box drawn around what the scanner flagged, with a small label. */
function Detect({ tone, tag, children, style }: { tone: "risk" | "brand"; tag: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`detect detect--${tone}`} style={style}>
      {children}
      <span className="detect__tag">{tag}</span>
      <span className="detect__corners" aria-hidden="true" />
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

/** What the scanner sees at each stage, with the flagged spot marked. */
export const stageScreens: { key: string; label: string; node: ReactNode }[] = [
  {
    key: "product",
    label: "상품 상세",
    node: <>
      <Browser
        url="linen-house.cafe24.com/product/linen-shirt"
        log={[
          { tone: "info", text: "옵션 4개와 위치를 읽었어요" },
          { tone: "warn", text: "파손 보장 +1,500원 · 손님이 누르기 전부터 선택됨" },
          { tone: "info", text: "해제해 보니 총액 30,500원 → 29,000원" },
        ]}
      >
        <div className="pp">
          <div className="pp__gallery">
            <img className="pp__photo" src={SHIRT} alt="데일리 린넨 셔츠 상품 사진" width={720} height={900} loading="lazy" decoding="async" />
            <div className="pp__thumbs" aria-hidden="true">
              <span style={{ backgroundImage: `url(${SHIRT})`, backgroundPosition: "50% 8%" }} />
              <span style={{ backgroundImage: `url(${SHIRT})`, backgroundPosition: "18% 62%" }} />
              <span style={{ backgroundImage: `url(${SHIRT})`, backgroundPosition: "62% 40%" }} />
            </div>
          </div>
          <div className="pp__info">
            <span className="pp__brand">Linen House</span>
            <b className="pp__name">데일리 린넨 셔츠</b>
            <span className="pp__rating" aria-hidden="true">★★★★★ <span>4.8 · 후기 128</span></span>
            <b className="pp__price tnum">29,000원</b>
            <div className="pp__chips" aria-hidden="true">
              <span className="is-on">오트밀</span><span>화이트</span>
              <span className="pp__sep" />
              <span>S</span><span className="is-on">M</span><span>L</span>
            </div>
            <span className="pp__label">추가 옵션</span>
            <Detect tone="risk" tag="사전 선택 · +1,500원">
              <span className="pp__opt is-checked"><i />파손 보장 <span className="tnum">+1,500원</span></span>
            </Detect>
            <span className="pp__opt"><i />선물 포장 <span className="tnum">+2,000원</span></span>
            <div className="pp__buy" aria-hidden="true"><span>장바구니</span><span>바로 구매</span></div>
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
      <Browser
        url="linen-house.cafe24.com/order/basket"
        log={[
          { tone: "info", text: "담기 1번 요청 → 장바구니에 1개" },
          { tone: "info", text: "가격 응답 1건 수집 · total 30500" },
          { tone: "ok", text: "화면 합계와 가격 데이터가 같아요" },
        ]}
      >
        <div className="cart">
          <b className="cart__title">장바구니 <span className="tnum">1</span></b>
          <div className="cart__line">
            <img src={SHIRT} alt="" width={720} height={900} loading="lazy" decoding="async" />
            <div className="cart__meta">
              <b>데일리 린넨 셔츠</b>
              <span>오트밀 / M</span>
              <span className="cart__addon">+ 파손 보장 1,500원</span>
            </div>
            <span className="cart__qty" aria-hidden="true"><i>−</i>1<i>+</i></span>
            <b className="tnum">30,500원</b>
          </div>
          <div className="cart__grid">
            <Detect tone="brand" tag="화면 = 데이터 ✓">
              <div className="cart__sum tnum">
                <div className="money muted"><span>상품 금액</span><span>29,000원</span></div>
                <div className="money muted"><span>옵션</span><span>1,500원</span></div>
                <div className="money money--total"><span>합계</span><span>30,500원</span></div>
              </div>
            </Detect>
            <pre className="cart__net" aria-label="쇼핑몰이 주고받은 가격 데이터">
{`GET /order/basket.json
{
  "items": 1,
  "total": `}<b>30500</b>{`
}`}
            </pre>
          </div>
        </div>
      </Browser>
      <Note badge={<span className="verdict verdict--clear"><Mark kind="clear" />금액 일치</span>}>화면의 합계 30,500원과 쇼핑몰이 주고받은 가격 데이터가 같아요. 같을 때만 판정에 써요.</Note>
    </>,
  },
  {
    key: "checkout",
    label: "주문서",
    node: <>
      <Browser
        url="linen-house.cafe24.com/order/orderform"
        log={[
          { tone: "ok", text: "이름·전화·주소 입력란 3곳을 가렸어요" },
          { tone: "warn", text: "필수 처리비 2,500원 · 앞 단계에 없던 비용" },
          { tone: "info", text: "결제 버튼 앞에서 멈췄어요 · 누르지 않음" },
        ]}
      >
        <div className="co">
          <div className="co__col">
            <b className="cart__title">주문/결제</b>
            <span className="pp__label">배송지</span>
            <span className="co__masked"><i>가림</i>김**</span>
            <span className="co__masked"><i>가림</i>010-****-****</span>
            <span className="co__masked"><i>가림</i>서울시 ***구 ****</span>
            <div className="co__item">
              <img src={SHIRT} alt="" width={720} height={900} loading="lazy" decoding="async" />
              <span>데일리 린넨 셔츠<br /><span className="faint">오트밀 / M · 1개</span></span>
            </div>
          </div>
          <div className="co__col tnum">
            <span className="pp__label">결제 금액</span>
            <div className="money muted"><span>상품과 옵션</span><span>30,500원</span></div>
            <Detect tone="risk" tag="새로 붙은 필수 비용" style={{ margin: "2px -8px" }}>
              <div className="money" style={{ padding: "7px 8px", fontWeight: 700 }}><span>필수 처리비</span><span>2,500원</span></div>
            </Detect>
            <div className="money muted"><span>배송비</span><span>0원</span></div>
            <div className="money money--total"><span>총 결제</span><span>33,000원</span></div>
            <div className="co__pay">
              <span>33,000원 결제하기</span>
              <span className="co__stop">여기서 멈춤</span>
            </div>
          </div>
        </div>
      </Browser>
      <Note badge={<VerdictBadge kind="risk" />}>앞 단계에 없던 필수 처리비 2,500원이 주문서에서 새로 붙었어요. 결제 버튼은 누르지 않았어요.</Note>
    </>,
  },
  {
    key: "report",
    label: "결과",
    node: <>
      <Browser
        url="baromi.app/report/sample"
        log={[
          { tone: "ok", text: "16가지 판정을 마쳤어요" },
          { tone: "info", text: "확인 화면과 가격 기록을 항목마다 연결했어요" },
          { tone: "ok", text: "결과 완성 · 42.3초" },
        ]}
      >
        <div className="mini-report">
          <div className="mini-report__top">
            <ResultRing results={items} size={104} />
            <div className="mini-report__text">
              <b>16가지 중 고쳐야 할 곳 {count("risk")}곳, 확인할 곳 {count("review")}곳이 있어요</b>
              <div className="mini-report__counts tnum">
                {(["risk", "review", "none", "clear"] as const).map((kind) => (
                  <span key={kind}><b className={`rv-count__num--${kind}`}>{count(kind)}</b><Mark kind={kind} />{plainLabels[kind]}</span>
                ))}
              </div>
            </div>
          </div>
          <ul className="mini-report__rows">
            {items.filter((item) => item.kind === "risk").slice(0, 3).map((item) => (
              <li key={item.type}><span className="tnum">{item.no}</span><span>{item.plain}</span></li>
            ))}
          </ul>
        </div>
      </Browser>
      <Note badge={<span className="verdict verdict--clear"><Mark kind="clear" />점검 완료</span>}>16가지 항목을 고쳐야 해요, 확인해 보세요, 점검 못 했어요, 괜찮아요로 나누고 항목마다 확인 화면과 가격 기록을 연결해요.</Note>
    </>,
  },
];
