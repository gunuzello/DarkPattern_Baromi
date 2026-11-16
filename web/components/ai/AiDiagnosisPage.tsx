"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Mark, plainLabels } from "@/components/ui/Status";
import { reportItems, type ReportItem } from "@/components/report/model";
import { api, ApiError, errorMessage, isDemo, usesSample } from "@/lib/api";
import { aiDiagnosis, aiDiagnosisMode, type AiDiagnosis } from "@/lib/aiDiagnosis";
import { hostOf } from "@/lib/format";
import { useBackToLogin } from "@/lib/session";
import type { FindingType, Report } from "@/lib/types";
import { AiReport } from "./AiReport";

/**
 * AI 정밀 진단 (spec: AI 꼼꼼 점검 항목 선택 → 진행 → 리포트). Lives at /report/[id]/ai so the
 * base report stays untouched and one link always shows the current AI state.
 */
export function AiDiagnosisPage({ id }: { id: string }) {
  const backToLogin = useBackToLogin();
  const [report, setReport] = useState<Report>();
  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>();
  const [error, setError] = useState("");
  const [choosing, setChoosing] = useState(false);
  const mode = aiDiagnosisMode(id);
  const reportHref = `/report/${encodeURIComponent(id)}`;

  const load = useCallback(async () => {
    try {
      const [nextReport, nextDiagnosis] = await Promise.all([api.getReport(id), aiDiagnosis.get(id)]);
      setReport(nextReport);
      setDiagnosis(nextDiagnosis);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) { backToLogin(); return; }
      setError(errorMessage(cause, "AI 정밀 진단 정보를 불러오지 못했어요."));
    }
  }, [id, backToLogin]);

  useEffect(() => { void load(); }, [load]);

  // Keep checking while queued or running; the base report stays usable meanwhile.
  useEffect(() => {
    if (diagnosis?.status !== "QUEUED" && diagnosis?.status !== "RUNNING") return;
    const timer = window.setTimeout(async () => {
      try { setDiagnosis(await aiDiagnosis.get(id)); } catch { /* next tick retries */ }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [diagnosis, id]);

  if (mode === "legacy") {
    return (
      <Alert kind="brand" title="AI 정밀 진단은 곧 열려요" actions={<ButtonLink variant="secondary" size="sm" href={reportHref}>점검 결과로 돌아가기</ButtonLink>}>
        지금은 점검 결과의 ‘확인해 보세요’ 항목을 AI가 함께 보는 AI 꼼꼼 점검을 이용할 수 있어요.
      </Alert>
    );
  }
  if (!report || diagnosis === undefined) {
    return error
      ? <Alert kind="error" title={error} actions={<ButtonLink variant="secondary" size="sm" href={reportHref}>점검 결과로 돌아가기</ButtonLink>} />
      : <p role="status" className="muted">AI 정밀 진단 정보를 불러오고 있어요.</p>;
  }

  const items = reportItems(report);
  const crumbs = [
    ...(usesSample(id) && !isDemo ? [{ label: "예시 점검 결과", href: reportHref }] : [{ label: "내 쇼핑몰", href: "/shops" }, { label: hostOf(report.targetUrl), href: reportHref }]),
    { label: "AI 정밀 진단" },
  ];

  if (!diagnosis || choosing) {
    return (
      <>
        <PageHead title="AI 꼼꼼 점검 받기" crumbs={crumbs} actions={<ButtonLink variant="secondary" href={reportHref}>점검 결과로 돌아가기</ButtonLink>} />
        <AiSelect
          items={items}
          eligible={report.aiEligible}
          previous={diagnosis?.requestedTypes}
          onCancel={diagnosis ? () => setChoosing(false) : undefined}
          onRequested={(next) => { setDiagnosis(next); setChoosing(false); }}
          scanId={id}
        />
      </>
    );
  }

  if (diagnosis.status === "QUEUED" || diagnosis.status === "RUNNING" || diagnosis.status === "FAILED") {
    return (
      <>
        <PageHead title="AI 정밀 진단" crumbs={crumbs} actions={<ButtonLink variant="secondary" href={reportHref}>점검 결과로 돌아가기</ButtonLink>} />
        <AiProgress diagnosis={diagnosis} items={items} onRetry={() => setChoosing(true)} reportHref={reportHref} />
      </>
    );
  }

  return <AiReport report={report} diagnosis={diagnosis} items={items} crumbs={crumbs} reportHref={reportHref} onRechoose={() => setChoosing(true)} />;
}

/** Spec §2: pick any of the 16 checks, whatever the base result was. */
function AiSelect({ items, eligible, previous, onCancel, onRequested, scanId }: {
  items: ReportItem[];
  eligible: boolean;
  previous?: FindingType[];
  onCancel?: () => void;
  onRequested: (diagnosis: AiDiagnosis) => void;
  scanId: string;
}) {
  // Start from the last request, or from what the base engine left for a closer look.
  const initial = useMemo(() => new Set<FindingType>(previous ?? items.filter((item) => item.kind === "review" || item.kind === "risk").map((item) => item.type)), [previous, items]);
  const [picked, setPicked] = useState<Set<FindingType>>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const backToLogin = useBackToLogin();
  const weak = items.filter((item) => picked.has(item.type) && item.kind === "none").length;

  function toggle(type: FindingType) {
    const next = new Set(picked);
    if (next.has(type)) next.delete(type); else next.add(type);
    setPicked(next);
  }

  async function submit() {
    setPending(true);
    setError("");
    try {
      onRequested(await aiDiagnosis.request(scanId, items.filter((item) => picked.has(item.type)).map((item) => item.type)));
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) { backToLogin(); return; }
      setError(errorMessage(cause, "AI 정밀 진단을 요청하지 못했어요."));
      setPending(false);
    }
  }

  return (
    <div className="ai-select">
      <section className="ai-select__intro">
        <span className="ai-kicker"><Icon name="eye" size={14} />AI 정밀 진단</span>
        <h2>AI로 더 자세히 볼 항목을 골라 주세요</h2>
        <p>기본 점검 결과와 관계없이 16가지 중 어떤 항목이든 고를 수 있어요. 기본 점검 결과는 그대로 두고, AI 결과는 따로 리포트로 보여드려요.</p>
      </section>

      <div className="ai-select__list">
        <div className="ai-select__bar">
          <span className="tnum"><b>{picked.size}</b>개 선택 / 16개</span>
          <span className="ai-select__bulk">
            <button type="button" className="auth-link" onClick={() => setPicked(new Set(items.map((item) => item.type)))} disabled={picked.size === items.length}>전체 선택</button>
            <button type="button" className="auth-link" onClick={() => setPicked(new Set())} disabled={!picked.size}>전체 해제</button>
          </span>
        </div>
        <ul>
          {items.map((item) => (
            <li key={item.type}>
              <label className={picked.has(item.type) ? "ai-pick is-on" : "ai-pick"}>
                <input type="checkbox" checked={picked.has(item.type)} onChange={() => toggle(item.type)} />
                <span className="ai-pick__no tnum">{item.no}</span>
                <span className="ai-pick__text">
                  <b>{item.plain}</b>
                  {item.kind === "none" ? <span className="ai-pick__warn">자료가 부족해 분석이 제한될 수 있어요</span> : <span>{item.summary}</span>}
                </span>
                <span className="ai-pick__base" title="기본 점검 결과"><Mark kind={item.kind} />{plainLabels[item.kind]}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="ai-select__foot">
        <div className="ai-select__note">
          {weak ? <p><Icon name="info" size={14} />‘점검 못 했어요’ 항목 {weak}개는 근거가 부족하면 ‘분석 자료 부족’으로 표시될 수 있어요.</p> : null}
          <p className="faint">AI에게는 점검 항목, 수집한 문구·가격·선택 상태, 확인 화면, 확인 번호만 보내요. 개인정보와 로그인 정보는 보내지 않아요. 요금은 <Link href="/#pricing">요금 안내</Link>에서 볼 수 있어요.</p>
        </div>
        {error ? <Alert kind="error" title={error} /> : null}
        {!eligible ? <Alert kind="brand" title="AI 정밀 진단은 유료 기능이에요">이 쇼핑몰은 아직 유료로 이용할 수 없어요. 기본 점검 결과는 계속 볼 수 있어요.</Alert> : null}
        <div className="ai-select__actions">
          {onCancel ? <Button variant="secondary" onClick={onCancel}>이전 리포트로</Button> : null}
          <Button variant="brand" size="lg" disabled={!picked.size || !eligible} loading={pending} loadingText="요청 중" onClick={submit}>
            선택한 {picked.size}개 항목 AI 정밀 진단하기
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Spec §4: 대기 중 / 분석 중 / 실패. */
function AiProgress({ diagnosis, items, onRetry, reportHref }: { diagnosis: AiDiagnosis; items: ReportItem[]; onRetry: () => void; reportHref: string }) {
  const total = diagnosis.requestedTypes.length;
  const done = diagnosis.doneCount ?? 0;
  const picked = items.filter((item) => diagnosis.requestedTypes.includes(item.type));
  if (diagnosis.status === "FAILED") {
    return (
      <Alert kind="error" title="AI 정밀 진단에 실패했어요" actions={<><Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>다시 요청</Button><ButtonLink variant="tertiary" size="sm" href={reportHref}>점검 결과로 돌아가기</ButtonLink></>}>
        {diagnosis.error ?? "분석 결과가 돌아오지 않았어요."} 기본 점검 결과와 확인 화면은 그대로예요.
      </Alert>
    );
  }
  const queued = diagnosis.status === "QUEUED";
  return (
    <section className="ai-progress" role="status" aria-live="polite">
      <div className="ai-progress__head">
        <span className="ai-kicker"><Icon name="eye" size={14} />AI 정밀 진단</span>
        <h2>{queued ? "AI 분석을 기다리고 있어요" : `AI가 ${total}개 항목을 분석하고 있어요`}</h2>
        <p>보통 몇 분 걸려요. 이 화면을 닫아도 계속 진행되고, 기본 점검 결과는 지금도 볼 수 있어요.</p>
      </div>
      <div className="ai-progress__meter">
        <span className="tnum">{queued ? "대기 중" : `${done} / ${total}`}</span>
        <div className="progress" role="progressbar" aria-label="AI 분석 진행" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
          <span style={{ width: `${queued ? 4 : Math.max(4, (done / total) * 100)}%` }} />
        </div>
      </div>
      <ol className="ai-progress__list">
        {picked.map((item, index) => {
          const state = queued ? "wait" : index < done ? "done" : index === done ? "run" : "wait";
          return (
            <li key={item.type} className={`is-${state}`}>
              <Mark kind={state === "done" ? "done" : state === "run" ? "run" : "wait"} />
              <span>{item.plain}</span>
              <span className="faint">{state === "done" ? "분석 완료" : state === "run" ? "분석 중" : "대기"}</span>
            </li>
          );
        })}
      </ol>
      <ButtonLink variant="secondary" href={reportHref}>기본 점검 결과 보기</ButtonLink>
    </section>
  );
}
