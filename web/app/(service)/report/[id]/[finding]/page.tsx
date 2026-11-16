import type { Metadata } from "next";
import { FindingDetailView } from "@/components/report/FindingDetailView";

export const metadata: Metadata = {
  title: "발견 항목 상세",
  robots: { index: false, follow: false },
  openGraph: {
    title: "바로미 진단 보고서",
    description: "쇼핑몰 구매 흐름의 다크패턴 진단 결과예요. 보고서는 진단을 요청한 사람만 열 수 있어요.",
  },
};

export default async function FindingPage({ params }: { params: Promise<{ id: string; finding: string }> }) {
  const { id, finding } = await params;
  return <FindingDetailView scanId={id} findingId={finding} />;
}
