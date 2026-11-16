import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { comparisonTag } from "@/lib/checks";
import { ruleByType, stageLabels } from "@/lib/labels";
import type { Finding, Report } from "@/lib/types";
import { EvidenceShot } from "./EvidenceShot";

/** Document rows from the redesign: text and fix on the left, the stage screenshot on the right. */
export function FindingRows({ report, findings, tone, linesFor }: {
  report: Report; findings: Finding[]; tone: "risk" | "review"; linesFor: (finding: Finding) => string[] | undefined;
}) {
  return (
    <ol className={`rpt-findings rpt-findings--${tone}`}>
      {findings.map((finding) => {
        const rule = ruleByType[finding.type];
        const tag = comparisonTag(report, finding);
        return (
          <li key={finding.id} className="rpt-finding">
            <div className="rpt-finding__text">
              <span className="rpt-finding__tag">
                {stageLabels[finding.stage]}에서 관찰
                {tag ? <span className="rpt-chip">{tag === "재발견" ? "지난 진단에도 있었어요" : "이번에 새로 발견"}</span> : null}
              </span>
              <h3 className="rpt-finding__title">{rule.name}</h3>
              <p className="rpt-finding__body">{finding.reason}</p>
              <div className="rpt-finding__meta">
                <span>기준 <a href={rule.source} target="_blank" rel="noreferrer">{rule.reference}</a></span>
                {finding.ruleVersion ? <span>규칙 v{finding.ruleVersion}</span> : null}
                {finding.evidenceIds?.length ? <span className="mono">{finding.evidenceIds.join(", ")}</span> : null}
              </div>
              <div className="rpt-guide">
                <b>{tone === "risk" ? "권장 조치" : "이렇게 확인해 주세요"}</b>
                {rule.recommendation}
              </div>
              <div>
                <Link href={`/report/${encodeURIComponent(report.scanId)}/${finding.id}`} className="btn btn--secondary btn--sm">
                  증거 전체 보기<Icon name="chevron" size={14} />
                </Link>
              </div>
            </div>
            <figure className="rpt-evidence">
              <figcaption className="rpt-evidence__bar">
                <span>{stageLabels[finding.stage]} 화면 증거</span>
                <span className="mono">{finding.evidenceIds?.[0] ?? `page:${finding.stage}`}</span>
              </figcaption>
              <div className="rpt-evidence__body">
                <EvidenceShot scanId={report.scanId} stage={finding.stage} priceLines={linesFor(finding)} />
              </div>
            </figure>
          </li>
        );
      })}
    </ol>
  );
}
