"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { VerdictBadge } from "@/components/ui/Status";
import { comparisonTag } from "@/lib/checks";
import { guide } from "@/lib/guide";
import { ruleSurface, stageLabels } from "@/lib/labels";
import type { Finding, FindingType, Report } from "@/lib/types";
import { EvidenceShot } from "./EvidenceShot";
import { visibleEvidenceIds } from "@/lib/evidence";
import Link from "next/link";
import { AiVerdictBadge } from "@/components/ai/AiReport";
import type { AiItemResult } from "@/lib/aiDiagnosis";
import { ReviewCandidates } from "./ReviewCandidates";
import { aiOpinionText, methodText, type ReportItem } from "./model";

const headline: Record<ReportItem["kind"], string> = {
  risk: "",
  review: "관련된 내용은 찾았지만 기준만으로는 문제인지 확실히 말하기 어려워요. ‘고쳐야 해요’로 판단한 것은 아니에요.",
  clear: "점검한 범위에서는 문제가 안 보였어요. 쇼핑몰 전체가 법적으로 문제없다는 보증은 아니에요.",
  none: "판단에 필요한 자료를 얻지 못했어요. ‘고쳐야 해요’나 ‘괜찮아요’로 판단한 것이 아니에요.",
};

/** Checks whose evidence is the price ledger (screen-by-screen amounts). */
const priceTypes: FindingType[] = ["DRIP_PRICING", "PRESELECTION", "HIDDEN_INFO"];

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rv-block">
      <h3 className="rv-block__title">{title}</h3>
      {children}
    </section>
  );
}

