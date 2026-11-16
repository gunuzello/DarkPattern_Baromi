import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Story } from "@/components/landing/Story";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import Link from "next/link";
import { Mark, plainLabels, VerdictBadge } from "@/components/ui/Status";
import { ResultRing } from "@/components/report/ResultRing";
import { reportItems } from "@/components/report/model";
import { sampleReport } from "@/lib/demo";
import { rules } from "@/lib/labels";
import { PriceBars } from "@/components/landing/PriceBars";
import { WaitlistForm } from "@/components/landing/WaitlistForm";

const promises: { icon: IconName; title: string; body: string }[] = [
  { icon: "check", title: "근거 없이 단정하지 않아요", body: "결과는 법률 판단이 아니라 가이드라인 기준의 위험 신호이고, 모든 결과에 증거를 연결해요." },
  { icon: "eye", title: "검사하지 못한 범위를 숨기지 않아요", body: "미검사 영역과 멈춘 이유를 보고서에 그대로 남겨요." },
  { icon: "x", title: "결제와 주문 확정은 누르지 않아요", body: "소유를 확인한 쇼핑몰에서만 구매 흐름을 열고, 결제 버튼 앞에서 멈춰요." },
  { icon: "lock", title: "추가 인증은 우회하지 않아요", body: "OTP와 보안 문자가 나오면 멈추고, 테스트 계정 비밀번호는 진단 뒤 삭제해요." },
];

const sampleItems = reportItems(sampleReport);
const sampleCount = (kind: "risk" | "review" | "none" | "clear") => sampleItems.filter((item) => item.kind === kind).length;

