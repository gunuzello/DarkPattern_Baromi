"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * The API answers 401 when the Supabase login is missing or expired. Send the visitor to
 * the login page and bring them back to the screen they were on afterwards.
 */
export function useBackToLogin() {
  const router = useRouter();
  return useCallback(() => {
    const here = typeof window === "undefined" ? "/shops" : window.location.pathname + window.location.search;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [router]);
}

export function readFlag(name: string): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(name) === "1";
}
