"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { authConfigured, authErrorMessage, withNext } from "@/lib/auth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "./PasswordField";

const RESEND_SECONDS = 60;

/** Email + password login and sign-up. Sign-up ends on a "check your mail" step with resend. */
export function LoginForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  // An existing session (or the confirmation link landing here) goes straight to the destination.
  useEffect(() => {
    if (!authConfigured) return;
    const supabase = supabaseBrowser();
    let active = true;
    const goNext = () => {
      if (!active) return;
      router.replace(next);
      router.refresh();
    };
    void supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      if (result.data.session) goNext();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (event === "SIGNED_IN" && session) goNext();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [next, router]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => { setError(""); }, [mode]);

  const confirmationUrl = () => {
    const url = new URL("/login", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = supabaseBrowser();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace(next);
        router.refresh();
        return;
      }
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: confirmationUrl() },
      });
      if (authError) throw authError;
      // With email confirmation on, an existing address comes back as a user with no identities.
      if (data.user && data.user.identities?.length === 0) throw { code: "user_already_exists" };
      if (data.session) { router.replace(next); router.refresh(); return; }
      setSentTo(email.trim());
      setCooldown(RESEND_SECONDS);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabaseBrowser().auth.resend({ type: "signup", email: sentTo, options: { emailRedirectTo: confirmationUrl() } });
      if (authError) throw authError;
      setResent(true);
      setCooldown(RESEND_SECONDS);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="auth-sent" role="status">
        <span className="auth-sent__icon" aria-hidden><Icon name="check" size={22} /></span>
        <h2 className="auth-sent__title">메일함을 확인해 주세요</h2>
        <p><b>{sentTo}</b>로 확인 메일을 보냈어요. 메일의 확인 링크를 누르면 가입이 끝나고 바로 이어서 시작할 수 있어요.</p>
        <ul className="auth-sent__tips">
          <li>메일이 안 보이면 스팸함이나 프로모션함도 확인해 주세요.</li>
          <li>링크는 이 브라우저에서 여는 것이 가장 확실해요.</li>
        </ul>
        {resent ? <p className="field__help field__help--ok"><Icon name="check" size={14} />확인 메일을 다시 보냈어요.</p> : null}
        {error ? <Alert kind="error" title={error} /> : null}
        <Button variant="secondary" block onClick={resend} disabled={cooldown > 0} loading={busy} loadingText="보내는 중">
          {cooldown > 0 ? `${cooldown}초 뒤에 다시 보낼 수 있어요` : "확인 메일 다시 보내기"}
        </Button>
        <button type="button" className="auth-link" onClick={() => { setSentTo(""); setResent(false); setPassword(""); }}>다른 이메일로 가입하기</button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate={false}>
      {!authConfigured ? (
        <Alert kind="brand" title="로그인을 준비하고 있어요">
          지금은 예시 결과로 바로미를 둘러볼 수 있어요.
          {process.env.NODE_ENV !== "production" ? " (개발 안내: NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.)" : ""}
        </Alert>
      ) : null}

      <div className="field">
        <label htmlFor="auth-email" className="field__label">이메일</label>
        <input
          id="auth-email"
          className="input input--lg"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <PasswordField
        value={password}
        onChange={setPassword}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        hint={mode === "signup" ? "8자 이상, 영문·숫자·기호를 섞으면 더 안전해요." : undefined}
        invalid={mode === "login" && error === authErrorMessage({ code: "invalid_credentials" })}
        aside={mode === "login" ? <Link href={withNext("/login/reset", next)} className="auth-link">비밀번호를 잊었어요</Link> : null}
      />

      {error ? <Alert kind="error" title={error} /> : null}

      <Button type="submit" size="lg" block disabled={!authConfigured} loading={busy} loadingText={mode === "login" ? "로그인하는 중" : "계정을 만드는 중"}>
        {mode === "login" ? "로그인" : "계정 만들기"}
      </Button>

      {mode === "signup" ? (
        <p className="auth-fineprint">비밀번호는 인증 서비스에서만 처리하고 바로미 점검 기록에는 남기지 않아요. 점검 기록을 다루는 방식은 <Link href="/principles">안전 원칙</Link>에서 볼 수 있어요.</p>
      ) : null}
    </form>
  );
}
