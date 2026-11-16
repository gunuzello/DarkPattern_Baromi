"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Mark, plainLabels, type ResultKind } from "@/components/ui/Status";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage, isDemo, usesSample } from "@/lib/api";
import { sampleEvidenceLines } from "@/lib/demo";
import { useBackToLogin } from "@/lib/session";
import { blockerText, collectionFailureLabels, ruleByType, stageLabels } from "@/lib/labels";
import { formatDuration, hostOf, pathLabel, viewportLabel } from "@/lib/format";
import type { Finding, Report } from "@/lib/types";
import { AiRequestDialog, AiStatusBanner } from "./AiReview";
import { aiTargets, reportItems, type ReportItem } from "./model";
import { CoverageTable, FlowTrack, LedgerTable } from "./ReportSections";
import { kindOrder, ResultRing } from "./ResultRing";
import { TypeDetail } from "./TypeDetail";
import { TypeList, type ListFilter } from "./TypeList";
import { guide } from "@/lib/guide";
import { useRescan } from "@/components/scan/useRescan";

const scanStateLabel: Record<Report["scanStatus"], string> = {
  QUEUED: "점검 대기", RUNNING: "점검 중", COMPLETED: "점검 완료", PARTIAL: "일부만 점검", FAILED: "점검 실패", CANCELLED: "점검 중단",
};

/**
 * Report (wireframe "쉬운 말 버전" R-01 to R-07, M-01 to M-03) on the Ledger design system.
 * PC: summary + action column, then the 16-check list with the detail panel beside it.
 * Narrow screens: list, then the detail as its own view with back and previous/next.
 */
