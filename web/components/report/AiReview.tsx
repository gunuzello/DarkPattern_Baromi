"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { AiDiagnosis } from "@/lib/aiDiagnosis";

/** Base-report banner for the AI 정밀 점검 (selected checks, 3-level verdict). */
export function AiDiagnosisBanner({ diagnosis, href }: { diagnosis: AiDiagnosis; href: string }) {
  const total = diagnosis.requestedTypes.length;
  if (diagnosis.status === "QUEUED" || diagnosis.status === "RUNNING") {
    return (
      <section role="status" className="rv-banner rv-banner--busy">
        <div className="rv-banner__text">
          <b>AI 정밀 점검 {diagnosis.status === "QUEUED" ? "준비 중" : "중"} · {diagnosis.doneCount ?? 0}/{total}개 분석</b>
          <span>기본 점검 결과는 지금도 볼 수 있어요. 창을 닫아도 계속 진행돼요.</span>
        </div>
        <Link href={href} className="btn btn--secondary btn--sm">진행 보기</Link>
        <span className="rv-banner__bar" aria-hidden="true"><span /></span>
      </section>
    );
  }
  if (diagnosis.status === "FAILED") {
    return (
      <section role="alert" className="rv-banner rv-banner--fail">
        <Icon name="alert" color="var(--risk-ink)" />
        <div className="rv-banner__text">
          <b>AI 정밀 점검에 실패했어요</b>
          <span>{diagnosis.error ?? "분석 결과가 돌아오지 않았어요."} 기본 점검 결과는 그대로예요.</span>
        </div>
        <Link href={href} className="btn btn--secondary btn--sm">다시 요청</Link>
      </section>
    );
  }
  if (diagnosis.status === "CANCELLED") {
    return (
      <section role="status" className="rv-banner rv-banner--fail">
        <Icon name="alert" color="var(--risk-ink)" />
        <div className="rv-banner__text">
          <b>AI 정밀 점검을 중단했어요</b>
          <span>기본 점검 결과는 그대로예요.</span>
        </div>
        <Link href={href} className="btn btn--secondary btn--sm">다시 요청</Link>
      </section>
    );
  }
  const risk = diagnosis.items.filter((item) => item.verdict === "RISK" && item.status === "ANALYZED").length;
  return (
    <section role="status" className="rv-banner rv-banner--ai">
      <span className="ai-kicker" aria-hidden="true"><Icon name="spark" size={14} />AI</span>
      <div className="rv-banner__text">
        <b>AI 정밀 점검 리포트가 준비됐어요</b>
        <span>{total}개 항목을 분석했어요{risk ? `. 위험 ${risk}개를 먼저 확인해 보세요.` : "."} 기본 점검 결과와 따로 보여드려요.</span>
      </div>
      <Link href={href} className="btn btn--brand btn--sm">AI 리포트 보기</Link>
    </section>
  );
}
