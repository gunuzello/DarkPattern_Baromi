/** Shared helpers for the Supabase email + password flow (login, sign-up, reset). */

export const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Only same-origin paths are allowed as a post-login destination. */
export function safeNext(next: string | undefined, fallback = "/shops"): string {
  return next && /^\/(?!\/)[^\\]*$/.test(next) ? next : fallback;
}

/** Why the visitor landed on the login page, from the protected path they tried to open. */
export function loginReason(next: string | undefined): string | null {
  if (!next) return null;
  if (next.startsWith("/scan/new")) return "점검을 시작하려면 로그인이 필요해요";
  if (next.startsWith("/scan/")) return "점검 진행 상황을 보려면 로그인이 필요해요";
  if (next.startsWith("/report/")) return "점검 결과를 보려면 로그인이 필요해요";
  if (next.startsWith("/shop")) return "내 쇼핑몰을 보려면 로그인이 필요해요";
  return null;
}

export function withNext(path: string, next: string): string {
  return next && next !== "/shops" ? `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(next)}` : path;
}

const byCode: Record<string, string> = {
  invalid_credentials: "이메일 또는 비밀번호가 맞지 않아요.",
  email_not_confirmed: "아직 이메일 인증을 마치지 않았어요. 가입할 때 받은 메일의 확인 링크를 눌러 주세요.",
  user_already_exists: "이미 가입된 이메일이에요. 로그인해 주세요.",
  email_exists: "이미 가입된 이메일이에요. 로그인해 주세요.",
  weak_password: "비밀번호가 너무 쉬워요. 8자 이상으로 영문, 숫자, 기호를 섞어 주세요.",
  same_password: "이전과 다른 비밀번호를 입력해 주세요.",
  email_address_invalid: "이메일 주소 형식을 확인해 주세요.",
  over_email_send_rate_limit: "메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.",
  over_request_rate_limit: "요청이 많아 잠시 막혔어요. 잠시 후 다시 시도해 주세요.",
  signup_disabled: "지금은 새 계정을 만들 수 없어요.",
  session_expired: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  otp_expired: "링크가 만료됐어요. 메일을 다시 받아 주세요.",
};

/** Supabase errors in plain Korean; raw English messages never reach the screen. */
export function authErrorMessage(cause: unknown, fallback = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."): string {
  if (!cause || typeof cause !== "object") return fallback;
  const { code, message, status } = cause as { code?: string; message?: string; status?: number };
  if (code && byCode[code]) return byCode[code];
  const text = (message ?? "").toLowerCase();
  if (text.includes("invalid login credentials")) return byCode.invalid_credentials;
  if (text.includes("email not confirmed")) return byCode.email_not_confirmed;
  if (text.includes("already registered")) return byCode.user_already_exists;
  if (text.includes("password should be")) return byCode.weak_password;
  if (text.includes("rate limit")) return byCode.over_request_rate_limit;
  if (text.includes("failed to fetch") || text.includes("network")) return "인증 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.";
  if (status === 429) return byCode.over_request_rate_limit;
  return fallback;
}