export function ScanReport({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");
  const [downloadPending, setDownloadPending] = useState(false);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [clearOpen, setClearOpen] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<"list" | "detail">("list");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const backToLogin = useBackToLogin();
  const rescanner = useRescan(setError);
  const pending = rescanner.pending;

  const load = useCallback(async () => {
    try {
      const next = await api.getReport(id);
      setReport(next);
      return next;
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost && !usesSample(id)) { backToLogin(); return undefined; }
      setError(errorMessage(cause, "점검 결과를 불러오지 못했어요."));
      return undefined;
    }
  }, [id, backToLogin]);

  useEffect(() => { void load(); }, [load]);

  // R-07: check every few seconds only while the AI follow-up runs; a reload resumes from the server state.
  useEffect(() => {
    if (report?.aiReview?.status !== "QUEUED" && report?.aiReview?.status !== "RUNNING") return;
    const timer = setTimeout(() => { void load(); }, 2000);
    return () => clearTimeout(timer);
  }, [report, load]);

  const sample = usesSample(id);
  const publicSample = sample && !isDemo;

  function saveFile(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `baromi-${id}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.show("점검 결과 파일을 내려받았어요");
  }

  async function download() {
    if (!report) return;
    if (sample) { saveFile(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })); return; }
    setDownloadPending(true);
    try {
      saveFile(await api.downloadReport(id));
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) { backToLogin(); return; }
      setError(errorMessage(cause, "점검 결과를 내려받지 못했어요."));
    } finally {
      setDownloadPending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.show("결과 링크를 복사했어요");
    } catch {
      toast.show("링크를 복사하지 못했어요");
    }
  }

  function rescan() {
    if (!report) return;
    if (publicSample) { router.push("/scan/new"); return; }
    void rescanner.start({ shopId: report.shopId, baselineScanId: id, executionMode: report.executionMode, viewport: report.viewport, purchasePath: report.purchasePath });
  }

  async function requestAi() {
    setAiPending(true);
    setAiError("");
    try {
      await api.requestAiReview(id);
      setAiOpen(false);
      toast.show("AI 꼼꼼 점검을 요청했어요");
      void load();
    } catch (cause) {
      setAiError(cause instanceof ApiError ? cause.message : "AI 꼼꼼 점검을 요청하지 못했어요.");
    } finally {
      setAiPending(false);
    }
  }

  const items = report ? reportItems(report) : [];
  const firstItem = kindOrder.map((kind) => items.find((item) => item.kind === kind)).find(Boolean);
  const current = items.find((item) => item.type === selected) ?? firstItem;

  /** Items reachable with previous/next: the current filter, in list order. */
  const navOrder = kindOrder.flatMap((kind) => items.filter((item) => item.kind === kind && (filter === "all" || filter === kind)));
  const navIndex = current ? navOrder.findIndex((item) => item.type === current.type) : -1;

  /** One column (phone, narrow window): list and detail take turns instead of sitting side by side. */
  const narrow = () => listRef.current?.offsetParent === null || detailRef.current?.offsetParent === null;

  function select(item: ReportItem) {
    const oneColumn = narrow();
    setSelected(item.type);
    if (item.kind === "clear") setClearOpen(true);
    setView("detail");
    requestAnimationFrame(() => {
      detailRef.current?.querySelector(".rv-detail-scroll")?.scrollTo({ top: 0 });
      if (oneColumn) detailRef.current?.scrollIntoView({ block: "start" });
    });
  }

  function backToList() {
    setView("list");
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-type="${current?.type}"]`)?.scrollIntoView({ block: "center" });
    });
  }

  function chooseFilter(next: ListFilter) {
    setFilter(next);
    if (next === "clear") setClearOpen(true);
  }

  function showCount(kind: ResultKind) {
    chooseFilter(kind);
    setView("list");
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  if (!report) return error ? <Alert kind="error" title={error} actions={<><ButtonLink variant="secondary" size="sm" href="/shops">내 쇼핑몰</ButtonLink><ButtonLink variant="tertiary" size="sm" href="/scan/new">새 점검</ButtonLink></>} /> : <p role="status" className="muted">점검 결과를 불러오고 있어요.</p>;

  const count = (kind: ResultKind) => items.filter((item) => item.kind === kind).length;
  const targets = aiTargets(items);
  const review = report.aiReview;
  const aiBusy = review?.status === "QUEUED" || review?.status === "RUNNING";
  const canRequestAi = targets.length > 0 && !review;
  const staticMode = report.executionMode !== "DYNAMIC";
  const failed = report.scanStatus === "FAILED" || report.scanStatus === "CANCELLED";
  const headline = failed
    ? "점검을 끝까지 마치지 못했어요"
    : count("risk") + count("review") === 0
      ? `16가지 중 고쳐야 할 곳이나 확인할 곳이 보이지 않았어요`
      : `16가지 중 ${[count("risk") ? `고쳐야 할 곳 ${count("risk")}곳` : "", count("review") ? `확인할 곳 ${count("review")}곳` : ""].filter(Boolean).join(", ")}이 있어요`;
  const linesFor = (finding: Finding) => (sample ? sampleEvidenceLines[finding.id] : undefined)
    ?? report.priceLedger?.stages.find((stage) => stage.stage === finding.stage)?.displayedLines;

  return (
    <div className="rv">
      <div className="rv-topbar">
        <nav aria-label="경로" className="crumbs">
          {publicSample ? (
            <><Link href="/">바로미</Link><Icon name="chevron" size={12} color="#a0a4ab" /><span>예시 점검 결과</span></>
          ) : (
            <>
              <Link href="/shops">내 쇼핑몰</Link><Icon name="chevron" size={12} color="#a0a4ab" />
              <Link href={`/shop/${encodeURIComponent(report.shopId)}`}>점검 기록</Link><Icon name="chevron" size={12} color="#a0a4ab" />
              <span>{hostOf(report.targetUrl)}</span>
            </>
          )}
        </nav>
        <div className="rv-topbar__actions">
          <Button variant="tertiary" size="sm" onClick={copyLink}>링크 복사</Button>
          <Button variant="secondary" icon="download" loading={downloadPending} loadingText="준비 중" onClick={download}>점검 결과 다운로드</Button>
        </div>
      </div>

      {error ? <Alert kind="error" title={error} /> : null}

      {review ? (
        <AiStatusBanner
          review={review}
          targets={targets}
          eligible={report.aiEligible}
          pending={aiPending}
          onRetry={requestAi}
          onShow={() => { const first = targets.find((item) => item.ai.length); if (first) { chooseFilter("all"); select(first); } }}
        />
      ) : null}

      <div className="rv-top">
        <section className="rv-summary" aria-labelledby="rv-title">
          <div className="rv-summary__head">
            <div className="rv-summary__chips">
              <span className="rv-chip rv-chip--state"><span className={`rv-dot rv-dot--${report.scanStatus.toLowerCase()}`} />{scanStateLabel[report.scanStatus]}</span>
              <span className="rv-chip">{review?.status === "COMPLETED" ? "AI 꼼꼼 점검 포함" : "무료 기본 점검"}</span>
              {publicSample ? <span className="rv-chip rv-chip--brand">예시 데이터</span> : null}
            </div>
            <h1 id="rv-title" className="rv-summary__title">쇼핑몰 점검 결과</h1>
            <p className="rv-summary__site">점검한 쇼핑몰 <b>{report.targetUrl}</b></p>
          </div>

          <div className="rv-summary__body">
            <ResultRing results={items} />
            <div className="rv-summary__text">
              <h2 className="rv-summary__headline">{headline}</h2>
              <p className="rv-summary__note">
                {count("none") ? `점검 못 한 ${count("none")}가지는 이유와 예방 방법을 함께 알려드려요. ` : ""}
                ‘괜찮아요’는 점검한 범위에서 문제가 안 보였다는 뜻이고, 법적으로 문제없다는 보증은 아니에요.
              </p>
              <ul className="rv-counts">
                {(["risk", "review", "none", "clear"] as const).map((kind) => (
                  <li key={kind}>
                    <button type="button" className="rv-count" onClick={() => showCount(kind)} disabled={!count(kind)} aria-label={`${plainLabels[kind]} ${count(kind)}곳 보기`}>
                      <span className={`rv-count__num rv-count__num--${kind} tnum`}>{count(kind)}</span>
                      <span className="rv-count__label"><Mark kind={kind} />{plainLabels[kind]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rv-summary__method">
            <span className="rv-summary__method-label">점검 방법</span>
            <span className="rv-pill">{staticMode ? "공개 화면 읽기" : "실제 구매 과정 확인"}</span>
            <span className="rv-pill">{viewportLabel(report.viewport)} · {pathLabel(report.purchasePath)}</span>
            <span className="rv-pill tnum">걸린 시간 {formatDuration(report.durationMs)}</span>
            <span className="faint">{review?.status === "COMPLETED" ? `AI 의견 ${targets.filter((item) => item.ai.length).length}곳` : "AI 사용 안 함"}</span>
          </div>
        </section>

        <aside className="rv-aside" aria-label="점검 결과 작업">
          <div className="rv-card rv-card--ink">
            <span className="rv-card__title"><Icon name="refresh" size={16} />{publicSample ? "내 쇼핑몰도 점검해 보세요" : "같은 조건으로 다시 점검"}</span>
            <p>{publicSample ? "주소만 넣으면 같은 형식의 결과를 받아볼 수 있어요." : "고친 뒤 같은 상품·화면·경로로 다시 점검하고, 이번 결과와 비교해요."}</p>
            <Button variant="inverse" block onClick={rescan} loading={pending} loadingText="요청 중">{publicSample ? "무료로 점검하기" : "지금 다시 점검하기"}</Button>
          </div>
          {targets.length ? (
            <div className="rv-card rv-card--brand">
              <span className="rv-card__kicker">유료 · AI 꼼꼼 점검</span>
              <span className="rv-card__title">확인해 보세요 {targets.length}곳을 AI가 한 번 더 봐 드려요</span>
              <p>문구의 뜻과 눈에 띄게 꾸민 부분까지 더 살펴봐요. 기본 점검 결과는 그대로 두고 AI 의견이 따로 붙어요. 근거가 부족하면 ‘확인해 보세요’로 남을 수 있어요.</p>
              {review?.status === "COMPLETED" ? (
                <Button variant="secondary" block onClick={() => { const first = targets.find((item) => item.ai.length) ?? targets[0]; select(first); }}>AI 의견 보기</Button>
              ) : (
                <Button variant="secondary" block disabled={aiBusy || review?.status === "FAILED"} onClick={() => { setAiError(""); setAiOpen(true); }}>
                  {aiBusy ? "AI 꼼꼼 점검 중" : "AI 꼼꼼 점검 받기"}
                </Button>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      {report.collectionFailure || report.explorationBlocker || staticMode ? (
        <section aria-label="점검 범위 안내" className="rv-notices">
          {report.collectionFailure ? (
            <Alert kind="warn" title={`점검 중 문제가 있었어요${report.collectionFailureCode ? ` (${collectionFailureLabels[report.collectionFailureCode]})` : ""}`}>{report.collectionFailure}</Alert>
          ) : null}
          {report.explorationBlocker ? (
            <Alert kind="warn" title="일부 화면은 점검하지 못했어요">
              {blockerText(report.explorationBlocker)}
              {report.explorationBlocker.code === "LOGIN_REQUIRED" ? " 운영자가 만든 테스트 계정으로 다시 점검할 수 있어요. 추가 인증(OTP·CAPTCHA)은 우회하지 않아요." : ""}
            </Alert>
          ) : null}
          {staticMode ? (
            <Alert kind="brand" title="공개 화면만 점검했어요" actions={<ButtonLink size="sm" variant="secondary" href="/scan/new">전체 구매 흐름 점검 시작</ButtonLink>}>
              장바구니와 주문서의 추가 비용처럼 구매 과정에서만 보이는 항목은 ‘점검 못 했어요’로 남아요.
            </Alert>
          ) : null}
        </section>
      ) : null}

      <div className="rv-split" data-view={view}>
        <div ref={listRef} className="rv-split__list">
          <TypeList
            items={items}
            filter={filter}
            onFilter={chooseFilter}
            selected={current?.type}
            onSelect={select}
            clearOpen={clearOpen}
            onClearOpen={setClearOpen}
          />
        </div>
        <div ref={detailRef} className="rv-split__detail">
          <div className="rv-mobile-bar">
            <button type="button" className="btn btn--tertiary btn--md" onClick={backToList}>
              <Icon name="chevron" size={16} className="rv-back-icon" />목록으로
            </button>
          </div>
          <div className="rv-detail-scroll">
            {current ? (
              <TypeDetail
                key={current.type}
                report={report}
                item={current}
                linesFor={linesFor}
                aiBusy={aiBusy}
                canRequestAi={canRequestAi}
                onRequestAi={() => { setAiError(""); setAiOpen(true); }}
                onRescan={rescan}
                rescanPending={pending}
                publicSample={publicSample}
              />
            ) : null}
          </div>
          <nav className="rv-pager" aria-label="이전·다음 항목">
            <Button variant="secondary" disabled={navIndex <= 0} onClick={() => select(navOrder[navIndex - 1])}>이전 항목</Button>
            <Button variant="secondary" disabled={navIndex < 0 || navIndex >= navOrder.length - 1} onClick={() => select(navOrder[navIndex + 1])}>다음 항목</Button>
          </nav>
        </div>
      </div>

      <details className="rv-more">
        <summary>
          <span>
            <b>자세한 점검 기록</b>
            <span className="faint">단계별 진행, 가격 기록, 별도 영역 탐색, 지난 점검과 비교</span>
          </span>
          <Icon name="down" size={16} />
        </summary>
        <div className="rv-more__body">
          <FlowTrack report={report} />
          <LedgerTable report={report} />
          <CoverageTable report={report} />
          {report.comparison ? (
            <section aria-labelledby="compare-head" className="rpt-section">
              <div className="rpt-section__head">
                <h2 id="compare-head" className="rpt-section__title">지난 점검과 비교</h2>
                <ButtonLink variant="tertiary" size="sm" href={`/report/${encodeURIComponent(report.comparison.baselineScanId)}`}>지난 결과 보기</ButtonLink>
              </div>
              {report.comparison.status === "UNAVAILABLE" ? (
                <Alert kind="warn" title="이번에는 지난 점검과 비교하지 않았어요">{report.comparison.reason}</Alert>
              ) : (
                <div className="rpt-compare">
                  {([["새로 생김", report.comparison.added], ["다시 보임", report.comparison.repeated], ["이번에 안 보임", report.comparison.notObserved]] as const).map(([label, signals]) => (
                    <div key={label}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{label} <span className="tnum faint">{signals.length}</span></span>
                      <ul>
                        {signals.map((signal, index) => <li key={index}>{guide[signal.type]?.plain ?? signal.type} ({stageLabels[signal.stage]})</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <p className="faint" style={{ fontSize: 13 }}>‘이번에 안 보임’은 같은 조건에서 더 이상 관찰되지 않았다는 뜻이에요. 법적으로 해결됐다는 의미는 아니에요.</p>
            </section>
          ) : null}
        </div>
      </details>

      <p className="rv-disclaimer">
        결과는 법률 판단이 아니라 공정위 가이드라인 기준의 위험 신호예요. ‘괜찮아요(안전)’는 점검한 범위에서 신호가 없었다는 뜻이며 적법함을 보증하지 않아요.
        {publicSample ? " 이 결과는 실제 쇼핑몰이 아닌 예시 데이터로 만들었어요." : ""}
      </p>

      <div className="rv-sticky-actions">
        <Button variant="secondary" icon="download" onClick={download} loading={downloadPending} loadingText="준비 중">결과 저장</Button>
        <Button onClick={rescan} loading={pending} loadingText="요청 중">{publicSample ? "무료로 점검하기" : "다시 점검하기"}</Button>
      </div>

      <AiRequestDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        targets={targets}
        eligible={report.aiEligible}
        pending={aiPending}
        error={aiError}
        onConfirm={requestAi}
      />
      {rescanner.dialog}
      {toast.node}
    </div>
  );
}
