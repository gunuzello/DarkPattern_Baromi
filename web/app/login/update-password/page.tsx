import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { UpdatePasswordForm } from "@/components/auth/ResetForms";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "새 비밀번호 정하기", robots: { index: false, follow: false } };

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="새 비밀번호 정하기" lede="앞으로 로그인할 때 쓸 비밀번호를 입력해 주세요.">
      <UpdatePasswordForm next={safeNext(next)} />
    </AuthShell>
  );
}
