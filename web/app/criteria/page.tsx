import type { Metadata } from "next";
import { DocBlock, SitePage } from "@/components/site/SiteChrome";
import { ResultBadge } from "@/components/ui/Status";
import { rules } from "@/lib/labels";
import { guide } from "@/lib/guide";

export const metadata: Metadata = { title: "탐지 기준", description: "바로미가 매번 점검하는 16가지 다크패턴 유형과 각 유형의 증거 방향, 현재 한계입니다." };

export default function CriteriaPage() {
  return (
    <SitePage
      title={<>매번 같은 16가지를<br />같은 기준으로 봐요</>}
      lede="모든 보고서에 16가지 유형이 빠짐없이 들어가요. 유형이 들어 있다고 모든 쇼핑몰에서 자동 판정이 가능하다는 뜻은 아니에요. 필요한 증거가 없으면 이유와 함께 미검사로 표시해요."
    >
      <DocBlock title="점검 유형">
        <div className="table-wrap panel">
          <table className="table criteria-table">
            <thead><tr><th style={{ width: 44 }}>#</th><th>유형</th><th>증거 방향</th><th>현재 한계</th></tr></thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.type}>
                  <td className="tnum faint">{String(index + 1).padStart(2, "0")}</td>
                  <td>
                    <span style={{ display: "block", fontWeight: 700 }}>{guide[rule.type].plain}</span>
                    <span className="faint" style={{ fontSize: 13 }}>{rule.title}</span>
                  </td>
                  <td>{guide[rule.type].evidence}</td>
                  <td className="muted">{guide[rule.type].limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocBlock>
      <DocBlock title="판정의 4가지 상태">
        <dl className="doc-dl">
          <div><dt><ResultBadge kind="risk" large /></dt><dd>확인된 사실 증거가 규칙 조건을 충족해 위험 신호가 있어요. 법률 위반 확정은 아니에요.</dd></div>
          <div><dt><ResultBadge kind="review" large /></dt><dd>자동 증거만으로 의미 해석이 끝나지 않아 사람이 더 봐야 해요.</dd></div>
          <div><dt><ResultBadge kind="clear" large /></dt><dd>필요한 범위를 실제로 봤지만 신호를 관찰하지 못했어요. 적법함을 보증하지 않아요.</dd></div>
          <div><dt><ResultBadge kind="none" large /></dt><dd>범위에 도달하지 못했거나 차단됐거나 자료가 부족해요. 구체적인 이유를 함께 보여드려요.</dd></div>
        </dl>
      </DocBlock>
      <DocBlock title="참고한 기준">
        <p className="muted">전자상거래법 제21조의2, 공정거래위원회 온라인 다크패턴 자율관리 가이드라인과 온라인 인터페이스 운영 가이드라인을 참고해요. 기준 링크는 정보 제공용이며 법률 자문을 대신하지 않아요.</p>
      </DocBlock>
    </SitePage>
  );
}
