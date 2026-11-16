import type { Metadata } from "next";
import { ScanProgress } from "@/components/scan/ScanProgress";

export const metadata: Metadata = { title: "점검 진행" };

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScanProgress id={id} />;
}
