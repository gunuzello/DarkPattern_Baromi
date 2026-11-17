import type { Metadata } from "next";
import { DocBlock, SitePage } from "@/components/site/SiteChrome";
import { surfaceLabels } from "@/lib/labels";
import { surfaceKinds } from "@/lib/types";

export const metadata: Metadata = { title: "분석 방법", description: "등록과 소유 확인, 구매 흐름 탐색, 증거와 가격 원장 수집, 규칙 판정까지 바로미가 점검하는 순서입니다." };

export default function MethodPage() {
  return (
    <SitePage
      title={<>측정할 수 있는 사실은<br />코드로 모아요</>}
      lede="체크박스 선택, 금액 변화, 화면 요소 위치, 단계별 페이지, 가격 응답을 직접 기록하고 규칙으로 판정해요. 의미 해석이 모호한 소수 후보만 사람이나 별도 AI 검토로 넘겨요."
    >
      <DocBlock kicker="01" title="등록과 안전 확인">
        <p className="muted">HTTPS 쇼핑몰 주소와 검사 권한 동의를 받아요. 장바구니와 주문서를 여는 전체 구매 흐름 점검은 메타 태그, 파일, DNS TXT 중 하나로 소유를 확인했거나, 운영자가 만든 전용 테스트 계정을 넣었을 때만 시작해요.</p>
        <p className="muted">모든 리다이렉트와 요청의 주소를 검사해 내부망·사설 주소 접근을 막아요. 확인 토큰은 소유 확인용일 뿐, 공개되지 않은 화면을 강제로 열거나 인증을 우회하는 데 쓰지 않아요.</p>
      </DocBlock>
      <DocBlock kicker="02" title="구매 흐름 탐색">
        <ol className="doc-steps">
          <li><b>상품 찾기</b><span>목록·카테고리·구조화 데이터에서 상품 후보를 고르고 한 개를 열어요.</span></li>
          <li><b>상품 상세</b><span>가격, 유료 옵션의 초기 선택, 필수 옵션, 중요 조건을 기록해요.</span></li>
          <li><b>장바구니 또는 바로구매</b><span>선택한 경로로 진행하고, 요청한 상품만 담겼는지와 총액 변화를 확인해요.</span></li>
          <li><b>주문서</b><span>필수 비용과 선택 상태, 결제 전 가격을 기록하고 결제 버튼 직전에서 멈춰요.</span></li>
        </ol>
        <p className="faint" style={{ fontSize: 14 }}>버튼이 여러 개라 어떤 것인지 모호하거나 찾지 못하면 임의로 누르지 않고 ‘경로 미발견’이나 ‘차단’ 사유를 남겨요. 실패를 완료로 바꾸지 않아요.</p>
      </DocBlock>
      <DocBlock kicker="03" title="별도 탐색 영역 7곳">
        <p className="muted">구매 단계와 분리해서 아래 영역의 링크와 버튼을 읽기 전용으로 찾아요. 이름이 보인다고 검사한 것으로 치지 않아요. 실제 화면을 확인하지 못했으면 ‘후보만 발견’, ‘경로 미발견’, ‘접근 차단’ 중 사실에 맞는 상태로 남겨요.</p>
        <ul className="chip-list">
          {surfaceKinds.map((kind) => <li key={kind}>{surfaceLabels[kind]}</li>)}
        </ul>
      </DocBlock>
      <DocBlock kicker="04" title="증거 수집과 가격 원장">
        <p className="muted">단계마다 스크린샷, 선택지와 위치, 표시 가격 줄을 남겨요. 비밀번호·이메일·전화번호 같은 입력란은 가려요. 같은 단계의 가격 응답과 화면 금액을 대조해 ‘화면만 확인’, ‘일치’, ‘일부 일치’, ‘불일치’로 기록해요.</p>
        <p className="faint" style={{ fontSize: 14 }}>가격 원장은 출처별 관찰 기록이에요. 실제 결제 금액의 정답으로 보지 않아요.</p>
      </DocBlock>
      <DocBlock kicker="05" title="판정과 보고서">
        <dl className="doc-dl">
          <div><dt>위험 · 고쳐야 해요</dt><dd>확인된 사실 증거가 규칙 조건을 충족했어요.</dd></div>
          <div><dt>검토 필요 · 확인해 보세요</dt><dd>문구·관계·맥락을 사람이 더 봐야 해요.</dd></div>
          <div><dt>미관찰 · 괜찮아요</dt><dd>필요한 범위를 살펴봤지만 신호를 관찰하지 못했어요. 법적으로 문제없다는 보증은 아니에요.</dd></div>
          <div><dt>미검사 · 점검 못 했어요</dt><dd>범위에 도달하지 못했거나 차단돼 판단할 수 없어요. 이유를 함께 보여드려요.</dd></div>
        </dl>
      </DocBlock>
      <DocBlock title="검증 현황 공개">
        <p className="muted">지금은 로컬에서 점검 시작부터 16가지 유형 보고서 열람·다운로드까지 한 번에 경험하는 것을 목표로 검증하고 있어요. 승인된 쇼핑몰 반복 실행, 여러 쇼핑몰 호환성, 소형 쇼핑몰 30초 목표가 입증되기 전에는 완성이라고 표시하지 않아요.</p>
      </DocBlock>
    </SitePage>
  );
}
