"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError } from "@/lib/api";
import { operatorLabelOptions } from "@/lib/labels";
import type { Report, ReviewCandidate } from "@/lib/types";

const labelText = Object.fromEntries(operatorLabelOptions.map((option) => [option.value, option.label])) as Record<string, string>;

/** Paid follow-up. Never overwrites the rule results; the base report is always usable first. */
export function AiReviewPanel({ report, candidates, onRequested }: { report: Report; candidates: ReviewCandidate[]; onRequested: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const review = report.aiReview;

  async function request() {
    setPending(true);
    setError("");
    try {
      await api.requestAiReview(report.scanId);
      onRequested();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "AI 정밀 분석을 요청하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  const textOf = (id: string) => candidates.find((candidate) => candidate.id === id)?.text ?? id;
  const busy = review?.status === "QUEUED" || review?.status === "RUNNING";

  return (
    <section aria-labelledby="ai-head" className="panel panel--feature" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "46em" }}>
          <h2 id="ai-head" style={{ fontSize: 20, fontWeight: 700 }}>AI 정밀 분석</h2>
          <p className="muted" style={{ fontSize: 14 }}>이 보고서는 AI 없이 먼저 완성됐어요. 검토 필요 후보만 별도로 보내는 유료 후속 기능이고, 기존 증거와 규칙 판정을 덮어쓰지 않아요.</p>
        </div>
        {!review && candidates.length && report.aiEligible ? <Button variant="secondary" onClick={request} loading={pending} loadingText="요청 중">AI 정밀 분석 요청</Button> : null}
      </div>

      {!candidates.length ? <p className="faint" style={{ fontSize: 14 }}>이 보고서에는 AI로 넘길 검토 필요 후보가 없어요.</p> : null}
      {candidates.length && !report.aiEligible && !review ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, background: "var(--canvas)", fontSize: 14 }}>
          <Icon name="lock" color="var(--ink-2)" />무료 진단은 기본 엔진 결과만 제공해요. 유료 권한이 확인되면 이 보고서에서 요청할 수 있어요.
        </div>
      ) : null}
      {busy ? (
        <div role="status" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, background: "var(--tint)", fontSize: 14, fontWeight: 600 }}>
          <Spinner color="var(--brand)" />AI 정밀 분석 {review?.status === "QUEUED" ? "대기 중" : "진행 중"}
          <span className="muted" style={{ fontWeight: 400 }}>기본 보고서는 지금 바로 이용할 수 있어요.</span>
        </div>
      ) : null}
      {review?.status === "FAILED" ? (
        <Alert kind="error" title="AI 정밀 분석에 실패했어요" actions={report.aiEligible ? <Button variant="secondary" size="sm" onClick={request} loading={pending}>다시 요청</Button> : undefined}>
          {review.error ?? "잠시 후 다시 요청해 주세요."} 기존 보고서와 규칙 판정은 그대로예요.
        </Alert>
      ) : null}
      {review?.status === "COMPLETED" ? (
        <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="tnum faint" style={{ fontSize: 13 }}>
            분석 완료, 후보 {review.candidateCount}건{review.durationMs != null ? `, ${(review.durationMs / 1000).toFixed(1)}초` : ""}{review.usage ? `, 비용 ${review.usage.estimatedCostUsd.toFixed(6)} USD` : ""}
          </span>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {review.result?.decisions?.map((decision) => (
              <li key={decision.candidateId} style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", gap: 12, padding: "12px 0", borderTop: "1px solid var(--surface-sub)", fontSize: 14 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <b>{labelText[decision.label] ?? decision.label}</b>
                  <span className="tnum faint">신뢰도 {(decision.confidence * 100).toFixed(0)}%</span>
                </span>
                <span className="muted"><b style={{ color: "var(--ink)" }}>{textOf(decision.candidateId)}</b> {decision.rationale}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <Alert kind="error" title={error} /> : null}
      {report.aiUsage?.calls ? (
        <span className="tnum faint" style={{ fontSize: 13 }}>이 진단에서 AI를 {report.aiUsage.calls}회 호출했어요.</span>
      ) : null}
    </section>
  );
}
