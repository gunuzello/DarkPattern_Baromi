"use client";

import { useEffect, useState } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Status";
import { api, ApiError, errorMessage } from "@/lib/api";
import { ruleByType, stageLabels } from "@/lib/labels";
import type { FindingDetail } from "@/lib/types";
import { EvidenceShot } from "./EvidenceShot";

export function FindingDetailView({ scanId, findingId }: { scanId: string; findingId: string }) {
  const [detail, setDetail] = useState<FindingDetail>();
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api.getFinding(findingId, scanId)
      .then((result) => { if (alive) setDetail(result); })
      .catch((cause) => { if (alive) setError(cause instanceof ApiError && cause.status === 404 ? "이 발견 항목을 찾지 못했어요. 세션이 끝났다면 새 진단에서 다시 시작해 주세요." : errorMessage(cause, "발견 항목을 불러오지 못했어요.")); });
    return () => { alive = false; };
  }, [findingId, scanId]);

  const back = `/report/${encodeURIComponent(scanId)}`;
  if (!detail) return error ? <Alert kind="error" title={error} actions={<><ButtonLink variant="secondary" size="sm" href={back}>보고서로 돌아가기</ButtonLink><ButtonLink variant="tertiary" size="sm" href="/scan/new">새 진단</ButtonLink></>} /> : <p role="status" className="muted">증거를 불러오고 있어요.</p>;

  const rule = ruleByType[detail.type];
  const isReview = detail.status === "REVIEW_NEEDED";
  return (
    <>
      <PageHead
        title={rule.title}
        crumbs={[{ label: "진단 보고서", href: back }, { label: "발견 항목" }]}
        actions={<ButtonLink variant="secondary" href={back}>보고서로 돌아가기</ButtonLink>}
      />

      <section className="panel panel--feature" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Badge kind={isReview ? "review" : "risk"} large>{isReview ? "검토 필요" : "위험 신호"}</Badge>
          <span className="faint" style={{ fontSize: 13 }}>{isReview ? "맥락을 추가로 확인해야 해요" : "바로미의 판정 기준에 해당하는 신호예요"}</span>
        </div>
        <p style={{ fontSize: 17, lineHeight: 1.65, maxWidth: "40em" }}>{detail.reason}</p>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, paddingTop: 16, borderTop: "1px solid var(--line)", fontSize: 14 }}>
          <div><dt className="t-caption">점검 항목</dt><dd style={{ margin: 0, fontWeight: 600 }}>{rule.name}</dd></div>
          <div><dt className="t-caption">단계</dt><dd style={{ margin: 0, fontWeight: 600 }}>{stageLabels[detail.stage]}</dd></div>
          {detail.ruleVersion ? <div><dt className="t-caption">규칙 버전</dt><dd className="mono" style={{ margin: 0, fontWeight: 600 }}>{detail.ruleVersion}</dd></div> : null}
          {detail.evidenceIds?.length ? <div><dt className="t-caption">근거 ID</dt><dd className="mono" style={{ margin: 0, fontWeight: 600 }}>{detail.evidenceIds.join(", ")}</dd></div> : null}
        </dl>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <section className="quiet" style={{ padding: "24px 28px", background: "var(--surface-sub)", borderRadius: 12, gap: 8 }}>
          <h2 className="t-panel">개선 방법</h2>
          <p style={{ fontSize: 17, lineHeight: 1.6, fontWeight: 600 }}>{rule.recommendation}</p>
        </section>
        <section className="panel panel--feature" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="t-panel">판단 기준</h2>
          <a href={rule.source} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: 600 }}>{rule.reference}</a>
          <p className="faint" style={{ fontSize: 13 }}>법률 위반 판단이 아니라 이 기준에 비춘 위험 신호예요.</p>
        </section>
      </div>

      <section aria-labelledby="evidence-head" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 id="evidence-head" className="t-title" style={{ fontSize: 20 }}>화면 증거</h2>
        <div className="panel panel--feature" style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {detail.evidence.map((snapshot) => (
            <figure key={snapshot.stage} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              <figcaption style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{stageLabels[snapshot.stage]}</span>
                {snapshot.stage === detail.stage ? <Badge kind="risk">이 단계에서 관찰</Badge> : null}
              </figcaption>
              <EvidenceShot
                scanId={detail.scanId}
                stage={snapshot.stage}
                area={snapshot.screenshotArea}
                element={snapshot.stage === detail.stage ? detail.elementBounds : undefined}
              />
              <ul className="tnum" style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2, fontSize: 13, color: "var(--ink-2)" }}>
                {snapshot.priceLines.map((line, index) => <li key={index}>{line}</li>)}
              </ul>
              <span className="mono faint" style={{ fontSize: 13, overflowWrap: "anywhere" }}>{snapshot.url}</span>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
