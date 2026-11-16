import type { Metadata } from "next";
import { FindingDetailView } from "@/components/report/FindingDetailView";

export const metadata: Metadata = {
  title: "확인 화면",
  robots: { index: false, follow: false },
  openGraph: {
    title: "바로미 점검 결과",
    description: "쇼핑몰 구매 흐름의 다크패턴 점검 결과예요. 점검을 요청한 계정만 열 수 있어요.",
  },
};

export default async function FindingPage({ params }: { params: Promise<{ id: string; finding: string }> }) {
  const { id, finding } = await params;
  return <FindingDetailView scanId={id} findingId={finding} />;
}
