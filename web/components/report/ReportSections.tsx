import { Mark } from "@/components/ui/Status";
import { stageLabels, surfaceLabels } from "@/lib/labels";
import { formatDuration } from "@/lib/format";
import { phaseFor, phaseStatusLabels, phaseTone, surfacePhase, type PhaseTone } from "@/lib/phases";
import { stages, surfaceKinds, type PriceVerification, type Report, type Stage } from "@/lib/types";

const toneMark: Record<PhaseTone, "done" | "run" | "wait" | "partial" | "stop" | "none"> = {
  ok: "done", run: "run", wait: "wait", partial: "partial", stop: "stop", skip: "none",
};

export function PhaseBadge({ tone, label }: { tone: PhaseTone; label: string }) {
  return <span className="badge"><Mark kind={toneMark[tone]} />{label}</span>;
}

/** Purchase journey as an inline timeline (redesign "flow track"), from phaseResults. */
export function FlowTrack({ report }: { report: Report }) {
  const byStage = (stage: Stage) => report.findings.filter((finding) => {
    if (finding.stage !== stage) return false;
    const verdict = report.ruleCoverage?.[finding.type]?.status;
    return verdict ? verdict === "SUSPECTED" || verdict === "REVIEW_NEEDED" : true;
  });
  return (
    <section aria-labelledby="flow-head" className="rpt-section">
      <div className="rpt-section__head">
        <h2 id="flow-head" className="rpt-section__title">구매 흐름과 단계별 관찰</h2>
        <span className="faint" style={{ fontSize: 13 }}>별도 브라우저 세션에서 진행</span>
      </div>
      <ol className="rpt-flow">
        {stages.map((stage, index) => {
          const phase = phaseFor(report, stage);
          const tone = phaseTone[phase.status];
          const found = byStage(stage);
          const risk = found.filter((finding) => finding.status !== "REVIEW_NEEDED").length;
          const review = found.length - risk;
          const time = phase.durationMs ?? report.stageTimingsMs?.[stage];
          return (
            <li key={stage} className={`rpt-flow__step is-${risk ? "risk" : review ? "review" : tone}`}>
              <span className="rpt-flow__no tnum">{index + 1}단계</span>
              <span className="rpt-flow__name">{stageLabels[stage]}</span>
              <span className="rpt-flow__state"><PhaseBadge tone={tone} label={phaseStatusLabels[phase.status]} />{time ? <span className="tnum faint">{formatDuration(time)}</span> : null}</span>
              <span className="rpt-flow__note">
                {risk ? `위험 신호 ${risk}건` : review ? `검토 필요 ${review}건` : phase.reason ?? (phase.status === "COVERED" ? "신호 없음" : "")}
              </span>
            </li>
          );
        })}
        <li className="rpt-flow__step is-end">
          <span className="rpt-flow__no">여기서 멈춤</span>
          <span className="rpt-flow__name">최종 결제</span>
          <span className="rpt-flow__note" style={{ color: "var(--clear-ink)", fontWeight: 600 }}>결제·주문 확정은 실행하지 않음</span>
        </li>
      </ol>
    </section>
  );
}

const verificationText: Record<PriceVerification, string> = {
  SCREEN_ONLY: "화면만 확인",
  SCREEN_NETWORK_AGREE: "화면·응답 일치",
  SCREEN_NETWORK_PARTIAL: "일부만 일치",
  SCREEN_NETWORK_DISAGREE: "화면·응답 불일치",
};

