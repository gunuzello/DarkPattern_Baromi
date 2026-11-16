"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { authConfigured } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";

function initialOf(user: User) {
  return (user.email ?? "?").trim().charAt(0).toUpperCase();
}

/**
 * Account entry point. Header: "로그인" or an avatar button with a small menu.
 * Sidebar (compact): an account block with email and log out.
 */
export function AccountControls({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(!authConfigured);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authConfigured) return;
    const supabase = supabaseBrowser();
    void supabase.auth.getUser().then((result: { data: { user: User | null } }) => { setUser(result.data.user); setChecked(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => { setUser(session?.user ?? null); setChecked(true); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    setUser(null);
    setOpen(false);
    router.replace("/");
    router.refresh();
  }

  // Avoid flashing "로그인" for a signed-in visitor while the session loads.
  if (!checked) return <span className={compact ? "account-block account-block--loading" : "account-skeleton"} aria-hidden />;

  if (!user) {
    if (pathname.startsWith("/login")) return null;
    const href = `/login${pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""}`;
    return compact
      ? <Link href={href} className="nav-link"><Icon name="lock" />로그인</Link>
      : <Link href={href} className="btn btn--tertiary btn--md">로그인</Link>;
  }

  if (compact) {
    return (
      <div className="account-block">
        <span className="account-avatar" aria-hidden>{initialOf(user)}</span>
        <span className="account-block__text">
          <span className="account-block__label">로그인됨</span>
          <span className="account-block__email" title={user.email ?? undefined}>{user.email}</span>
        </span>
        <button type="button" className="btn btn--tertiary btn--sm" onClick={signOut}>로그아웃</button>
      </div>
    );
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`계정 메뉴 (${user.email ?? "로그인됨"})`}
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden>{initialOf(user)}</span>
        <Icon name="down" size={14} className={open ? "rv-flip" : undefined} />
      </button>
      {open ? (
        <div id="account-menu" role="menu" className="account-menu__panel">
          <div className="account-menu__who">
            <span className="account-menu__label">로그인한 계정</span>
            <span className="account-menu__email">{user.email}</span>
          </div>
          <Link role="menuitem" href="/shops" className="account-menu__item"><Icon name="shop" size={16} />내 쇼핑몰</Link>
          <Link role="menuitem" href="/scan/new" className="account-menu__item"><Icon name="plus" size={16} />새 점검</Link>
          <button role="menuitem" type="button" className="account-menu__item account-menu__item--out" onClick={signOut}><Icon name="x" size={16} />로그아웃</button>
        </div>
      ) : null}
    </div>
  );
}
