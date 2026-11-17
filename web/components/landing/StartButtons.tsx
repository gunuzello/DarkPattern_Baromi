"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { ButtonLink } from "@/components/ui/Button";
import { authConfigured } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Whether a Supabase session exists in this browser (false until checked, and without auth). */
export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!authConfigured) return;
    const supabase = supabaseBrowser();
    void supabase.auth.getSession().then((result: { data: { session: Session | null } }) => setSignedIn(Boolean(result.data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

type Size = "md" | "lg";

/** Main call to action: start a free check, or a new check for a signed-in owner. */
export function StartButton({ size = "md", className }: { size?: Size; className?: string }) {
  const signedIn = useSignedIn();
  return <ButtonLink href="/scan/new" variant="brand" size={size} className={className}>{signedIn ? "새 점검 시작" : "무료로 점검하기"}</ButtonLink>;
}

/** Second action: the sample result for visitors, the owner's shops when signed in. */
export function SecondaryStartButton({ size = "md", className }: { size?: Size; className?: string }) {
  const signedIn = useSignedIn();
  return signedIn
    ? <ButtonLink href="/shops" variant="secondary" size={size} className={className}>내 쇼핑몰</ButtonLink>
    : <ButtonLink href="/report/sample" variant="secondary" size={size} className={className}>예시 결과 보기</ButtonLink>;
}
