import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { loginReason, safeNext, withNext } from "@/lib/auth";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode: modeParam } = await searchParams;
  const target = safeNext(next);
  const mode = modeParam === "signup" ? "signup" : "login";
  const switchHref = withNext(mode === "login" ? "/login?mode=signup" : "/login", target);

  return (
    <AuthShell
      title={mode === "login" ? "로그인" : "바로미 계정 만들기"}
      lede={mode === "login" ? "이메일과 비밀번호로 로그인해요." : "이메일과 비밀번호만 있으면 바로 만들 수 있어요."}
      reason={loginReason(next)}
      foot={
        <>
          <p>
            {mode === "login" ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}{" "}
            <Link href={switchHref} className="auth-link auth-link--strong">{mode === "login" ? "계정 만들기" : "로그인"}</Link>
          </p>
          <p className="faint">계정 없이 먼저 보고 싶다면 <Link href="/report/sample">예시 점검 결과</Link>를 열어 보세요.</p>
        </>
      }
    >
      <LoginForm key={mode} mode={mode} next={target} />
    </AuthShell>
  );
}
