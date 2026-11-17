export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}초`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}분 ${s}초`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function viewportLabel(viewport: "DESKTOP" | "MOBILE", withSize = false): string {
  if (viewport === "MOBILE") return withSize ? "모바일 390×844" : "모바일";
  return withSize ? "PC 1440×1000" : "PC";
}

export function pathLabel(path: "CART" | "DIRECT"): string {
  return path === "DIRECT" ? "바로구매" : "장바구니 경유";
}
