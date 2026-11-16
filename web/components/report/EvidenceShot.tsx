"use client";

import { useEffect, useState } from "react";
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
  const [src, setSrc] = useState<string>();
  const sample = usesSample(scanId);

  // Fetch with the login token instead of a bare <img src>, which cannot carry it.
  useEffect(() => {
    if (sample) return;
    let alive = true;
    let url: string | undefined;
    api.evidenceBlob(scanId, stage)
      .then((blob) => { if (!alive) return; url = URL.createObjectURL(blob); setSrc(url); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [scanId, stage, sample]);
  const left = area && element ? Math.max(0, element.x - area.x) : 0;
  const top = area && element ? Math.max(0, element.y - area.y) : 0;
  const right = area && element ? Math.min(area.width, element.x + element.width - area.x) : 0;
  const bottom = area && element ? Math.min(area.height, element.y + element.height - area.y) : 0;
  const showBox = area && right > left && bottom > top;

  if (sample || failed) {
    return (
      <div className="evidence-placeholder" role="img" aria-label={`${stageLabels[stage]} 화면의 가격 기록`}>
        <span className="t-caption">{sample ? "예시 결과라 스크린샷 대신 화면에서 읽은 기록을 보여드려요" : "스크린샷을 불러오지 못했어요"}</span>
        {priceLines?.length ? (
          <ul className="tnum">{priceLines.map((line, index) => <li key={index}>{line}</li>)}</ul>
        ) : null}
      </div>
    );
  }
  if (!src) return <div className="evidence-placeholder" role="status"><span className="t-caption">확인 화면을 불러오고 있어요</span></div>;
  return (
    <div className="evidence-image">
      <img src={src} alt={`${stageLabels[stage]} 점검 화면`} onError={() => setFailed(true)} />
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