export default function Home() {
  const hero = (
    <div id="top" className="story__hero">
      <p className="eyebrow" style={{ marginBottom: -8 }}>쇼핑몰 운영자를 위한 다크패턴 진단</p>
      <h1 className="t-display">주문서까지<br />대신 눌러봐요.</h1>
      <p className="story__lede">쇼핑몰 운영자를 대신해 바로미가 공개 화면부터 상품 상세, 장바구니, 주문서까지 실제 구매 흐름을 따라가고, 16가지 다크패턴 위험 신호를 근거와 함께 정리해요.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <ButtonLink href="/scan/new" variant="brand" size="lg">무료로 진단하기</ButtonLink>
        <ButtonLink href="/report/sample" variant="secondary" size="lg">예시 보고서 보기</ButtonLink>
      </div>
      <ul className="checklist" style={{ marginTop: 8 }}>
        <li><Icon name="check" size={16} color="var(--link)" />주소만으로 공개 화면 진단부터 시작해요</li>
        <li><Icon name="check" size={16} color="var(--link)" />결제와 주문 확정은 누르지 않아요</li>
        <li><Icon name="check" size={16} color="var(--link)" />OTP와 보안 문자는 우회하지 않아요</li>
      </ul>
    </div>
  );

  return (
    <div className="lp">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <SiteHeader />

      <main id="main">
        <Story hero={hero} />

        <section id="report" className="lp-band">
          <div className="lp-wrap lp-section">
            <div className="lp-section__head">
              <h2 style={{ maxWidth: "12em", fontSize: "clamp(34px, 4vw, 48px)", lineHeight: 1.12, letterSpacing: "-0.035em", fontWeight: 800 }}>결과는 숫자로<br />먼저 보여드려요</h2>
              <p>보고서 첫 화면에서 무엇을 고쳐야 하는지, 금액이 어디서 얼마나 늘었는지 바로 보여요.</p>
            </div>
            <div className="panel lp-result">
              <div className="lp-result__head">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="rv-summary__chips">
                    <span className="rv-chip rv-chip--state"><span className="rv-dot" />점검 완료</span>
                    <span className="rv-chip">무료 기본 점검</span>
                    <span className="rv-chip rv-chip--brand">예시</span>
                  </div>
                  <span className="lp-result__title">쇼핑몰 점검 결과</span>
                  <span className="rv-summary__site">점검한 쇼핑몰 <b>linen-house.cafe24.com</b></span>
                </div>
                <ButtonLink href="/report/sample" variant="secondary">예시 결과 열기</ButtonLink>
              </div>

              <div className="lp-result__body">
                <div className="lp-result__summary">
                  <ResultRing results={sampleItems} />
                  <div className="rv-summary__text">
                    <span className="rv-summary__headline">16가지 중 고쳐야 할 곳 {sampleCount("risk")}곳, 확인할 곳 {sampleCount("review")}곳이 있어요</span>
                    <p className="rv-summary__note">점검 못 한 {sampleCount("none")}가지는 이유와 예방 방법을 함께 알려드려요. ‘괜찮아요’는 점검한 범위에서 문제가 안 보였다는 뜻이고, 법적으로 문제없다는 보증은 아니에요.</p>
                    <ul className="rv-counts">
                      {(["risk", "review", "none", "clear"] as const).map((kind) => (
                        <li key={kind} className="rv-count" style={{ cursor: "default" }}>
                          <span className={`rv-count__num rv-count__num--${kind} tnum`}>{sampleCount(kind)}</span>
                          <span className="rv-count__label"><Mark kind={kind} />{plainLabels[kind]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rv-list lp-result__list">
                  {(["risk", "review"] as const).map((kind) => (
                    <section key={kind} className={`rv-group rv-group--${kind}`} aria-label={plainLabels[kind]}>
                      <div className="rv-group__head"><span className="rv-group__title"><VerdictBadge kind={kind} />{plainLabels[kind]}</span></div>
                      <ul className="rv-rows">
                        {sampleItems.filter((item) => item.kind === kind).map((item) => (
                          <li key={item.type}>
                            <Link href="/report/sample" className="rv-row">
                              <span className="rv-row__no tnum">{item.no}</span>
                              <span className="rv-row__text">
                                <span className="rv-row__title">{item.plain}</span>
                                <span className="rv-row__summary">{item.summary}</span>
                              </span>
                              <Icon name="chevron" size={16} color="var(--ink-3)" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </div>

              <PriceBars />
            </div>
          </div>
        </section>

        <section id="checks" aria-labelledby="checks-title" className="lp-wrap lp-section" style={{ paddingBottom: 0 }}>
          <div className="lp-section__head">
            <h2 id="checks-title" className="t-section">매번 같은 16가지를 점검해요</h2>
            <p>공개 화면부터 구독·해지 흐름까지, 항목마다 어디서 확인하는지 정해져 있어요.</p>
          </div>
          <ol className="grid-4 checks16">
            {rules.map((rule, index) => (
              <li key={rule.type}>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: "var(--link)" }}>{String(index + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 16, lineHeight: 1.45, fontWeight: 700 }}>{rule.name}</span>
                <span className="faint" style={{ fontSize: 13 }}>{rule.where}</span>
              </li>
            ))}
          </ol>
          <div className="duo">
            <div>
              <span style={{ fontSize: 20, fontWeight: 700 }}>공개 화면 진단</span>
              <span className="muted">주소만으로 바로 시작해요.</span>
              <ul className="checklist" style={{ color: "var(--ink)" }}>
                {["공개 첫 화면과 상품 상세의 처음 모습", "상품 목록, 쿠폰, 추천, 정책 화면 링크", "장바구니와 주문서는 미검사로 표시"].map((t) => <li key={t}><Icon name="check" size={16} color="var(--link)" />{t}</li>)}
              </ul>
            </div>
            <div>
              <span style={{ fontSize: 20, fontWeight: 700 }}>전체 구매 흐름 진단</span>
              <span className="muted">상점 소유를 확인하고 별도 브라우저 세션에서 진행해요.</span>
              <ul className="checklist" style={{ color: "var(--ink)" }}>
                {["상품 상세, 장바구니, 주문서의 선택 상태와 추가 비용", "화면 가격과 API 가격 비교", "테스트 계정이 있으면 로그인, 구독, 해지 흐름까지"].map((t) => <li key={t}><Icon name="check" size={16} color="var(--link)" />{t}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="trust-title" className="lp-wrap lp-section">
          <h2 id="trust-title" className="t-section">바로미가 지키는 것</h2>
          <ul className="grid-4" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {promises.map((item) => (
              <li key={item.title} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Icon name={item.icon} size={24} color="var(--ink)" />
                <span style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 700 }}>{item.title}</span>
                <span className="muted" style={{ fontSize: 15 }}>{item.body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="pricing" aria-labelledby="pricing-title" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="lp-wrap lp-section">
            <div className="lp-section__head">
              <h2 id="pricing-title" className="t-section">요금제</h2>
              <p>출시 전에는 무료로 진단할 수 있어요. 정식 요금은 실제 쇼핑몰 평가를 마친 뒤 안내해요.</p>
            </div>
            <div className="duo">
              <div>
                <span style={{ fontSize: 18, fontWeight: 700 }}>기본 진단</span>
                <span style={{ fontSize: 40, lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 800 }}>출시 전 무료</span>
                <p className="muted">기본 엔진으로 16가지 항목을 진단하고, 근거가 연결된 보고서를 받아보세요. 정식 요금은 평가 후 안내해요.</p>
                <div style={{ marginTop: "auto" }}><ButtonLink href="/scan/new" variant="brand">무료로 진단하기</ButtonLink></div>
              </div>
              <div>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>AI 정밀 분석</span>
                  <span className="soon-badge">준비 중</span>
                </span>
                <span className="faint" style={{ fontSize: 40, lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 800 }}>유료 예정</span>
                <p className="muted">기본 보고서의 검토 필요 후보만 별도로 분석하는 후속 기능이에요. 기존 증거와 판정은 덮어쓰지 않아요. 요금은 출시할 때 안내해요.</p>
                <div style={{ marginTop: "auto" }}><WaitlistForm /></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section aria-labelledby="closing-title" className="lp-closing">
        <div className="lp-wrap lp-closing__inner">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 id="closing-title" style={{ fontSize: "clamp(40px, 5vw, 56px)", lineHeight: 1.08, letterSpacing: "-0.04em", fontWeight: 800 }}>쇼핑몰을<br />더 바르게.</h2>
            <p>주소만 넣으면 오늘 바로 첫 보고서를 받아볼 수 있어요.</p>
          </div>
          <ButtonLink href="/scan/new" variant="brand" size="lg">무료로 진단하기</ButtonLink>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
