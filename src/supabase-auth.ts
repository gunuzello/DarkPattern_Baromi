import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const config = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
});

export function supabaseAuthEnabled() {
  const { url, key } = config();
  return Boolean(url && key);
}

/** Verify a Supabase access token with Supabase's JWKS-backed claim verifier. */
export async function supabaseOwner(request: NextRequest): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (authorization?.toLowerCase().startsWith("bearer ") && !token) return null;
  const { url, key } = config();
  if (!url || !key) return null;

  try {
    if (token) {
      const bearerClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await bearerClient.auth.getClaims(token);
      return !error && typeof data?.claims?.sub === "string" && data.claims.sub ? data.claims.sub : null;
    }

    if (request.cookies.getAll().length) {
      const cookieClient = createServerClient(url, key, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => undefined,
        },
      });
      const { data, error } = await cookieClient.auth.getClaims();
      if (!error && typeof data?.claims?.sub === "string" && data.claims.sub) return data.claims.sub;
    }

    return null;
  } catch {
    return null;
  }
}

/** Return the email only from a verified Supabase access token/cookie claim. */
export async function supabaseEmail(request: NextRequest): Promise<string | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (authorization?.toLowerCase().startsWith("bearer ") && !token) return null;
  const { url, key } = config();
  if (!url || !key) return null;

  try {
    const client = token
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
      : createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
    const { data, error } = token ? await client.auth.getClaims(token) : await client.auth.getClaims();
    const email = data?.claims?.email;
    return !error && typeof email === "string" ? email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
