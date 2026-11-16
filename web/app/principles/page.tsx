import type { Metadata } from "next";
import { DocBlock, SitePage } from "@/components/site/SiteChrome";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "안전 원칙", description: "바로미가 진단 중에 하지 않는 것과 개인정보를 다루는 방식입니다." };

const never: { icon: IconName; title: string; body: string }[] = [
  { icon: "x", title: "결제와 주문 확정", body: "주문서의 결제 버튼 직전에서 멈춰요. 결제 승인, 주문 확정은 실행하지 않아요." },
  { icon: "lock", title: "인증·봇 방어 우회", body: "CAPTCHA, OTP, 로그인 차단을 우회하지 않아요. 멈춘 위치와 이유를 남겨요." },
  { icon: "shop", title: "계정 변경과 최종 해지", body: "계정 설정 변경, 최종 해지·탈퇴·환불 확정은 누르지 않아요." },
  { icon: "eye", title: "권한 없는 탐색", body: "소유를 확인하고 동의한 쇼핑몰에서만 구매 흐름을 열어요. 내부망·사설 주소는 차단해요." },
];

export default function PrinciplesPage() {
  return (
    <SitePage
      title={<>안전한 경계 안에서만<br />탐색해요</>}
      lede="바로미는 쇼핑몰 운영자가 허락한 범위에서, 실제 구매자에게 영향을 주지 않는 방식으로만 화면을 확인해요. 할 수 없는 것을 먼저 정해 두고 진단해요."
    >
      <DocBlock title="바로미가 하지 않는 것">
        <ul className="grid-2 never-list">
          {never.map((item) => (
            <li key={item.title}>
              <Icon name={item.icon} size={22} color="var(--ink)" />
              <span style={{ fontSize: 17, fontWeight: 700 }}>{item.title}</span>
              <span className="muted" style={{ fontSize: 15 }}>{item.body}</span>
            </li>
          ))}
        </ul>
      </DocBlock>
      <DocBlock title="테스트 계정과 개인정보">
        <ul className="checklist" style={{ color: "var(--ink)" }}>
          <li><Icon name="check" size={16} color="var(--link)" />테스트 계정은 동적 진단 요청에만 쓰고 서버에서 암호화해요.</li>
          <li><Icon name="check" size={16} color="var(--link)" />비밀번호, 세션 쿠키, 개인정보는 보고서·로그·샘플 데이터에 남기지 않아요.</li>
          <li><Icon name="check" size={16} color="var(--link)" />스크린샷의 비밀번호·이메일·전화·주소 입력란은 가려요.</li>
          <li><Icon name="check" size={16} color="var(--link)" />AI 검토에는 계정 정보나 무관한 HTML을 보내지 않고 정리된 후보만 보내요.</li>
        </ul>
        <p className="faint" style={{ fontSize: 14 }}>입력란 마스킹은 화면에 평문으로 나온 개인정보까지 완벽히 지운다고 보장하지 않아요. 운영자가 만든 전용 테스트 계정을 써 주세요.</p>
      </DocBlock>
      <DocBlock title="결과를 과장하지 않기">
        <p className="muted">확인하지 못한 항목을 정상으로 표시하지 않아요. 타임아웃은 멈춤을 막는 안전장치일 뿐이고, 실제 실행 시간과 단계별 시간은 보고서에 그대로 남겨요. 진단 결과는 법률 판단이 아니에요.</p>
      </DocBlock>
      <DocBlock title="세션과 삭제">
        <p className="muted">쇼핑몰과 진단 기록은 이 브라우저의 HttpOnly 세션에 묶여요. 끝난 진단과 증거, 진행 중인 진단이 없는 쇼핑몰은 언제든 삭제할 수 있어요.</p>
      </DocBlock>
    </SitePage>
  );
}
