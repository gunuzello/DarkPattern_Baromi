"use client";

import { visibleEvidenceIds } from "@/lib/evidence";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { api, ApiError } from "@/lib/api";
import { operatorLabelOptions, stageLabels } from "@/lib/labels";
import type { OperatorLabel, ReviewCandidate } from "@/lib/types";

/** Wording the rules did not decide on. Labels are saved for later AI evaluation, never auto-judged. */
export function ReviewCandidates({ scanId, candidates }: { scanId: string; candidates: ReviewCandidate[] }) {
  const [labels, setLabels] = useState<Record<string, OperatorLabel | "">>({});
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const chosen = Object.entries(labels).filter((entry): entry is [string, OperatorLabel] => Boolean(entry[1]));

  async function save() {
    setState("saving");
    setError("");
    try {
      await api.saveLabels(scanId, chosen.map(([candidateId, label]) => ({ candidateId, label })));
      setState("saved");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "운영자 라벨을 저장하지 못했어요.");
      setState("idle");
    }
  }

  return (
    <div className="panel panel--feature">
      {candidates.map((candidate) => (
        <div key={candidate.id} className="candidate">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="t-caption">{candidate.stage === "surface" ? "별도 탐색 영역" : stageLabels[candidate.stage]}</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>“{candidate.text}”</span>
            <span className="muted" style={{ fontSize: 14 }}>{candidate.reason} <span className="mono faint">{visibleEvidenceIds(candidate.evidenceIds).join(", ")}</span></span>
          </div>
          <div className="field">
            <label htmlFor={`label-${candidate.id}`} style={{ fontSize: 13, fontWeight: 600 }}>운영자 라벨</label>
            <span className="select" style={{ width: "100%" }}>
              <select
                id={`label-${candidate.id}`}
                className="input"
                value={labels[candidate.id] ?? ""}
                onChange={(event) => { setLabels((current) => ({ ...current, [candidate.id]: event.target.value as OperatorLabel | "" })); setState("idle"); }}
              >
                <option value="">선택</option>
                {operatorLabelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <Icon name="down" color="var(--ink-2)" />
            </span>
          </div>
        </div>
      ))}
      <div className="panel__foot">
        <span className="muted" style={{ fontSize: 13 }}>{error || "저장한 라벨은 이후 AI 평가 데이터에 포함돼요."}</span>
        {state === "saved" ? (
          <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--clear-ink)" }}><Icon name="check" size={16} />운영자 라벨을 저장했어요</span>
        ) : (
          <Button size="sm" onClick={save} disabled={!chosen.length} loading={state === "saving"} loadingText="저장 중">운영자 라벨 저장</Button>
        )}
      </div>
    </div>
  );
}
