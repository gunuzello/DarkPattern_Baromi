import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "바로미 · 쇼핑몰 운영자를 위한 다크패턴 점검";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "쇼핑몰을 더 바르게.";
const SUB = "쇼핑몰 운영자를 위한 다크패턴 점검";
const WORD = "바로미";
const CHIPS = ["상품 상세", "장바구니", "주문서", "16가지 점검"];

/**
 * The default OG font has no Hangul. Fetch only the glyphs used here from Google Fonts
 * (no user agent, so the CSS points at a TTF that the image renderer can read).
 * If that fails the card still renders, just without the Korean lines.
 */
async function hangulFont(): Promise<ArrayBuffer | null> {
  try {
    const text = encodeURIComponent([TITLE, SUB, WORD, ...CHIPS].join(""));
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@800&text=${text}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const response = await fetch(url);
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const [font, symbol] = await Promise.all([
    hangulFont(),
    readFile(join(process.cwd(), "public/brand/baromi-symbol.png"), "base64"),
  ]);
  const ko = Boolean(font);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "#ffffff", fontFamily: ko ? "NotoKR" : undefined }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <img src={`data:image/png;base64,${symbol}`} width={67} height={70} alt="" />
          <span style={{ fontSize: 56, fontWeight: 800, color: "#0f172a", letterSpacing: -2 }}>{ko ? WORD : "baromi"}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {ko ? <span style={{ fontSize: 34, fontWeight: 800, color: "#3f57e6" }}>{SUB}</span> : null}
          <span style={{ fontSize: 84, fontWeight: 800, color: "#0f172a", letterSpacing: -3, lineHeight: 1.1 }}>{ko ? TITLE : "Dark-pattern checks for online shops"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {ko ? CHIPS.map((chip) => (
            <span key={chip} style={{ display: "flex", padding: "10px 20px", borderRadius: 12, background: "#e8edff", color: "#3f57e6", fontSize: 28, fontWeight: 800 }}>{chip}</span>
          )) : null}
          <span style={{ display: "flex", marginLeft: "auto", width: 220, height: 14, borderRadius: 7, background: "linear-gradient(115deg, #4f6bff 0%, #8a5cff 100%)" }} />
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "NotoKR", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
