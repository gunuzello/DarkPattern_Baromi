import type { Metadata } from "next";
import { AiDiagnosisPage } from "@/components/ai/AiDiagnosisPage";

export const metadata: Metadata = { title: "AI 정밀 진단", robots: { index: false, follow: false } };

export default async function AiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AiDiagnosisPage id={id} />;
}
