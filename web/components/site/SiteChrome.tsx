"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { AccountControls } from "@/components/auth/AccountControls";

/** Information architecture taken from feature/redesign; visuals follow the "Ledger" system. */
export const siteNav = [
  { href: "/about", label: "서비스 소개" },
  { href: "/method", label: "분석 방법" },
  { href: "/criteria", label: "탐지 기준" },
  { href: "/principles", label: "안전 원칙" },
] as const;

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  return (
    <header className="lp-header">
      <div className="lp-wrap lp-header__inner">
        <Link href="/" aria-label="바로미 홈">
          <Logo size={30} />
        </Link>
        <nav aria-label="주요 메뉴">
          {siteNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="btn btn--tertiary btn--md"
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="lp-header__cta">
          <span className="site-hide-sm"><AccountControls /></span>
          <ButtonLink href="/report/sample" variant="secondary" className="site-hide-sm">예시 결과</ButtonLink>
          <ButtonLink href="/scan/new" variant="brand">무료로 점검하기</ButtonLink>
          <button
            type="button"
            className="btn btn--tertiary btn--md site-menu-btn"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label="메뉴"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-menu" aria-label="모바일 메뉴" className="site-menu">
          {[...siteNav, { href: "/report/sample", label: "예시 결과" }, { href: "/shops", label: "내 쇼핑몰" }].map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>
          ))}
          <AccountControls compact />
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="lp-wrap lp-footer">
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
        <Logo size={36} />
        <p className="faint" style={{ fontSize: 13 }}>
          결과는 공정위 가이드라인 기준의 위험 신호예요. 법률 위반을 판단하거나 적법함을 보증하지 않아요.
          결제와 주문 확정은 실행하지 않아요. © 2026 바로미
        </p>
      </div>
      <nav aria-label="하단 메뉴" className="site-footer-nav">
        {siteNav.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        <Link href="/shops">내 쇼핑몰</Link>
        <Link href="/scan/new">점검 시작</Link>
        <a href="mailto:hello@baromi.app">문의하기</a>
      </nav>
    </footer>
  );
}

/** Marketing sub-page: top header, editorial head, content, closing band, footer. */
export function SitePage({ eyebrow, title, lede, children }: { eyebrow?: string; title: ReactNode; lede: string; children: ReactNode }) {
  return (
    <div className="lp">
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      <SiteHeader />
      <main id="main">
        <section className="doc-head">
          <div className="lp-wrap">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1 className="t-display" style={{ fontSize: "clamp(36px, 4.4vw, 52px)" }}>{title}</h1>
            <p className="doc-head__lede">{lede}</p>
          </div>
        </section>
        <div className="lp-wrap doc-body">{children}</div>
        <section className="lp-closing">
          <div className="lp-wrap lp-closing__inner" style={{ paddingBlock: 88 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ fontSize: "clamp(32px, 4vw, 44px)", lineHeight: 1.1, letterSpacing: "-0.035em", fontWeight: 800 }}>배포하기 전에<br />한 번 먼저 점검하세요.</h2>
              <p>주소만 넣으면 공개 화면 점검부터 바로 시작할 수 있어요.</p>
            </div>
            <ButtonLink href="/scan/new" variant="brand" size="lg">무료로 점검하기</ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/** One editorial block: heading on the left, body on the right, 1px rule between blocks. */
export function DocBlock({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <section className="doc-block">
      <div className="doc-block__head">
        {kicker ? <span className="doc-block__kicker tnum">{kicker}</span> : null}
        <h2 className="t-title">{title}</h2>
      </div>
      <div className="doc-block__body">{children}</div>
    </section>
  );
}
