"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { ScanStatusBadge } from "@/components/ui/Status";
import { Tracker, type TrackerState } from "@/components/ui/Tracker";
import { api, errorMessage, ApiError } from "@/lib/api";
import { readFlag, useBackToRegistration } from "@/lib/session";
import { rules, scanDurationHint, scanStatusLabels, stageLabels, surfaceLabels } from "@/lib/labels";
import { formatDuration, pathLabel, viewportLabel } from "@/lib/format";
import { phaseFor, phaseStatusLabels, phaseTone, surfacePhase } from "@/lib/phases";
import { stages, surfaceKinds, type PhaseStatus, type ScanState } from "@/lib/types";
import { PhaseBadge } from "@/components/report/ReportSections";

const titles: Record<ScanState["status"], string> = {
  QUEUED: "진단 순서를 기다리고 있어요",
  RUNNING: "구매 흐름을 진단하고 있어요",
  COMPLETED: "진단이 끝났어요",
  PARTIAL: "일부 범위만 진단했어요",
  FAILED: "진단을 마치지 못했어요",
  CANCELLED: "진단을 중단했어요",
};

const trackerState: Record<PhaseStatus, TrackerState> = {
  PENDING: "pending", RUNNING: "active", COVERED: "done", DISCOVERED: "unchecked",
  NOT_FOUND: "stop", BLOCKED: "stop", FAILED: "stop", SKIPPED: "skip",
};

