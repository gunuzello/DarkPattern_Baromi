import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetRequestForm } from "@/components/auth/ResetForms";
import { safeNext, withNext } from "@/lib/auth";

export const metadata: Metadata = { title: "비밀번호 찾기", robots: { index: false, follow: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  return (
    <AuthShell
      title="비밀번호 찾기"
      lede="가입한 이메일로 비밀번호를 다시 정하는 링크를 보내 드려요."
      foot={<p><Link href={withNext("/login", target)} className="auth-link auth-link--strong">로그인으로 돌아가기</Link></p>}
    >
      <ResetRequestForm next={target} />
    </AuthShell>
  );
}