/** Spec §13.4 price ledger, a full-width plain table (redesign style). */
export function LedgerTable({ report }: { report: Report }) {
  const ledger = report.priceLedger;
  return (
    <section aria-labelledby="ledger-head" className="rpt-section">
      <div className="rpt-section__head">
        <h2 id="ledger-head" className="rpt-section__title">단계별 가격 원장</h2>
        <span className="faint" style={{ fontSize: 13 }}>출처별 관찰 기록, 실제 결제 금액의 정답이 아니에요</span>
      </div>
      {!ledger?.stages.length ? (
        <p className="muted" style={{ fontSize: 14 }}>이 보고서에는 단계별 가격 기록이 없어요.</p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 14 }}>
            첫 가격 노출: {ledger.firstPriceExposure?.status === "OBSERVED"
              ? <b style={{ color: "var(--ink)" }}>{ledger.firstPriceExposure.text ?? ledger.firstPriceExposure.amounts?.map((won) => `${won.toLocaleString()}원`).join(", ")}</b>
              : "확인하지 못함"}
          </p>
          <div className="table-wrap">
            <table className="rpt-table">
              <thead><tr><th style={{ width: 110 }}>단계</th><th>화면에 표시된 가격</th><th style={{ width: 150 }}>화면·응답 대조</th><th style={{ width: 120 }}>증거</th></tr></thead>
              <tbody>
                {ledger.stages.map((row) => (
                  <tr key={row.stage}>
                    <td style={{ fontWeight: 600 }}>{stageLabels[row.stage]}</td>
                    <td>
                      <ul className="rpt-lines tnum">{row.displayedLines.map((line, index) => <li key={index}>{line}</li>)}</ul>
                    </td>
                    <td>
                      <span className={`rpt-verify rpt-verify--${row.verification.toLowerCase()}`}>{verificationText[row.verification]}</span>
                      {row.networkValues?.length ? <span className="faint tnum" style={{ display: "block", fontSize: 12 }}>응답 {row.networkValues.length}건 중 {row.networkValues.filter((v) => v.matchedScreen).length}건 일치</span> : null}
                    </td>
                    <td className="mono faint" style={{ fontSize: 12 }}>{row.evidence?.id ?? `page:${row.stage}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** Spec §3.5/§6: all three stages and all seven surfaces, with time and reason. */
export function CoverageTable({ report }: { report: Report }) {
  const rows = [
    ...stages.map((stage) => ({ id: stage, group: "구매 단계", name: stageLabels[stage], phase: phaseFor(report, stage), time: report.stageTimingsMs?.[stage] })),
    ...surfaceKinds.map((kind) => ({ id: kind, group: "별도 영역", name: surfaceLabels[kind], phase: phaseFor(report, surfacePhase(kind)), time: undefined })),
  ];
  return (
    <section aria-labelledby="coverage-head" className="rpt-section">
      <div className="rpt-section__head">
        <h2 id="coverage-head" className="rpt-section__title">검사 범위</h2>
        <span className="faint tnum" style={{ fontSize: 13 }}>{rows.length}곳 중 검사 완료 {rows.filter((row) => row.phase.status === "COVERED").length}곳</span>
      </div>
      <div className="table-wrap">
        <table className="rpt-table">
          <thead><tr><th style={{ width: 90 }}>구분</th><th>범위</th><th style={{ width: 140 }}>상태</th><th style={{ width: 80 }}>시간</th><th>사유</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="faint" style={{ fontSize: 12 }}>{row.group}</td>
                <td style={{ fontWeight: 600 }}>{row.name}</td>
                <td><PhaseBadge tone={phaseTone[row.phase.status]} label={phaseStatusLabels[row.phase.status]} /></td>
                <td className="tnum faint">{row.phase.durationMs ?? row.time ? formatDuration(row.phase.durationMs ?? row.time) : "—"}</td>
                <td className="muted" style={{ fontSize: 13 }}>{row.phase.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report.surfaceObservations?.length ? (
        <p className="faint" style={{ fontSize: 13 }}>
          읽기 전용으로 확인한 화면: {report.surfaceObservations.map((item) => `${item.title || surfaceLabels[item.kind]} (${item.evidenceId})`).join(", ")}. 폼 제출이나 결제·해지 동작은 실행하지 않았어요.
        </p>
      ) : null}
    </section>
  );
}