export function ScanProgress({ id }: { id: string }) {
  const router = useRouter();
  const [scan, setScan] = useState<ScanState>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);
  const keepButton = useRef<HTMLButtonElement>(null);
  const backToRegistration = useBackToRegistration();
  const [deduplicated, setDeduplicated] = useState(false);
  useEffect(() => setDeduplicated(readFlag("dedup")), []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    let consecutiveFailures = 0;
    async function refresh() {
      try {
        const next = await api.getScan(id);
        if (!alive) return;
        consecutiveFailures = 0;
        setScan(next);
        setError("");
        if (next.status === "QUEUED" || next.status === "RUNNING") timer = setTimeout(refresh, 1500);
      } catch (cause) {
        if (!alive) return;
        if (cause instanceof ApiError && cause.sessionLost) { backToRegistration(); return; }
        consecutiveFailures++;
        const message = errorMessage(cause, "진단 상태를 불러오지 못했어요.");
        setError(consecutiveFailures >= 5
          ? `${message} 상태 확인을 잠시 멈췄어요. 진단은 서버에서 계속 진행 중일 수 있습니다.`
          : message);
        if (consecutiveFailures < 5) timer = setTimeout(refresh, 3000);
      }
    }
    setError("");
    void refresh();
    return () => { alive = false; clearTimeout(timer); };
  }, [id, pollAttempt, backToRegistration]);

  useEffect(() => { if (confirm) keepButton.current?.focus(); }, [confirm]);

  async function cancel() {
    setConfirm(false);
    setPending(true);
    try {
      const result = await api.cancelScan(id);
      // Waiting scans stop at once; running ones finish their current step first.
      setScan((current) => current ? (result.status === "CANCELLED"
        ? { ...current, status: "CANCELLED", cancelRequested: false }
        : { ...current, cancelRequested: true }) : current);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToRegistration();
      else setError(errorMessage(cause, "중단 요청을 보내지 못했어요."));
    } finally {
      setPending(false);
    }
  }

  async function retry() {
    if (!scan) return;
    setPending(true);
    try {
      const next = await api.createScan({ shopId: scan.shopId, baselineScanId: undefined, profile: scan.executionMode === "DYNAMIC" ? "DYNAMIC" : "CONTEST", viewport: scan.viewport, purchasePath: scan.purchasePath });
      router.push(`/scan/${encodeURIComponent(next.scanId)}${next.deduplicated ? "?dedup=1" : ""}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToRegistration();
      else setError(errorMessage(cause, "재진단을 시작하지 못했어요."));
      setPending(false);
    }
  }

  if (!scan) {
    return error
      ? <Alert kind="error" title={error} actions={<Button variant="secondary" size="sm" icon="refresh" onClick={() => setPollAttempt((attempt) => attempt + 1)}>상태 다시 확인</Button>} />
      : <p role="status" className="muted">진단 상태를 확인하고 있어요.</p>;
  }

  const active = scan.status === "QUEUED" || scan.status === "RUNNING";
  // A failed run can still have a useful report with collected evidence,
  // phase failures, and all 16 rule-level NOT_TESTED reasons. Respect the
  // server's report availability instead of hiding that recovery path.
  const reportReady = scan.status === "COMPLETED" || scan.status === "PARTIAL" || (scan.status === "FAILED" && scan.hasReport === true);
  const staticMode = scan.executionMode !== "DYNAMIC";
  const stopping = scan.cancelRequested && active;

  // Spec §4: read each phase from phaseResults; never infer one phase from another.
  const steps: { name: string; state: TrackerState; note?: string }[] = stages.map((stage) => {
    const phase = phaseFor(scan, stage);
    const time = phase.durationMs != null ? `, ${formatDuration(phase.durationMs)}` : "";
    return { name: stageLabels[stage], state: trackerState[phase.status], note: phaseStatusLabels[phase.status] + time };
  });
  const crawl = phaseFor(scan, "site-crawl");
  const crawlReported = Boolean(scan.phaseResults?.["site-crawl"]?.status);
  const crawlLabel = crawlReported ? phaseStatusLabels[crawl.status] : active ? "대기" : "기록 없음";
  const crawlTone = crawlReported ? phaseTone[crawl.status] : active ? "wait" : "skip";
  const running = [
    ...stages.filter((stage) => phaseFor(scan, stage).status === "RUNNING").map((stage) => stageLabels[stage]),
    ...surfaceKinds.filter((kind) => phaseFor(scan, surfacePhase(kind)).status === "RUNNING").map((kind) => surfaceLabels[kind]),
    ...(!staticMode && crawl.status === "RUNNING" ? ["쇼핑몰 전체 화면"] : []),
  ];
  const nowText = running.length
    ? `지금 확인 중: ${running.join(", ")}`
    : !scan.phaseResults && scan.currentStage ? `지금 확인 중: ${stageLabels[scan.currentStage]}` : scan.status === "QUEUED" ? "작업기가 진단을 시작하기를 기다리고 있어요" : "다음 단계를 준비하고 있어요";

  return (
    <>
      <PageHead
        title={stopping ? "중단 요청을 처리하고 있어요" : titles[scan.status]}
        crumbs={[{ label: "내 쇼핑몰", href: "/shops" }, { label: "진단 이력", href: `/shop/${encodeURIComponent(scan.shopId)}` }, { label: `${viewportLabel(scan.viewport)}, ${pathLabel(scan.purchasePath)}` }]}
        meta={<><ScanStatusBadge status={scan.status} label={stopping ? "중단 요청 처리 중" : undefined} /><span>{staticMode ? "공개 화면 진단" : "전체 구매 흐름 진단"}</span></>}
        actions={<>
          {active ? <Button variant="secondary" onClick={() => setConfirm(true)} disabled={pending || scan.cancelRequested}>진단 중단</Button> : null}
          {!active && !reportReady ? <Button variant="secondary" icon="refresh" onClick={retry} loading={pending} loadingText="요청 중">같은 조건으로 재진단</Button> : null}
          {reportReady && !scan.summary ? <ButtonLink href={`/report/${encodeURIComponent(id)}`}>진단 결과 보기</ButtonLink> : null}
        </>}
      />

      {error ? <Alert kind="error" title={error} actions={<Button variant="secondary" size="sm" icon="refresh" onClick={() => setPollAttempt((attempt) => attempt + 1)}>상태 다시 확인</Button>} /> : null}
      {deduplicated && active ? <Alert kind="brand" title="같은 조건의 진단이 이미 진행 중이에요">새로 시작하지 않고 진행 중인 진단을 보여드려요.</Alert> : null}

      {reportReady && scan.summary ? (
        <section aria-label="진단 결과 요약" className="panel rise" style={{ padding: "24px 32px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>진단 결과가 준비됐어요</span>
            <span className="muted" style={{ fontSize: 14 }}>{scan.summary.notTested ? `미검사 ${scan.summary.notTested}개 항목은 보고서에 이유와 함께 남겼어요.` : "선택한 범위를 모두 검사했어요."}</span>
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            <Stat label="위험 신호" value={scan.summary.suspected} kind="risk" />
            <Stat label="검토 필요" value={scan.summary.reviewNeeded} kind="review" />
            {scan.summary.notObserved != null ? <Stat label="안전" value={scan.summary.notObserved} kind="clear" /> : null}
            <Stat label="미검사" value={scan.summary.notTested} kind="none" />
          </div>
          <ButtonLink href={`/report/${encodeURIComponent(id)}`} size="lg">진단 결과 보기</ButtonLink>
        </section>
      ) : null}
      {scan.status === "CANCELLED" ? <Alert title="진단을 중단했어요" actions={<Button variant="secondary" size="sm" onClick={retry}>같은 조건으로 재진단</Button>}>기록을 마친 단계만 남기고 나머지는 미검사로 표시했어요.</Alert> : null}
      {scan.status === "FAILED" ? <Alert kind="error" title="진단을 마치지 못했어요" actions={scan.hasReport ? <ButtonLink variant="secondary" size="sm" href={`/report/${encodeURIComponent(id)}`}>원인과 미검사 범위 보기</ButtonLink> : undefined}>{scan.hasReport ? "결제와 주문 확정은 시도하지 않았어요. 수집된 증거와 미검사 사유를 보고서에 남겼어요." : "증거를 저장하지 못해 보고서를 만들지 못했어요. 진단 이력에서 원인을 확인한 뒤 다시 시도해 주세요."}</Alert> : null}

      <section aria-label="진행률" className="panel" style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span className="tnum" style={{ fontSize: 48, lineHeight: 1, letterSpacing: "-0.03em", fontWeight: 800 }}>{scan.progress}%</span>
            <span className="muted" style={{ fontSize: 15, fontWeight: 600 }}>{stopping ? "중단 요청 처리 중" : scanStatusLabels[scan.status]}</span>
          </div>
          <span className="faint" style={{ fontSize: 14 }}>{active ? scanDurationHint : scan.durationMs != null ? `소요 시간 ${formatDuration(scan.durationMs)}` : ""}</span>
        </div>
        <div className="progress" role="progressbar" aria-label="진단 진행률" aria-valuenow={scan.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${scan.progress}%` }} /></div>
        <Tracker steps={steps} />
        {!staticMode ? (
          <div className="phase-row" aria-label="쇼핑몰 전체 화면 크롤링 상태">
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>쇼핑몰 전체 화면 탐색</span>
              {crawl.reason ? <span className="faint" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{crawl.reason}</span> : null}
            </span>
            {crawl.durationMs != null ? <span className="tnum faint" style={{ fontSize: 12 }}>{formatDuration(crawl.durationMs)}</span> : null}
            <PhaseBadge tone={crawlTone} label={crawlLabel} />
          </div>
        ) : null}
        <div aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 16, borderTop: "1px solid var(--line)", fontSize: 15 }}>
          {active ? <span className="pulse" style={{ width: 8, height: 8, borderRadius: 999, background: "var(--brand)", flex: "none" }} /> : null}
          <span>{active ? nowText : "진행이 끝났어요"}</span>
          {active ? <span className="faint" style={{ marginLeft: "auto", fontSize: 13 }}>결제·주문 확정·외부 사이트 이동은 실행하지 않아요</span> : null}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 }}>
        <section aria-labelledby="surface-head" className="panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 id="surface-head" className="t-panel">별도 탐색 영역</h2>
            <span className="faint" style={{ fontSize: 13 }}>{surfaceKinds.length}개 영역</span>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>구매 단계 밖의 화면도 읽기 전용으로 찾아요. 폼 제출, 결제, 해지는 실행하지 않아요.</p>
          <ul className="dot-list">
            {surfaceKinds.map((kind) => {
              const phase = phaseFor(scan, surfacePhase(kind));
              return (
                <li key={kind} className="phase-row">
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{surfaceLabels[kind]}</span>
                    {phase.reason ? <span className="faint" style={{ fontSize: 12 }}>{phase.reason}</span> : null}
                  </span>
                  {phase.durationMs != null ? <span className="tnum faint" style={{ fontSize: 12 }}>{formatDuration(phase.durationMs)}</span> : null}
                  <PhaseBadge tone={phaseTone[phase.status]} label={phaseStatusLabels[phase.status]} />
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-labelledby="rules-head" className="panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 id="rules-head" className="t-panel">점검 항목</h2>
            <span className="faint" style={{ fontSize: 13 }}>{rules.length}가지</span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {rules.map((rule) => <li key={rule.type} style={{ height: 28, padding: "0 10px", display: "inline-flex", alignItems: "center", borderRadius: 6, background: "var(--surface-sub)", fontSize: 13, fontWeight: 500 }}>{rule.name}</li>)}
          </ul>
          {scan.summary && active ? (
            <div style={{ display: "flex", gap: 24, paddingTop: 12, borderTop: "1px solid var(--surface-sub)" }}>
              <Stat label="위험 신호 후보" value={scan.summary.suspected} kind="risk" />
              <Stat label="검토 필요 후보" value={scan.summary.reviewNeeded} kind="review" />
            </div>
          ) : null}
        </section>
      </div>

      {confirm ? (
        <div className="dialog-backdrop" onKeyDown={(event) => { if (event.key === "Escape") setConfirm(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="dialog">
            <h2 id="cancel-title" style={{ fontSize: 18, fontWeight: 700 }}>진단을 중단할까요?</h2>
            <p className="muted" style={{ fontSize: 14 }}>지금까지 기록한 단계는 남기고, 나머지는 미검사로 표시해요. 중단한 진단은 이어서 진행할 수 없어요.</p>
            <div className="dialog__actions">
              <Button variant="secondary" ref={keepButton} onClick={() => setConfirm(false)}>계속 진단하기</Button>
              <Button variant="danger" onClick={cancel}>진단 중단</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
