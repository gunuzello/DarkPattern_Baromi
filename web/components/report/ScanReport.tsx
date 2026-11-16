"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ResultBadge, ScanStatusBadge } from "@/components/ui/Status";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage, isDemo, usesSample } from "@/lib/api";
import { sampleEvidenceLines } from "@/lib/demo";
import { useBackToRegistration } from "@/lib/session";
import { blockerText, collectionFailureLabels, ruleByType, stageLabels } from "@/lib/labels";
import { checkResults, type CheckResult } from "@/lib/checks";
import { formatDuration, hostOf, pathLabel, viewportLabel } from "@/lib/format";
import type { Finding, Report } from "@/lib/types";
import { AiReviewPanel } from "./AiReviewPanel";
import { CoverageTable, FlowTrack, LedgerTable } from "./ReportSections";
import { FindingRows } from "./FindingRows";
import { ReviewCandidates } from "./ReviewCandidates";
import { ResultRing } from "./ResultRing";

/**
 * Report layout from feature/redesign (document canvas + sticky action sidebar),
 * built on the Ledger design system and the real `/scans/:id/report` response.
 */
export function ScanReport({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const backToRegistration = useBackToRegistration();

  const load = useCallback(async () => {
    try {
      const next = await api.getReport(id);
      setReport(next);
      return next;
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost && !usesSample(id)) { backToRegistration(); return undefined; }
      setError(errorMessage(cause, "진단 결과를 불러오지 못했어요."));
      return undefined;
    }
  }, [id, backToRegistration]);

  useEffect(() => { void load(); }, [load]);

  // Poll only while the paid AI follow-up is in progress.
  useEffect(() => {
    if (report?.aiReview?.status !== "QUEUED" && report?.aiReview?.status !== "RUNNING") return;
    const timer = setTimeout(() => { void load(); }, 1000);
    return () => clearTimeout(timer);
  }, [report, load]);

  const sample = usesSample(id);
  const publicSample = sample && !isDemo;

  function downloadSample() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `baromi-${id}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.show("보고서 JSON을 내려받았어요");
  }

  async function downloadReport() {
    setDownloadPending(true);
    try {
      const blob = await api.downloadReport(id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `baromi-${id}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show("보고서 JSON을 내려받았어요");
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) { backToRegistration(); return; }
      setError(errorMessage(cause, "보고서를 내려받지 못했어요."));
    } finally {
      setDownloadPending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.show("보고서 링크를 복사했어요");
    } catch {
      toast.show("링크를 복사하지 못했어요");
    }
  }

  async function rescan() {
    if (!report) return;
    if (publicSample) { router.push("/scan/new"); return; }
    setPending(true);
    try {
      const next = await api.createScan({
        shopId: report.shopId, baselineScanId: id,
        profile: report.executionMode === "DYNAMIC" ? "DYNAMIC" : "CONTEST",
        viewport: report.viewport, purchasePath: report.purchasePath,
      });
      router.push(`/scan/${encodeURIComponent(next.scanId)}${next.deduplicated ? "?dedup=1" : ""}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.sessionLost) backToRegistration();
      else {
        setError(errorMessage(cause, "재진단을 시작하지 못했어요."));
        setPending(false);
      }
    }
  }

  if (!report) return error ? <Alert kind="error" title={error} /> : <p role="status" className="muted">진단 결과를 불러오고 있어요.</p>;

  const results = checkResults(report);
  const count = (kind: CheckResult["kind"]) => results.filter((result) => result.kind === kind).length;
  const suspected = results.filter((result) => result.kind === "risk").flatMap((result) => result.findings);
  const review = results.filter((result) => result.kind === "review").flatMap((result) => result.findings);
  const candidates = (report.reviewCandidates ?? []).filter((candidate) => candidate.ruleType
    && report.ruleCoverage?.[candidate.ruleType]?.status === "REVIEW_NEEDED");
  const reviewTypeCount = new Set([...review.map(({ type }) => type), ...candidates.map(({ ruleType }) => ruleType)]).size;
  const riskWithoutFinding = results.filter((result) => result.kind === "risk" && result.findings.length === 0);
  const reviewWithoutDetail = results.filter((result) => result.kind === "review" && result.findings.length === 0
    && !candidates.some((candidate) => candidate.ruleType === result.type));
  const staticMode = report.executionMode !== "DYNAMIC";
  const failed = report.scanStatus === "FAILED" || report.scanStatus === "CANCELLED";
  const headline = failed
    ? "진단을 끝까지 마치지 못했어요"
    : count("risk") + count("review") === 0
      ? "검사한 범위에서 위험 신호를 관찰하지 못했어요"
      : `위험 신호 ${count("risk")}건, 검토 필요 ${count("review")}건이 있어요`;
  const linesFor = (finding: Finding) => (sample ? sampleEvidenceLines[finding.id] : undefined)
    ?? report.priceLedger?.stages.find((stage) => stage.stage === finding.stage)?.displayedLines;

  return (
    <div className="rpt">
      <div className="rpt-topbar">
        <nav aria-label="경로" className="crumbs">
          {publicSample ? (
            <><Link href="/">바로미</Link><Icon name="chevron" size={12} color="#a0a4ab" /><span>예시 보고서</span></>
          ) : (
            <>
              <Link href="/shops">내 쇼핑몰</Link><Icon name="chevron" size={12} color="#a0a4ab" />
              <Link href={`/shop/${encodeURIComponent(report.shopId)}`}>진단 이력</Link><Icon name="chevron" size={12} color="#a0a4ab" />
              <span>{hostOf(report.targetUrl)}</span>
            </>
          )}
        </nav>
        <div className="rpt-topbar__actions">
          <span className="faint" style={{ fontSize: 12 }}>보고서 번호 <span className="mono">{id.slice(0, 8)}</span></span>
          <Button variant="tertiary" size="sm" onClick={copyLink}>링크 복사</Button>
          <Button variant="tertiary" size="sm" onClick={() => window.print()}>인쇄</Button>
          {sample
            ? <Button variant="secondary" size="sm" icon="download" onClick={downloadSample}>JSON</Button>
            : <Button variant="secondary" size="sm" icon="download" loading={downloadPending} loadingText="준비 중" onClick={downloadReport}>JSON</Button>}
        </div>
      </div>

      {error ? <Alert kind="error" title={error} /> : null}

      <div className="rpt-grid">
        <article className="rpt-doc" aria-labelledby="rpt-title">
          <header className="rpt-doc__head">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <ScanStatusBadge status={report.scanStatus} />
              <span className="rpt-chip">{staticMode ? "공개 화면 진단" : "전체 구매 흐름 진단"}</span>
              {publicSample ? <span className="rpt-chip rpt-chip--brand">예시 데이터</span> : null}
            </div>
            <h1 id="rpt-title" className="rpt-doc__title">구매 흐름 진단 보고서</h1>
            <div className="rpt-doc__meta">
              <span>대상 <b style={{ overflowWrap: "anywhere" }}>{report.targetUrl}</b></span>
              <span>{viewportLabel(report.viewport, true)}</span>
              <span>{pathLabel(report.purchasePath)}</span>
              <span className="tnum">소요 {formatDuration(report.durationMs)}</span>
            </div>
          </header>

          <section aria-label="한눈에 보기" className="rpt-ribbon">
            <ResultRing results={results} />
            <div className="rpt-ribbon__text">
              <h2 className="rpt-ribbon__headline">{headline}</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                16가지 점검 항목 중 {count("clear")}개는 미관찰, {count("none")}개는 이유와 함께 미검사로 남았어요.
              </p>
              <div className="rpt-ribbon__stats">
                {(["risk", "review", "clear", "none"] as const).map((kind) => (
                  <div key={kind} className="rpt-stat">
                    <span className={`rpt-stat__num rpt-stat__num--${kind} tnum`}>{count(kind)}</span>
                    <ResultBadge kind={kind} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <FlowTrack report={report} />

          {report.collectionFailure || report.explorationBlocker || staticMode || report.scanStatus === "PARTIAL" ? (
            <section aria-label="검증 범위 안내" className="rpt-section rpt-notices">
              {report.collectionFailure ? (
                <Alert kind="warn" title={`수집 안내${report.collectionFailureCode ? ` (${collectionFailureLabels[report.collectionFailureCode]})` : ""}`}>{report.collectionFailure}</Alert>
              ) : null}
              {report.explorationBlocker ? (
                <Alert kind="warn" title="검증 범위가 제한됐어요">{blockerText(report.explorationBlocker)}</Alert>
              ) : null}
              {staticMode ? (
                <Alert kind="brand" title="공개 화면만 진단했어요" actions={<ButtonLink size="sm" variant="secondary" href="/scan/new">전체 구매 흐름 진단 시작</ButtonLink>}>
                  장바구니와 주문서의 추가 비용, 구매 행동 뒤에 나오는 항목은 미검사예요.
                </Alert>
              ) : null}
              {report.scanStatus === "PARTIAL" && !staticMode ? (
                <Alert title="검사를 이어가는 방법">
                  로그인이 필요하면 운영자가 만든 전용 테스트 계정으로 재진단할 수 있어요. OTP·CAPTCHA는 우회하지 않으니 테스트 계정에서 추가 인증을 먼저 마쳐 주세요.
                </Alert>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="risk-head" className="rpt-section">
            <div className="rpt-section__head">
              <h2 id="risk-head" className="rpt-section__title">위험 신호 상세와 권고 조치 <span className="tnum faint">{suspected.length + riskWithoutFinding.length}</span></h2>
              <ResultBadge kind="risk" />
            </div>
            {suspected.length
              ? <FindingRows report={report} findings={suspected} tone="risk" linesFor={linesFor} />
              : riskWithoutFinding.length === 0
                ? <p className="muted" style={{ fontSize: 14 }}>검사한 범위에서 규칙 조건을 충족한 위험 신호는 없어요.</p>
                : null}
            {riskWithoutFinding.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {riskWithoutFinding.map((result) => (
                  <div key={result.type} className="panel" style={{ padding: 16 }}><b>{ruleByType[result.type].name}</b><p className="muted">{result.note}</p>{result.evidenceIds.length ? <span className="mono faint">{result.evidenceIds.join(", ")}</span> : null}</div>
                ))}
              </div>
            ) : null}
          </section>

          {review.length || candidates.length || reviewWithoutDetail.length ? (
            <section aria-labelledby="review-head" className="rpt-section">
              <div className="rpt-section__head">
                <h2 id="review-head" className="rpt-section__title">검토 필요 항목 <span className="tnum faint">{reviewTypeCount}</span></h2>
                <ResultBadge kind="review" />
              </div>
              <p className="muted" style={{ fontSize: 14, marginTop: -8 }}>문구나 표시 맥락의 해석이 필요한 유형이에요. 기본 사실 판정과 구분해 보고서에 근거를 남겨요.</p>
              {review.length ? <FindingRows report={report} findings={review} tone="review" linesFor={linesFor} /> : null}
              {reviewWithoutDetail.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reviewWithoutDetail.map((result) => (
                    <div key={result.type} className="panel" style={{ padding: 16 }}><b>{ruleByType[result.type].name}</b><p className="muted">{result.note}</p>{result.evidenceIds.length ? <span className="mono faint">{result.evidenceIds.join(", ")}</span> : null}</div>
                  ))}
                </div>
              ) : null}
              {candidates.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>운영자 검토 기록</h3>
                  <p className="muted" style={{ fontSize: 13 }}>직접 확인한 결과를 남기면 다음 진단과 AI 평가에 참고해요.</p>
                  <ReviewCandidates scanId={id} candidates={candidates} />
                </div>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="all-head" className="rpt-section">
            <div className="rpt-section__head">
              <h2 id="all-head" className="rpt-section__title">16가지 점검 항목</h2>
              <span className="faint" style={{ fontSize: 13 }}>{report.ruleCoverage ? "서버 판정 기준" : "검사 범위로 계산"}</span>
            </div>
            <div className="table-wrap">
              <table className="rpt-table">
                <thead><tr><th style={{ width: 36 }}>#</th><th>유형</th><th style={{ width: 120 }}>결과</th><th>근거 또는 미검사 사유</th></tr></thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={result.type} className={`is-${result.kind}`}>
                      <td className="tnum faint">{String(index + 1).padStart(2, "0")}</td>
                      <td>
                        <span style={{ display: "block", fontWeight: 600 }}>{result.name}</span>
                        <a className="faint" style={{ fontSize: 12 }} href={ruleByType[result.type].source} target="_blank" rel="noreferrer">{ruleByType[result.type].reference}</a>
                      </td>
                      <td><ResultBadge kind={result.kind} /></td>
                      <td>
                        <span className={result.kind === "none" ? "" : "muted"}>{result.note || "—"}</span>
                        {result.evidenceIds.length ? <span className="mono faint rpt-ids">{result.evidenceIds.join(", ")}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <LedgerTable report={report} />
          <CoverageTable report={report} />

          {report.comparison ? (
            <section aria-labelledby="compare-head" className="rpt-section">
              <div className="rpt-section__head">
                <h2 id="compare-head" className="rpt-section__title">재진단 비교</h2>
                <ButtonLink variant="tertiary" size="sm" href={`/report/${encodeURIComponent(report.comparison.baselineScanId)}`}>기준 보고서</ButtonLink>
              </div>
              {report.comparison.status === "UNAVAILABLE" ? (
                <Alert kind="warn" title="이번에는 이전 진단과 비교하지 않았어요">{report.comparison.reason}</Alert>
              ) : (
                <div className="rpt-compare">
                  {([["신규", report.comparison.added], ["반복", report.comparison.repeated], ["이번에 미관찰", report.comparison.notObserved]] as const).map(([label, signals]) => (
                    <div key={label}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{label} <span className="tnum faint">{signals.length}</span></span>
                      <ul>
                        {signals.map((signal, index) => <li key={index}>{ruleByType[signal.type]?.name ?? signal.type} ({stageLabels[signal.stage]})</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <p className="faint" style={{ fontSize: 13 }}>‘이번에 미관찰’은 같은 조건에서 더 이상 관측되지 않았다는 뜻이에요. 법적으로 해결됐다는 의미는 아니에요.</p>
            </section>
          ) : null}

          <div id="ai" className="rpt-section">
            <AiReviewPanel report={report} candidates={candidates} onRequested={() => { void load(); toast.show("AI 정밀 분석을 요청했어요"); }} />
          </div>

          <p className="rpt-disclaimer">
            결과는 법률 판단이 아니라 가이드라인 기준의 위험 신호예요. ‘미관찰’은 검사한 범위에서 신호가 없었다는 뜻이며 적법함을 보증하지 않아요.
            {publicSample ? " 이 보고서는 실제 쇼핑몰이 아닌 예시 데이터로 만들었어요." : ""}
          </p>
        </article>

        <aside className="rpt-side" aria-label="보고서 작업">
          <div className="rpt-box rpt-box--ink">
            <span className="rpt-box__title"><Icon name="refresh" size={16} />같은 조건으로 재진단</span>
            <p>{publicSample ? "내 쇼핑몰 주소로 같은 형식의 보고서를 받아보세요." : "수정한 뒤 같은 상품·화면·경로로 다시 진단하고 이번 결과와 비교해요."}</p>
            <Button variant="inverse" block onClick={rescan} loading={pending} loadingText="요청 중">{publicSample ? "내 쇼핑몰 진단하기" : "지금 재진단"}</Button>
          </div>

          <div className="rpt-box">
            <span className="rpt-box__title">진단 조건</span>
            <dl className="kv tnum">
              <dt>범위</dt><dd>{staticMode ? "공개 화면" : "전체 구매 흐름"}</dd>
              <dt>화면</dt><dd>{viewportLabel(report.viewport, true)}</dd>
              <dt>구매 경로</dt><dd>{pathLabel(report.purchasePath)}</dd>
              <dt>소요 시간</dt><dd>{formatDuration(report.durationMs)}</dd>
            </dl>
          </div>

          {candidates.length || report.aiReview ? (
            <div className="rpt-box rpt-box--brand">
              <span className="rpt-chip rpt-chip--brand" style={{ alignSelf: "flex-start" }}>유료 후속 기능</span>
              <span className="rpt-box__title">AI 정밀 분석</span>
              <p>검토 필요 {candidates.length}건을 AI로 한 번 더 살펴봐요. 기존 증거와 판정은 덮어쓰지 않아요.</p>
              <a href="#ai" className="btn btn--secondary btn--md btn--block">{report.aiReview ? "분석 상태 보기" : "자세히 보기"}</a>
            </div>
          ) : null}

          {publicSample ? null : (
            <div className="rpt-box">
              <span className="rpt-box__title">상점 진단 이력</span>
              <p>이 쇼핑몰의 회차별 진단과 변화를 비교해 보세요.</p>
              <ButtonLink variant="secondary" block href={`/shop/${encodeURIComponent(report.shopId)}`}>진단 이력 보기</ButtonLink>
            </div>
          )}

          <Alert title="바로미가 하지 않는 것">결제와 주문 확정은 누르지 않고, OTP·CAPTCHA는 우회하지 않아요.</Alert>
        </aside>
      </div>
      {toast.node}
    </div>
  );
}