export function Checklist({ id, items }: { id: string; items: string[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <ul className="rv-checklist">
      {items.map((text, index) => (
        <li key={`${id}-${index}`}>
          <label>
            <input type="checkbox" checked={Boolean(done[index])} onChange={(event) => setDone({ ...done, [index]: event.target.checked })} />
            <span>{text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Detail panel for one check (wireframe R-02 to R-05). Each result has a fixed section order. */
export function TypeDetail({ report, item, linesFor, aiBusy, canRequestAi, onRequestAi, onRescan, rescanPending, publicSample, aiResult, aiHref }: {
  report: Report;
  item: ReportItem;
  linesFor: (finding: Finding) => string[] | undefined;
  aiBusy: boolean;
  canRequestAi: boolean;
  onRequestAi: () => void;
  onRescan: () => void;
  rescanPending: boolean;
  publicSample: boolean;
  aiResult?: AiItemResult;
  aiHref?: string;
}) {
  const g = guide[item.type];
  const finding = item.findings[0];
  const reportHref = `/report/${encodeURIComponent(report.scanId)}`;
  const tag = finding ? comparisonTag(report, finding) : null;
  const ids = visibleEvidenceIds([...item.evidenceIds, ...item.findings.flatMap((f) => f.evidenceIds ?? [])]);

  const evidence = (
    <>
      {priceTypes.includes(item.type) && report.priceLedger?.stages.length ? (
        <div className="table-wrap">
          <table className="rv-table">
            <thead><tr><th>화면</th><th>보이는 금액</th><th>확인 번호</th></tr></thead>
            <tbody>
              {report.priceLedger.stages.map((stage) => (
                <tr key={stage.stage} className={finding?.stage === stage.stage ? "is-hit" : undefined}>
                  <td>{stageLabels[stage.stage]}</td>
                  <td className="tnum">{stage.displayedLines.join(" · ") || "—"}</td>
                  <td className="mono">{visibleEvidenceIds([stage.evidence?.id])[0] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : finding && linesFor(finding)?.length ? (
        <ul className="rv-lines tnum">{linesFor(finding)!.map((line, index) => <li key={index}>{line}</li>)}</ul>
      ) : null}
      {finding ? <EvidenceShot scanId={report.scanId} stage={finding.stage} priceLines={linesFor(finding)} /> : null}
      {ids.length ? <p className="rv-ids">확인 번호 <span className="mono">{ids.join(", ")}</span></p> : null}
    </>
  );

  const how = (
    <Block title={item.kind === "clear" ? "점검한 범위" : "어떻게 확인했나요?"}>
      <p>{methodText(report)} 살펴본 것: {g.evidence}.</p>
    </Block>
  );

  return (
    <article className={`rv-detail rv-detail--${item.kind}`} aria-labelledby="rv-detail-title">
      <header className="rv-detail__head">
        <div className="rv-detail__meta">
          <VerdictBadge kind={item.kind} />
          <span className="tnum faint">{item.no}</span>
          {tag ? <span className="rv-chip">{tag}</span> : null}
        </div>
        <h2 id="rv-detail-title" className="rv-detail__title">{g.plain}</h2>
        <p className="rv-detail__lede">{item.kind === "risk" ? g.criteria : headline[item.kind]}</p>
      </header>

      {aiResult && aiHref ? (
        <section className="rv-ai rv-ai--diag" aria-label="AI 정밀 점검 결과">
          <div className="rv-ai__head">
            <span className="rv-ai__title">AI 정밀 점검 결과</span>
            <AiVerdictBadge verdict={aiResult.status === "FAILED" ? "FAILED" : aiResult.status === "INSUFFICIENT" ? "INSUFFICIENT" : aiResult.verdict!} />
          </div>
          <p style={{ fontSize: 13 }}>{aiResult.conclusion}</p>
          <Link href={`${aiHref}#ai-item-${item.type}`} className="auth-link">AI 상세 분석 보기</Link>
        </section>
      ) : null}

      {item.kind === "risk" ? (
        <>
          <Block title="무엇이 문제였나요?">
            {item.findings.length
              ? item.findings.map((f) => <p key={f.id}>{f.reason}</p>)
              : <p>{item.summary}</p>}
          </Block>
          <Block title="확인한 내용">{evidence}</Block>
          <Block title="어떻게 확인했나요?">
            <p>{methodText(report)} {g.limit}</p>
          </Block>
          <Block title="이렇게 고쳐 보세요">
            <Checklist id={item.type} items={[...g.fixes, "고친 뒤 같은 조건으로 다시 점검해서 결과를 비교하세요"]} />
          </Block>
        </>
      ) : null}

      {item.kind === "review" ? (
        <>
          <Block title="찾은 내용">
            <ul className="rv-bullets">
              {item.findings.map((f) => <li key={f.id}>{f.reason}</li>)}
              {item.candidates.map((candidate) => <li key={candidate.id}>화면 문구: “{candidate.text}”</li>)}
              {item.candidates.flatMap((candidate) => candidate.observedFacts ?? []).map((fact, index) => <li key={`fact-${index}`}>{fact}</li>)}
              {!item.findings.length && !item.candidates.length ? <li>{item.summary}</li> : null}
            </ul>
            {evidence}
          </Block>
          <Block title="바로미 1차 분석">
            <p>{item.note || g.criteria}</p>
          </Block>
          <Block title="아직 확실하지 않은 점">
            {item.candidates.some((candidate) => candidate.missingInformation?.length) ? (
              <ul className="rv-bullets">
                {item.candidates.flatMap((candidate) => candidate.missingInformation ?? []).map((text, index) => <li key={index}>{text}</li>)}
              </ul>
            ) : <p>{g.limit}</p>}
          </Block>
          <Block title="더 살펴봐야 하는 이유">
            {item.candidates.length
              ? item.candidates.map((candidate) => <p key={candidate.id}>{candidate.reason}</p>)
              : <p>문구의 뜻과 상황을 읽어야 알 수 있어서, 무료 점검에서는 ‘확인해 보세요’로 남겨요.</p>}
          </Block>

          {item.ai.length ? (
            <section className="rv-ai" aria-label="AI 정밀 점검 의견">
              <div className="rv-ai__head">
                <span className="rv-ai__title">AI 정밀 점검 의견</span>
                <span className="rv-chip rv-chip--brand">유료</span>
              </div>
              {item.ai.map((decision) => (
                <dl key={decision.candidateId} className="rv-ai__body">
                  {decision.candidate ? <><dt>살펴본 문구</dt><dd>“{decision.candidate.text}”</dd></> : null}
                  <dt>의견</dt><dd><b>{aiOpinionText[decision.label] ?? decision.label}</b></dd>
                  <dt>이유</dt><dd>{decision.rationale}</dd>
                </dl>
              ))}
              <p className="rv-ai__foot">결과: ‘확인해 보세요’ 그대로 · AI 의견은 무료 점검 결과를 바꾸지 않아요</p>
            </section>
          ) : aiBusy && item.candidates.length ? (
            <p role="status" className="rv-ai rv-ai--busy"><Spinner color="var(--brand)" />AI가 이 항목을 살펴보고 있어요. 기본 점검 결과는 그대로 볼 수 있어요.</p>
          ) : null}

          {item.candidates.length && !publicSample ? (
            <details className="rv-operator">
              <summary>직접 확인한 결과 남기기</summary>
              <p className="faint">확인한 결과를 남기면 다음 점검과 AI 평가에 참고해요.</p>
              <ReviewCandidates scanId={report.scanId} candidates={item.candidates} />
            </details>
          ) : null}
        </>
      ) : null}

      {item.kind === "clear" ? (
        <>
          {how}
          {ids.length || finding ? <Block title="확인한 내용">{evidence}</Block> : null}
          <Block title="왜 ‘괜찮아요’인가요?">
            <p>{item.note || "점검한 범위에서 기준에 해당하는 신호가 없었어요."}</p>
          </Block>
          <Block title="확인하지 못한 부분">
            <p>{g.limit}</p>
          </Block>
          <Block title="이런 표시는 무엇인가요?">
            <p>{g.what}</p>
          </Block>
        </>
      ) : null}

      {item.kind === "none" ? (
        <>
          <Block title="어떤 문제인가요?">
            <p>{g.what}</p>
          </Block>
          <Block title="왜 점검하지 못했나요?">
            <NotTestedReasons report={report} item={item} />
          </Block>
          <Block title="이런 경우를 주의하세요">
            <ul className="rv-bullets">{g.watch.map((text) => <li key={text}>{text}</li>)}</ul>
          </Block>
          <Block title="직접 확인해 보세요">
            <Checklist id={item.type} items={g.selfCheck} />
          </Block>
          <Block title="알아두세요">
            <p>이 글은 누구에게나 해당하는 예방 정보예요. 이 쇼핑몰에서 실제로 문제가 발견됐다는 뜻은 아니에요.</p>
          </Block>
          <NextStep report={report} item={item} onRescan={onRescan} rescanPending={rescanPending} publicSample={publicSample} />
        </>
      ) : null}

      <footer className="rv-detail__foot">
        {item.kind === "review" && canRequestAi ? (
          <Button variant="brand" icon="spark" onClick={onRequestAi}>AI 정밀 점검 받기</Button>
        ) : null}
        {finding ? <ButtonLink variant="secondary" href={`${reportHref}/${finding.id}`}>확인 화면 크게 보기</ButtonLink> : null}
        {item.kind === "risk" && report.comparison && report.comparison.status !== "UNAVAILABLE" ? (
          <ButtonLink variant="tertiary" href={`/report/${encodeURIComponent(report.comparison.baselineScanId)}`}>지난 점검과 비교</ButtonLink>
        ) : null}
      </footer>
    </article>
  );
}

function NotTestedReasons({ report, item }: { report: Report; item: ReportItem }) {
  const surface = ruleSurface[item.type];
  const phase = surface ? report.phaseResults?.[`surface:${surface}`] : undefined;
  const pages = report.siteCrawl?.uniqueVisitedUrlCount ?? report.siteCrawl?.visitedUrlCount;
  const extra: string[] = [];
  if (phase?.reason && phase.reason !== item.note) extra.push(phase.reason);
  if (surface && phase?.status === "NOT_FOUND" && pages) extra.push(`살펴본 페이지 ${pages}곳에서 관련 링크를 찾지 못했어요.`);
  if (report.explorationBlocker?.code === "LOGIN_REQUIRED" || report.collectionFailureCode === "AUTH_CHALLENGE") {
    extra.push("로그인해야 보이는 화면은 테스트 계정이 없어서 열어 보지 못했어요.");
  }
  if (report.executionMode !== "DYNAMIC") extra.push("공개 화면만 점검해서 장바구니·주문서는 열지 않았어요.");
  return (
    <>
      <p>{item.note || "이번 점검에서 판단에 필요한 화면에 도달하지 못했어요."}</p>
      {extra.length ? <ul className="rv-bullets">{extra.map((text) => <li key={text}>{text}</li>)}</ul> : null}
    </>
  );
}

/** §9.2 next step: depends on why the check could not run. */
function NextStep({ report, item, onRescan, rescanPending, publicSample }: { report: Report; item: ReportItem; onRescan: () => void; rescanPending: boolean; publicSample: boolean }) {
  const reason = `${item.note} ${report.explorationBlocker?.code ?? ""} ${report.collectionFailureCode ?? ""}`;
  let text = "같은 조건으로 다시 점검하면 이번에 닿지 못한 화면을 다시 확인해요.";
  let action: ReactNode = <Button variant="secondary" icon="refresh" onClick={onRescan} loading={rescanPending} loadingText="요청 중">{publicSample ? "내 쇼핑몰 점검하기" : "다시 점검하기"}</Button>;
  if (/로그인|계정|인증|LOGIN|AUTH/.test(reason)) {
    text = "로그인해야 보이는 화면이라면 테스트 계정을 넣고 다시 점검하면 확인할 수 있어요.";
    action = <ButtonLink variant="secondary" href="/scan/new">테스트 계정으로 다시 점검</ButtonLink>;
  } else if (/차단|막|접근|FETCH_FAILED/.test(reason)) {
    text = "접속이 막혔다면 쇼핑몰 주소와 소유 확인 상태를 먼저 확인해 주세요.";
    action = <ButtonLink variant="secondary" href={publicSample ? "/scan/new" : `/shop/${encodeURIComponent(report.shopId)}`}>내 쇼핑몰 확인</ButtonLink>;
  } else if (report.executionMode !== "DYNAMIC") {
    text = "전체 구매 흐름 점검을 하면 장바구니와 주문서까지 확인할 수 있어요.";
    action = <ButtonLink variant="secondary" href="/scan/new">전체 구매 흐름 점검 시작</ButtonLink>;
  }
  return (
    <section className="rv-next">
      <Icon name="info" size={18} color="var(--untested-ink)" />
      <p>{text}</p>
      {action}
    </section>
  );
}
