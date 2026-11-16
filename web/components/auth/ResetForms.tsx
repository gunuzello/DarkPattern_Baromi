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

/** Step 1: send a reset link. The answer is the same whether or not the address has an account. */
export function ResetRequestForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const redirectTo = new URL(withNext("/login/update-password", next), window.location.origin).toString();
      const { error: authError } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (authError) throw authError;
      setSentTo(email.trim());
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
        <p><b>{sentTo}</b>로 가입한 계정이 있다면 비밀번호를 다시 정하는 링크를 보냈어요. 링크는 이 브라우저에서 열어 주세요.</p>
        <ul className="auth-sent__tips">
          <li>메일이 안 보이면 스팸함이나 프로모션함도 확인해 주세요.</li>
          <li>몇 분이 지나도 오지 않으면 주소를 확인하고 다시 요청해 주세요.</li>
        </ul>
        <button type="button" className="auth-link" onClick={() => setSentTo("")}>다른 이메일로 다시 요청하기</button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="reset-email" className="field__label">가입한 이메일</label>
        <input id="reset-email" className="input input--lg" type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      {error ? <Alert kind="error" title={error} /> : null}
      <Button type="submit" size="lg" block disabled={!authConfigured} loading={busy} loadingText="보내는 중">재설정 링크 받기</Button>
    </form>
  );
}

/** Step 2: the link from the mail opens this page with a recovery session; set the new password. */
export function UpdatePasswordForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">(authConfigured ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authConfigured) return;
    const supabase = supabaseBrowser();
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) setState("ready");
    });
    void supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      if (!active) return;
      if (result.data.session) setState("ready");
      // Give the client a moment to exchange the code in the link before calling it expired.
      else window.setTimeout(() => { if (active) setState((current) => (current === "checking" ? "invalid" : current)); }, 2500);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) { setError("두 비밀번호가 서로 달라요."); return; }
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabaseBrowser().auth.updateUser({ password });
      if (authError) throw authError;
      setState("done");
      window.setTimeout(() => { router.replace(next); router.refresh(); }, 1200);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") return <p role="status" className="muted">링크를 확인하고 있어요.</p>;
  if (state === "invalid") {
    return (
      <div className="auth-form">
        <Alert kind="warn" title="링크가 만료됐거나 이미 사용됐어요">비밀번호 재설정 링크는 한 번만 쓸 수 있고, 받은 뒤 시간이 지나면 만료돼요. 새 링크를 받아 주세요.</Alert>
        <Link href={withNext("/login/reset", next)} className="btn btn--primary btn--lg btn--block">재설정 링크 다시 받기</Link>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="auth-sent" role="status">
        <span className="auth-sent__icon" aria-hidden><Icon name="check" size={22} /></span>
        <h2 className="auth-sent__title">비밀번호를 바꿨어요</h2>
        <p>잠시 뒤 이어서 이동해요.</p>
      </div>
    );
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <PasswordField label="새 비밀번호" value={password} onChange={setPassword} autoComplete="new-password" hint="8자 이상, 영문·숫자·기호를 섞으면 더 안전해요." />
      <PasswordField label="새 비밀번호 확인" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={Boolean(confirm) && confirm !== password} />
      {error ? <Alert kind="error" title={error} /> : null}
      <Button type="submit" size="lg" block loading={busy} loadingText="바꾸는 중">비밀번호 바꾸기</Button>
    </form>
  );
}
