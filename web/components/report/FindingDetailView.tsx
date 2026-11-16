"use client";

import { useEffect, useState } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Mark, VerdictBadge } from "@/components/ui/Status";
import { api, ApiError, errorMessage } from "@/lib/api";
import { guide } from "@/lib/guide";
import { ruleByType, rules, stageLabels } from "@/lib/labels";
import { useBackToLogin } from "@/lib/session";
import type { FindingDetail } from "@/lib/types";
import { EvidenceShot } from "./EvidenceShot";
import { Block, Checklist } from "./TypeDetail";

/**
 * One finding with every captured screen, larger than the report's side panel.
 * Same wording and verdict badges as the report (고쳐야 해요 / 확인해 보세요).
 */
export function FindingDetailView({ scanId, findingId }: { scanId: string; findingId: string }) {
  const [detail, setDetail] = useState<FindingDetail>();
  const [error, setError] = useState("");
  const backToLogin = useBackToLogin();

  useEffect(() => {
    let alive = true;
    api.getFinding(findingId, scanId)
      .then((result) => { if (alive) setDetail(result); })
      .catch((cause) => {
        if (!alive) return;
        if (cause instanceof ApiError && cause.sessionLost) { backToLogin(); return; }
        setError(cause instanceof ApiError && cause.status === 404
          ? "이 항목을 찾지 못했어요. 결과가 삭제됐거나 다른 계정의 결과일 수 있어요."
          : errorMessage(cause, "항목을 불러오지 못했어요."));
      });
    return () => { alive = false; };
  }, [findingId, scanId, backToLogin]);

  const back = `/report/${encodeURIComponent(scanId)}`;
  if (!detail) {
    return error
      ? <Alert kind="error" title={error} actions={<><ButtonLink variant="secondary" size="sm" href={back}>점검 결과로 돌아가기</ButtonLink><ButtonLink variant="tertiary" size="sm" href="/shops">내 쇼핑몰</ButtonLink></>} />
      : <p role="status" className="muted">확인 화면을 불러오고 있어요.</p>;
  }

  const rule = ruleByType[detail.type];
  const g = guide[detail.type];
  const kind = detail.status === "REVIEW_NEEDED" ? "review" : "risk";
  const no = String(rules.findIndex((item) => item.type === detail.type) + 1).padStart(2, "0");

  return (
    <>
      <PageHead
        title="확인 화면"
        crumbs={[{ label: "점검 결과", href: back }, { label: g.plain }]}
        actions={<ButtonLink variant="secondary" href={back}>점검 결과로 돌아가기</ButtonLink>}
      />

      <article className={`rv-detail rv-detail--${kind} fd-card`} aria-labelledby="fd-title">
        <header className="rv-detail__head">
          <div className="rv-detail__meta">
            <VerdictBadge kind={kind} />
            <span className="tnum faint">{no}</span>
            <span className="faint">· {stageLabels[detail.stage]}에서 찾았어요</span>
          </div>
          <h2 id="fd-title" className="rv-detail__title">{g.plain}</h2>
          <p className="rv-detail__lede">
            {kind === "risk" ? g.criteria : "관련된 내용은 찾았지만 기준만으로는 문제인지 확실히 말하기 어려워요. ‘고쳐야 해요’로 판단한 것은 아니에요."}
          </p>
        </header>
        <Block title={kind === "risk" ? "무엇이 문제였나요?" : "찾은 내용"}>
          <p className="fd-reason">{detail.reason}</p>
        </Block>
        {kind === "risk" ? (
          <Block title="이렇게 고쳐 보세요">
            <Checklist id={`fd-${detail.id}`} items={[...g.fixes, "고친 뒤 같은 조건으로 다시 점검해서 결과를 비교하세요"]} />
          </Block>
        ) : (
          <Block title="아직 확실하지 않은 점">
            <p>{g.limit}</p>
          </Block>
        )}
      </article>

      <section aria-labelledby="fd-shots" className="fd-shots">
        <h2 id="fd-shots" className="t-title" style={{ fontSize: 20 }}>단계별 확인 화면</h2>
        <div className="fd-shots__grid">
          {detail.evidence.map((snapshot) => {
            const hit = snapshot.stage === detail.stage;
            return (
              <figure key={snapshot.stage} className={hit ? "fd-shot is-hit" : "fd-shot"}>
                <figcaption>
                  <b>{stageLabels[snapshot.stage]}</b>
                  {hit ? <span className={`verdict verdict--${kind}`}><Mark kind={kind} />여기서 찾았어요</span> : null}
                </figcaption>
                <EvidenceShot
                  scanId={detail.scanId}
                  stage={snapshot.stage}
                  area={snapshot.screenshotArea}
                  element={hit ? detail.elementBounds : undefined}
                  priceLines={snapshot.priceLines}
                />
                <span className="fd-shot__url mono">{snapshot.url}</span>
              </figure>
            );
          })}
        </div>
      </section>

      <section className="fd-basis">
        <div>
          <span className="fd-basis__label">판단 기준</span>
          <a href={rule.source} target="_blank" rel="noreferrer">{rule.reference}</a>
          <p className="faint">법률 위반 판단이 아니라 이 기준에 비춘 위험 신호예요.</p>
        </div>
        {detail.evidenceIds?.length ? (
          <div>
            <span className="fd-basis__label">확인 번호</span>
            <span className="mono">{detail.evidenceIds.join(", ")}</span>
            {detail.ruleVersion ? <p className="faint">판정 규칙 버전 {detail.ruleVersion}</p> : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
