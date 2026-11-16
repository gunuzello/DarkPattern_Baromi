"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { AiReview } from "@/lib/types";
import type { AiDiagnosis } from "@/lib/aiDiagnosis";
import type { ReportItem } from "./model";

/**
 * R-06 / M-03: request the paid AI follow-up for every 확인해 보세요 check at once.
 * A modal on PC, a bottom sheet on phones (CSS). Esc or a click outside closes it,
 * and focus starts on 취소.
 */
export function AiRequestDialog({ open, onClose, targets, eligible, pending, error, onConfirm }: {
  open: boolean;
  onClose: () => void;
  targets: ReportItem[];
  eligible: boolean;
  pending: boolean;
  error: string;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="rv-dialog"
      aria-labelledby="ai-dialog-title"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="rv-dialog__inner">
        <span className="rv-dialog__grip" aria-hidden />
        <h2 id="ai-dialog-title" className="rv-dialog__title">{eligible ? "AI 정밀 점검을 요청할까요?" : "AI 정밀 점검은 유료 기능이에요"}</h2>
        <p className="muted">
          {eligible
            ? `무료 점검에서 ‘확인해 보세요’로 남은 ${targets.length}곳을 모두 AI가 분석해요. 무료 점검 결과와 확인 자료는 그대로 두고, AI 의견을 각 항목에 따로 붙여요.`
            : "이 쇼핑몰은 아직 유료로 이용할 수 없어요. 무료 점검 결과는 지금처럼 계속 볼 수 있어요."}
        </p>

        <ul className="rv-dialog__targets">
          {targets.map((item) => (
            <li key={item.type}><span className="tnum faint">{item.no}</span>{item.plain}</li>
          ))}
        </ul>

        {eligible ? (
          <>
            <div className="rv-dialog__box">
              <b>AI에게 보내는 자료</b>
              <p>점검 항목, 바로미 1차 분석, 관련 문구와 화면 내용, 가격·선택 상태, 확인 번호, 더 살펴봐야 하는 이유</p>
              <p className="rv-dialog__safe"><Icon name="lock" size={14} />보내지 않는 정보: 개인정보, 로그인·인증 정보</p>
            </div>
            <div className="rv-dialog__fee">
              <b>요금</b>
              <Link href="/#pricing">요금 안내 보기</Link>
            </div>
            <p className="faint" style={{ fontSize: 13 }}>근거가 부족한 항목은 AI가 분석한 뒤에도 ‘확인해 보세요’로 남을 수 있어요. 실제 재고, 예전 가격, 후기 조작, 광고 계약 여부는 AI도 단정하지 않아요.</p>
          </>
        ) : null}

        {error ? <Alert kind="error" title={error} /> : null}

        <div className="rv-dialog__actions">
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>{eligible ? "취소" : "닫기"}</Button>
          {eligible
            ? <Button variant="brand" onClick={onConfirm} loading={pending} loadingText="요청 중">{targets.length}곳 AI 점검 요청</Button>
            : <Link href="/#pricing" className="btn btn--brand btn--md">요금 안내 보기</Link>}
        </div>
      </div>
    </dialog>
  );
}

/** R-07: status of the AI follow-up, shown above the summary. The free result stays usable. */
export function AiStatusBanner({ review, targets, eligible, pending, onRetry, onShow }: {
  review: AiReview;
  targets: ReportItem[];
  eligible: boolean;
  pending: boolean;
  onRetry: () => void;
  onShow: () => void;
}) {
  const total = targets.length || review.candidateCount;
  if (review.status === "QUEUED" || review.status === "RUNNING") {
    return (
      <section role="status" className="rv-banner rv-banner--busy">
        <div className="rv-banner__text">
          <b>AI 정밀 점검 {review.status === "QUEUED" ? "준비 중" : "중"} · {total}곳 분석</b>
          <span>보통 몇 분 걸려요. 기본 점검 결과는 지금도 볼 수 있어요. 창을 닫아도 계속 진행돼요.</span>
        </div>
        <span className="rv-banner__bar" aria-hidden><span /></span>
      </section>
    );
  }
  if (review.status === "FAILED") {
    return (
      <section role="alert" className="rv-banner rv-banner--fail">
        <Icon name="alert" color="var(--risk-ink)" />
        <div className="rv-banner__text">
          <b>AI 정밀 점검에 실패했어요</b>
          <span>{review.error ?? "분석 결과가 돌아오지 않았어요."} 무료 점검 결과와 확인 자료는 그대로예요.</span>
        </div>
        {eligible ? <Button variant="secondary" size="sm" onClick={onRetry} loading={pending} loadingText="요청 중">다시 요청</Button> : null}
      </section>
    );
  }
  const answered = targets.filter((item) => item.ai.length).length;
  return (
    <section role="status" className="rv-banner rv-banner--done">
      <Icon name="check" color="var(--clear-ink)" />
      <div className="rv-banner__text">
        <b>AI 정밀 점검을 마쳤어요</b>
        <span>
          {total}곳 중 {answered}곳에 AI 의견이 붙었어요.
          {answered < total ? ` ${total - answered}곳은 근거가 부족해 ‘확인해 보세요’로 남았어요.` : " 결과 표시는 그대로 ‘확인해 보세요’예요."}
        </span>
      </div>
      {answered ? <Button variant="secondary" size="sm" onClick={onShow}>AI 의견 보기</Button> : null}
    </section>
  );
}

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
