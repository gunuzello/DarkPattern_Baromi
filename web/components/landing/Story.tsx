"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Status";
import { Icon } from "@/components/ui/Icon";
import { StackModel } from "./StackModel";
import { stageScreens } from "./StageScreens";

const steps: { no: string; stage: string; title: string; body: string; records: string[]; badge?: ReactNode }[] = [
  { no: "01", stage: "상품 상세", title: "미리 선택된 유료 옵션을 찾아요", body: "옵션마다 선택 상태와 금액을 기록해요. 손님이 고르기 전에 체크된 유료 옵션이 있고, 해제하면 총액이 줄어들면 ‘고쳐야 해요’로 표시해요.", records: ["옵션 선택 상태", "옵션별 추가 금액", "해제했을 때 총액"], badge: <Badge kind="risk">고쳐야 해요 1</Badge> },
  { no: "02", stage: "장바구니", title: "화면 금액과 실제 금액을 맞춰봐요", body: "화면에 보인 금액과 쇼핑몰이 주고받은 가격 데이터를 나란히 기록해요. 두 금액이 같을 때만 판정에 써요.", records: ["화면에 보인 합계", "가격 데이터의 합계", "두 값의 일치 여부"], badge: <Badge kind="clear">금액 일치</Badge> },
  { no: "03", stage: "주문서", title: "뒤늦게 붙는 필수 비용을 찾아요", body: "앞 단계에 없던 비용이 새로 생기면 기록해요. 결제 버튼은 누르지 않고 그 앞에서 멈춰요.", records: ["새로 생긴 필수 비용", "결제 예정 금액", "멈춘 위치"], badge: <Badge kind="risk">고쳐야 해요 1</Badge> },
  { no: "04", stage: "결과", title: "16가지 항목을 근거와 함께", body: "고쳐야 해요, 확인해 보세요, 점검 못 했어요, 괜찮아요로 나누고 항목마다 확인 화면과 가격 기록을 연결해요. 고친 뒤엔 같은 조건으로 다시 점검해 비교해요.", records: ["점검한 범위와 못 한 이유", "확인 화면, 문구, 가격 기록", "새로 생김, 다시 보임, 이번에 안 보임"] },
];

/**
 * Hero plus the four steps on the left; on the right a panel that stays in view and shows
 * the model at first, then the real screen for whichever step is being read. The page
 * scrolls normally; nothing is pinned or hijacked.
 */
export function Story({ hero }: { hero: ReactNode }) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const visible = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.step);
        if (entry.isIntersecting) visible.add(index);
        else visible.delete(index);
      }
      setActive(visible.size ? Math.max(...visible) : -1);
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const caption = active < 0 ? "아래로 스크롤하면 단계별 화면을 보여드려요" : `지금 보는 화면: ${stageScreens[active].label}`;

  return (
    <section id="how" aria-label="바로미가 구매 흐름을 진단하는 방법" className="lp-wrap story">
      <div>
        {hero}
        {/* Phones: the sticky panel is hidden, so the model sits under the hero at half height. */}
        <div className="story__inline-model" aria-hidden="true">
          <StackModel />
        </div>
        {steps.map((step, index) => (
          <article key={step.no} ref={(element) => { refs.current[index] = element; }} data-step={index} className="story__step">
            <span className="story__step-no tnum">{step.no} {step.stage}</span>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="t-caption" style={{ fontWeight: 600 }}>기록하는 것</span>
              <ul className="checklist" style={{ color: "var(--ink)" }}>
                {step.records.map((record) => <li key={record}><Icon name="check" size={16} color="var(--link)" />{record}</li>)}
              </ul>
            </div>
            {step.badge ? <div>{step.badge}</div> : null}
            {/* Phones: the screen for this step, right under its text. */}
            {stageScreens[index] ? (
              <div className="story__inline-screen" aria-label={`${stageScreens[index].label} 화면 예시`} role="group">
                {stageScreens[index].node}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="story__stage">
        <div className="stage-panel">
          <div className="stage-panel__view">
            <div className="stage-layer stage-layer--model" data-on={active < 0} aria-hidden={active >= 0}>
              <StackModel />
            </div>
            {stageScreens.map((screen, index) => (
              <div key={screen.key} className="stage-layer stage-screen" data-on={active === index} aria-hidden={active !== index}>
                {screen.node}
              </div>
            ))}
          </div>
          <div className="stage-panel__bar" aria-live="polite">
            <span style={{ fontSize: 14, fontWeight: 600 }}>{caption}</span>
            <span className="step-dots" aria-hidden="true">
              {stageScreens.map((screen, index) => (
                <span key={screen.key} className={index === active ? "is-current" : index < active ? "is-past" : undefined}>{screen.label}</span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
