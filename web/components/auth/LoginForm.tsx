"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (!configured) return;
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
  }, [configured, next, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const supabase = supabaseBrowser();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace(next);
        router.refresh();
      } else {
        const confirmationUrl = new URL("/login", window.location.origin);
        confirmationUrl.searchParams.set("next", next);
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: confirmationUrl.toString() },
        });
        if (authError) throw authError;
        if (!data.session) setMessage("가입 확인 메일을 보냈어요. 메일의 확인 링크를 눌러 인증을 완료해 주세요.");
        else { router.replace(next); router.refresh(); }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "인증 요청을 처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {!configured ? (
        <Alert kind="brand" title="로그인을 준비하고 있어요">
          지금은 로그인 없이도 진단을 시작하고, 이 브라우저에서 내 쇼핑몰과 보고서를 볼 수 있어요.
          {process.env.NODE_ENV !== "production" ? " (개발 안내: NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.)" : ""}
        </Alert>
      ) : null}
      <label className="field">
        <span className="field__label">이메일</span>
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="field">
        <span className="field__label">비밀번호</span>
        <input className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <Button type="submit" block disabled={!configured || busy} loading={busy} loadingText="처리 중">
        {mode === "login" ? "로그인" : "계정 만들기"}
      </Button>
      <Button type="button" variant="secondary" block disabled={busy || !configured} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); setError(""); }}>
        {mode === "login" ? "계정 만들기" : "이미 계정이 있어요. 로그인"}
      </Button>
      {error ? <Alert kind="error" title="인증에 실패했어요">{error}</Alert> : null}
      {message ? <Alert kind="brand" title="가입 요청을 접수했어요">{message}</Alert> : null}
      <p className="faint" style={{ fontSize: 13 }}>비밀번호는 인증 서비스에서만 처리하고 바로미 진단 기록에는 저장하지 않아요.</p>
    </form>
  );
}
