import type { Metadata } from "next";
import { PageHead } from "@/components/shell/PageHead";
import { ScanForm } from "@/components/scan/ScanForm";

export const metadata: Metadata = { title: "새 점검" };

export default function NewScanPage() {
  return (
    <>
      <PageHead
        title="새 점검"
        crumbs={[{ label: "점검 기록" }, { label: "새 점검" }]}
        meta={<span>쇼핑몰 주소만으로 공개 화면을 먼저 확인하고, 소유 확인과 테스트 계정을 더하면 실제 구매 흐름까지 안전하게 점검해요.</span>}
      />
      <ScanForm />
    </>
  );
}
