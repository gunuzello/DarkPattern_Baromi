import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "페이지를 찾지 못했어요", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="lp" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main id="main" style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div className="lp-wrap" style={{ width: "100%", paddingBlock: 96 }}>
          <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
            <h1 className="t-page">페이지를 찾지 못했어요</h1>
            <p className="muted">주소가 바뀌었거나 삭제된 페이지예요. 점검 결과라면 내 쇼핑몰의 점검 기록에서 다시 열 수 있어요.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              <ButtonLink href="/" variant="brand">처음으로</ButtonLink>
              <ButtonLink href="/shops" variant="secondary">내 쇼핑몰</ButtonLink>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
