import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";

const benefits = [
  "내 쇼핑몰과 점검 결과를 어디서든 다시 열어요",
  "고친 뒤 같은 조건으로 다시 점검해 지난 결과와 비교해요",
  "점검 결과는 로그인한 본인만 볼 수 있어요",
];

/**
 * Account pages (login, sign-up, password reset): a quiet top bar and one card.
 * On wide screens the card has a navy side that says what an account is for.
 */
export function AuthShell({ title, lede, reason, children, foot }: {
  title: string;
  lede?: string;
  /** Why the visitor was sent here (the protected page they tried to open). */
  reason?: string | null;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className="auth">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <header className="auth__bar">
        <Link href="/" aria-label="바로미 홈"><Logo size={28} /></Link>
        <Link href="/report/sample" className="btn btn--tertiary btn--md">예시 결과 보기</Link>
      </header>
      <main id="main" className="auth__main">
        <div className="auth-card">
          <aside className="auth-card__side" aria-label="바로미 계정 안내">
            <span className="auth-card__kicker">바로미 계정</span>
            <p className="auth-card__pitch">점검 기록을<br />한곳에 모아 두세요</p>
            <ul className="auth-card__benefits">
              {benefits.map((text) => (
                <li key={text}><Icon name="check" size={16} />{text}</li>
              ))}
            </ul>
            <p className="auth-card__note">바로미는 결제와 주문 확정을 누르지 않고, 인증 단계를 우회하지 않아요.</p>
          </aside>
          <section className="auth-card__body" aria-labelledby="auth-title">
            {reason ? (
              <p className="auth-reason" role="status"><Icon name="lock" size={16} />{reason}</p>
            ) : null}
            <div className="auth-card__head">
              <h1 id="auth-title" className="auth-card__title">{title}</h1>
              {lede ? <p className="auth-card__lede">{lede}</p> : null}
            </div>
            {children}
            {foot ? <div className="auth-card__foot">{foot}</div> : null}
          </section>
        </div>
      </main>
    </div>
  );
}
