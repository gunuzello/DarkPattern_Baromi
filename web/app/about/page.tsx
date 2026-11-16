import type { Metadata } from "next";
import { DocBlock, SitePage } from "@/components/site/SiteChrome";
import { Faq } from "@/components/site/Faq";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "서비스 소개", description: "쇼핑몰 운영자가 구매·가입·취소 과정의 다크패턴 위험 신호를 증거와 함께 점검하는 B2B 점검 서비스입니다." };

const outputs = [
  ["검사한 범위", "구매 단계 3개와 별도 탐색 영역 7개의 실제 상태와 소요 시간"],
  ["발견한 위험 신호", "16가지 유형별 위험 신호와 근거가 되는 화면·가격 기록"],
  ["검토 필요 항목", "문구나 맥락을 사람이 더 봐야 하는 후보와 그 이유"],
  ["미검사 사유", "도달하지 못했거나 차단된 범위와 구체적인 이유"],
  ["수정 방향", "유형별 가이드라인 근거와 고치는 방법"],
] as const;

const faqs = [
  { q: "법률 위반 여부를 판정해 주나요?", a: "아니요. 바로미의 결과는 가이드라인 기준으로 관찰한 위험 신호예요. 위반을 확정하거나 적법함을 보증하지 않아요. ‘괜찮아요(안전)’도 검사한 범위에서 신호를 보지 못했다는 뜻일 뿐이에요." },
  { q: "실제로 결제가 되거나 주문이 들어가나요?", a: "아니요. 주문서에서 결제 버튼 직전에 멈춰요. 결제 승인, 주문 확정, 계정 설정 변경, 최종 해지·탈퇴는 실행하지 않아요." },
  { q: "어떤 쇼핑몰을 점검할 수 있나요?", a: "HTTPS 쇼핑몰이면 무료 계정으로 로그인한 뒤 주소만 넣어 공개 화면 점검을 시작할 수 있어요. 장바구니·주문서까지 여는 전체 구매 흐름 점검은 메타 태그·파일·DNS 중 하나로 소유를 확인했거나, 운영자가 만든 전용 테스트 계정을 넣었을 때만 해요. 카페24 자사몰을 먼저 검증하고 있어요." },
  { q: "테스트 계정 비밀번호는 어떻게 다루나요?", a: "동적 점검 요청에만 쓰고 서버에서 암호화해요. 점검 기록, 보고서, 로그에 평문으로 남기지 않아요. 운영자가 만든 전용 테스트 계정을 써 주세요." },
  { q: "AI가 사이트를 직접 돌아다니나요?", a: "아니요. 기본 보고서는 AI 없이 규칙과 증거만으로 만들어요. AI 정밀 분석은 보고서가 나온 뒤 직접 요청할 때만, 정리된 최소 증거로 별도 의견을 내는 후속 기능이에요." },
];

export default function AboutPage() {
  return (
    <SitePage
      title={<>구매 흐름의 위험 신호를<br />증거와 함께 점검해요</>}
      lede="바로미는 쇼핑몰의 공개 화면과 권한을 확인한 테스트 계정으로 구매 흐름을 안전하게 따라가며, 가격·선택 상태·문구·화면 구조를 측정해 다크패턴 위험 신호와 재현 가능한 근거, 수정 방향을 정리해요."
    >
      <DocBlock title="누구를 위한 서비스인가">
        <p className="muted">국내 소상공인과 온라인 쇼핑몰 운영자를 위해 만들었어요. 상세 페이지, 장바구니, 주문서를 고칠 때마다 비용·옵션·가입 조건과 취소 경로를 손으로 다시 확인하기 어려운 팀에게 맞아요.</p>
        <p className="faint" style={{ fontSize: 14 }}>카페24 자사몰을 먼저 검증하고 있지만, 특정 플랫폼에만 맞춘 규칙은 만들지 않아요.</p>
      </DocBlock>
      <DocBlock title="어떤 문제를 푸는가">
        <ul className="checklist" style={{ color: "var(--ink)" }}>
          <li><Icon name="check" size={16} color="var(--link)" />상품 상세에 없던 비용이 주문서에서 처음 나타나는지</li>
          <li><Icon name="check" size={16} color="var(--link)" />유료 옵션이 사용자가 고르기 전부터 선택돼 있는지</li>
          <li><Icon name="check" size={16} color="var(--link)" />요청하지 않은 상품이 장바구니에 들어가는지</li>
          <li><Icon name="check" size={16} color="var(--link)" />구독·해지 경로를 찾기 어렵게 만들었는지</li>
        </ul>
        <p className="muted">확인하지 못한 항목은 정상으로 표시하지 않고, 무엇을 왜 확인하지 못했는지 함께 알려드려요.</p>
      </DocBlock>
      <DocBlock title="보고서에 담기는 것">
        <dl className="doc-dl">
          {outputs.map(([term, desc]) => (<div key={term}><dt>{term}</dt><dd>{desc}</dd></div>))}
        </dl>
        <p className="faint" style={{ fontSize: 14 }}>화면에서 본 보고서와 같은 내용을 JSON으로 내려받을 수 있어요.</p>
      </DocBlock>
      <DocBlock title="자주 묻는 질문">
        <Faq items={faqs} />
      </DocBlock>
    </SitePage>
  );
}
