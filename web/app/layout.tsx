import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import "./site.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const noto = Noto_Sans_KR({ weight: ["400", "500", "600", "700", "800"], variable: "--font-noto", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

const description = "쇼핑몰 운영자를 위한 다크패턴 점검. 공개 화면과 구매 흐름에서 16가지 위험 신호를 근거와 함께 정리합니다.";

/** Absolute base for share links: production domain on Vercel, else localhost. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "바로미 | 쇼핑몰 다크패턴 점검", template: "%s | 바로미" },
  description,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "바로미",
    title: "바로미 | 쇼핑몰 다크패턴 점검",
    description,
  },
  twitter: { card: "summary_large_image", title: "바로미 | 쇼핑몰 다크패턴 점검", description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${inter.variable} ${noto.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
