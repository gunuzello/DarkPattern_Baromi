"use client";

import { useState } from "react";
import { api, usesSample } from "@/lib/api";
import type { Bounds, Stage } from "@/lib/types";
import { stageLabels } from "@/lib/labels";

/**
 * A stage screenshot with the flagged element outlined, positioned the same way as the
 * backend's finding-detail page (element bounds relative to the captured area).
 */
export function EvidenceShot({ scanId, stage, area, element, priceLines }: {
  scanId: string; stage: Stage; area?: Bounds; element?: Bounds; priceLines?: string[];
}) {
  const [failed, setFailed] = useState(false);
  const left = area && element ? Math.max(0, element.x - area.x) : 0;
  const top = area && element ? Math.max(0, element.y - area.y) : 0;
  const right = area && element ? Math.min(area.width, element.x + element.width - area.x) : 0;
  const bottom = area && element ? Math.min(area.height, element.y + element.height - area.y) : 0;
  const showBox = area && right > left && bottom > top;

  const sample = usesSample(scanId);
  if (sample || failed) {
    return (
      <div className="evidence-placeholder" role="img" aria-label={`${stageLabels[stage]} 화면의 가격 기록`}>
        <span className="t-caption">{sample ? "예시 보고서라 스크린샷 대신 화면에서 읽은 기록을 보여드려요" : "스크린샷을 불러오지 못했어요"}</span>
        {priceLines?.length ? (
          <ul className="tnum">{priceLines.map((line, index) => <li key={index}>{line}</li>)}</ul>
        ) : null}
      </div>
    );
  }
  return (
    <div className="evidence-image">
      <img src={api.evidenceUrl(scanId, stage)} alt={`${stageLabels[stage]} 진단 화면`} onError={() => setFailed(true)} />
      {showBox ? (
        <span
          role="img"
          aria-label="위험 신호 위치"
          className="evidence-highlight"
          style={{
            left: `${(left / area.width) * 100}%`,
            top: `${(top / area.height) * 100}%`,
            width: `${((right - left) / area.width) * 100}%`,
            height: `${((bottom - top) / area.height) * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}
