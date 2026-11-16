"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Mark, plainLabels } from "@/components/ui/Status";
import { EvidenceShot } from "@/components/report/EvidenceShot";
import type { ReportItem } from "@/components/report/model";
import { aiVerdictLabels, aiVerdictOrder, type AiDiagnosis, type AiItemResult, type AiVerdict } from "@/lib/aiDiagnosis";
import { formatLongDate } from "@/lib/format";
import { guide } from "@/lib/guide";
import { ruleByType, stageLabels } from "@/lib/labels";
import type { Report } from "@/lib/types";
import { usesSample } from "@/lib/api";

/** AI verdict pill. Shape + text, and a different shape from the base report's square badges. */
export function AiVerdictBadge({ verdict, large }: { verdict: AiVerdict | "INSUFFICIENT" | "FAILED"; large?: boolean }) {
  const label = verdict === "INSUFFICIENT" ? "분석 자료 부족" : verdict === "FAILED" ? "분석 실패" : aiVerdictLabels[verdict];
  return (
    <span className={`ai-verdict ai-verdict--${verdict.toLowerCase()}${large ? " ai-verdict--lg" : ""}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {verdict === "RISK" ? <path d="M6 1.2 11 10.4H1z" fill="currentColor" /> : null}
        {verdict === "PARTIAL" ? <><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6 1.4a4.6 4.6 0 0 1 0 9.2z" fill="currentColor" /></> : null}
        {verdict === "SAFE" ? <><circle cx="6" cy="6" r="5" fill="currentColor" /><path d="M3.6 6.2 5.3 7.8 8.5 4.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></> : null}
        {verdict === "INSUFFICIENT" ? <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" /> : null}
        {verdict === "FAILED" ? <><circle cx="6" cy="6" r="5" fill="currentColor" /><path d="m4.2 4.2 3.6 3.6m0-3.6L4.2 7.8" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" /></> : null}
      </svg>
      {label}
    </span>
  );
}

type Filter = "all" | AiVerdict | "INSUFFICIENT" | "FAILED";
const rank = (item: AiItemResult) => item.status === "FAILED" ? 10 : item.status === "INSUFFICIENT" ? 9 : aiVerdictOrder.indexOf(item.verdict!);

export function AiReport({ report, diagnosis, items, crumbs, reportHref, onRechoose }: {
  report: Report;
  diagnosis: AiDiagnosis;
  items: ReportItem[];
  crumbs: { label: string; href?: string }[];
  reportHref: string;
  onRechoose: () => void;
}) {
  const results = useMemo(() => [...diagnosis.items].sort((a, b) => rank(a) - rank(b)), [diagnosis.items]);
  const base = (type: AiItemResult["type"]) => items.find((item) => item.type === type)!;
  const count = (verdict: AiVerdict) => results.filter((item) => item.verdict === verdict && item.status === "ANALYZED").length;
  const insufficient = results.filter((item) => item.status === "INSUFFICIENT").length;
  const failed = results.filter((item) => item.status === "FAILED").length;
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Set<string>>(() => new Set(results.filter((item) => item.verdict === "RISK").map((item) => item.type)));
  const shown = results.filter((item) => filter === "all" || (filter === "INSUFFICIENT" || filter === "FAILED" ? item.status === filter : item.status === "ANALYZED" && item.verdict === filter));

  // Section 03: one row per check, risks first; an action already listed is not repeated.
  const priorities = useMemo(() => {
    const seen = new Set<string>();
    return results
      .filter((item) => item.status === "ANALYZED" && (item.verdict === "RISK" || item.verdict === "PARTIAL"))
      .map((item) => ({
        item,
        reason: item.recommendations[0]?.reason ?? item.conclusion,
        actions: item.recommendations.map((rec) => rec.action).filter((action) => (seen.has(action) ? false : (seen.add(action), true))),
      }))
      .filter((row) => row.actions.length);
  }, [results]);

  // What the AI saw differently from the free engine (the main reason to read this report).
  const expected: Partial<Record<ReportItem["kind"], AiVerdict>> = { risk: "RISK", review: "PARTIAL", clear: "SAFE" };
  const changed = results.filter((item) => item.status === "ANALYZED" && expected[base(item.type).kind] !== item.verdict);

  useEffect(() => {
    const type = window.location.hash.replace("#ai-item-", "");
    if (type && results.some((item) => item.type === type)) jump(type);
    // run once on arrival from a deep link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(type: string, force?: boolean) {
    const next = new Set(open);
    if (force ?? !next.has(type)) next.add(type); else next.delete(type);
    setOpen(next);
  }
  function jump(type: string) {
    setFilter("all");
    toggle(type, true);
    requestAnimationFrame(() => document.getElementById(`ai-item-${type}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="ai-report">
      <PageHead
        title="AI 정밀 점검 리포트"
        crumbs={crumbs}
        actions={<>
          <Button variant="tertiary" onClick={onRechoose}>항목 다시 골라 점검</Button>
          <ButtonLink variant="secondary" href={reportHref}>기본 점검 결과로 돌아가기</ButtonLink>
        </>}
      />

      {/* SECTION 01 */}
      <section className="ai-hero" aria-labelledby="ai-summary-title">
        <div className="ai-hero__meta">
          <span className="ai-kicker"><Icon name="spark" size={14} />AI 분석</span>
          <span>점검한 쇼핑몰 <b>{report.targetUrl}</b></span>
          <span>점검 일시 <b className="tnum">{formatLongDate(diagnosis.completedAt ?? diagnosis.createdAt)}</b></span>
          <span>AI 분석 항목 <b className="tnum">{diagnosis.requestedTypes.length}개</b></span>
        </div>
        <h2 id="ai-summary-title" className="sr-only">종합 점검 결과</h2>
        <div className="ai-tally">
          {aiVerdictOrder.map((verdict) => (
            <button
              key={verdict}
              type="button"
              className={`ai-tally__card ai-tally__card--${verdict.toLowerCase()}`}
              aria-pressed={filter === verdict}
              aria-label={`${aiVerdictLabels[verdict]} ${count(verdict)}개만 보기`}
              onClick={() => { const next = filter === verdict ? "all" : verdict; setFilter(next); if (next !== "all") document.getElementById("ai-items")?.scrollIntoView({ behavior: "smooth" }); }}
              disabled={!count(verdict)}
            >
              <AiVerdictBadge verdict={verdict} />
              <span className="ai-tally__num tnum">{count(verdict)}<small>개</small></span>
              <span className="ai-tally__hint">{{ RISK: "구체적인 위험 신호를 찾았어요", PARTIAL: "일부 개선이 필요해요", SAFE: "위험 신호가 보이지 않았어요" }[verdict]}</span>
            </button>
          ))}
        </div>
        {insufficient ? <p className="ai-hero__insufficient"><AiVerdictBadge verdict="INSUFFICIENT" /> {insufficient}개 항목은 판정하지 않았어요.</p> : null}
        {failed ? <p className="ai-hero__insufficient"><AiVerdictBadge verdict="FAILED" /> {failed}개 항목은 AI 요청에 실패했어요. 기본 점검 결과는 그대로예요.</p> : null}
        <div className="ai-diff">
          <h3>기본 점검과 다르게 본 항목 <span className="tnum">{changed.length}</span>개</h3>
          {changed.length ? (
            <ul>
              {changed.map((item) => {
                const b = base(item.type);
                return (
                  <li key={item.type}>
                    <button type="button" onClick={() => jump(item.type)}>
                      <span className="ai-diff__name"><span className="tnum faint">{b.no}</span>{guide[item.type].plain}</span>
                      <span className="ai-diff__change">
                        <span className="ai-diff__base"><Mark kind={b.kind} />{plainLabels[b.kind]}</span>
                        <Icon name="chevron" size={14} color="var(--ink-3)" />
                        <AiVerdictBadge verdict={item.verdict!} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="faint">AI 판정이 기본 점검 결과와 모두 같아요.</p>}
        </div>
        {diagnosis.summary ? (
          <div className="ai-opinion">
            <h3>AI 종합 의견</h3>
            <p>{diagnosis.summary.overview}</p>
            <div className="ai-opinion__cols">
              {diagnosis.summary.keyRisks.length ? (
                <div><span className="ai-opinion__label">주요 위험 요소</span><ul>{diagnosis.summary.keyRisks.map((text) => <li key={text}>{text}</li>)}</ul></div>
              ) : null}
              {diagnosis.summary.priorities.length ? (
                <div><span className="ai-opinion__label">먼저 고칠 것</span><ul>{diagnosis.summary.priorities.map((text) => <li key={text}>{text}</li>)}</ul></div>
              ) : null}
            </div>
          </div>
        ) : null}
        <p className="ai-disclaimer">AI가 분석한 항목에 한정된 결과예요. 쇼핑몰 전체의 법적 안전성을 보증하지 않아요.</p>
      </section>

      {/* SECTION 02 */}
      <section id="ai-items" className="ai-items" aria-labelledby="ai-items-title">
        <div className="ai-section-head">
          <h2 id="ai-items-title">항목별 AI 상세 분석</h2>
          <span className="ai-items__bulk">
            <button type="button" className="auth-link" onClick={() => setOpen(new Set(shown.map((item) => item.type)))}>모두 펼치기</button>
            <button type="button" className="auth-link" onClick={() => setOpen(new Set())}>모두 접기</button>
          </span>
        </div>
        <div className="rv-tabs ai-filter" role="toolbar" aria-label="AI 판정으로 거르기">
          {([["all", `전체 ${results.length}`], ...aiVerdictOrder.map((v) => [v, `${aiVerdictLabels[v]} ${count(v)}`]), ...(insufficient ? [["INSUFFICIENT", `분석 자료 부족 ${insufficient}`]] : []), ...(failed ? [["FAILED", `분석 실패 ${failed}`]] : [])] as [Filter, string][]).map(([key, label]) => (
            <button key={key} type="button" className="rv-tab" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
        <ul className="ai-cards">
          {shown.map((result) => (
            <AiItemCard key={result.type} result={result} base={base(result.type)} scanId={report.scanId} open={open.has(result.type)} onToggle={() => toggle(result.type)} />
          ))}
        </ul>
      </section>

      {/* SECTION 03 */}
      {priorities.length ? (
        <section className="ai-priorities" aria-labelledby="ai-priorities-title">
          <div className="ai-section-head">
            <h2 id="ai-priorities-title">우선 개선 권고사항</h2>
            <span className="faint">위험 → 부분적 안전 순서</span>
          </div>
          <ol>
            {priorities.map((row) => (
              <li key={row.item.type}>
                <span className="ai-priorities__no tnum" aria-hidden="true" />
                <div className="ai-priorities__body">
                  <div className="ai-priorities__top">
                    <b>{guide[row.item.type].plain}</b>
                    <AiVerdictBadge verdict={row.item.verdict!} />
                  </div>
                  <p>{row.reason}</p>
                  <ul className="ai-recs">{row.actions.map((action) => <li key={action}><Icon name="check" size={14} />{action}</li>)}</ul>
                  <button type="button" className="auth-link" onClick={() => jump(row.item.type)}>상세 분석 보기</button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function AiItemCard({ result, base, scanId, open, onToggle }: { result: AiItemResult; base: ReportItem; scanId: string; open: boolean; onToggle: () => void }) {
  const g = guide[result.type];
  const verdict = result.status === "FAILED" ? "FAILED" : result.status === "INSUFFICIENT" ? "INSUFFICIENT" : result.verdict!;
  const bodyId = `ai-body-${result.type}`;
  return (
    <li id={`ai-item-${result.type}`} className={`ai-card ai-card--${verdict.toLowerCase()}`}>
      <button type="button" className="ai-card__head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="ai-card__title">
          <span className="tnum faint">{base.no}</span>
          <span>
            <b>{g.plain}</b>
            <small>{ruleByType[result.type].title}</small>
          </span>
        </span>
        <AiVerdictBadge verdict={verdict} />
        <Icon name="down" size={16} className={open ? "rv-flip" : undefined} />
      </button>
      <p className="ai-card__conclusion">{result.conclusion}</p>
      {open ? (
        <div id={bodyId} className="ai-card__body">
          {result.evidence.length ? (
            <div className="ai-block">
              <h4>확인된 주요 근거</h4>
              <ul className="ai-evidence">
                {result.evidence.map((ev, index) => (
                  <li key={index}>
                    <span>{ev.text}</span>
                    {ev.stage || (ev.evidenceId && !ev.evidenceId.includes(":")) ? <span className="ai-evidence__ref">{[ev.stage ? stageLabels[ev.stage] : "", ev.evidenceId && !ev.evidenceId.includes(":") ? `확인 번호 ${ev.evidenceId}` : ""].filter(Boolean).join(" · ")}</span> : null}
                  </li>
                ))}
              </ul>
              {/* Only a real captured screen; the sample has none, and text evidence is enough on its own. */}
              {(result.screenshotStages ?? (result.screenshotStage ? [result.screenshotStage] : []))
                .filter((stage, index, all) => all.indexOf(stage) === index)
                .map((stage) => !usesSample(scanId) ? (
                  <div className="ai-shot" key={stage}><EvidenceShot scanId={scanId} stage={stage} priceLines={result.evidence.filter((ev) => ev.stage === stage).map((ev) => ev.text)} /></div>
                ) : null)}
            </div>
          ) : null}
          <div className="ai-block">
            <h4>{result.status !== "ANALYZED" ? "분석하지 못한 이유" : "AI 판단 이유"}</h4>
            <p>{result.reasoning}</p>
          </div>
          {result.recommendations.length ? (
            <div className="ai-block">
              <h4>개선 권고사항</h4>
              <ul className="ai-recs">{result.recommendations.map((rec) => <li key={rec.action}><Icon name="check" size={14} />{rec.action}</li>)}</ul>
            </div>
          ) : null}
          <div className="ai-compare" aria-label="기본 점검과 AI 결과 비교">
            <div>
              <span className="ai-compare__label">기본 점검</span>
              <span className="ai-compare__value"><Mark kind={base.kind} />{plainLabels[base.kind]}</span>
            </div>
            <Icon name="chevron" size={16} color="var(--ink-3)" />
            <div>
              <span className="ai-compare__label">AI 판정</span>
              <AiVerdictBadge verdict={verdict} />
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
