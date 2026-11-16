import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const bucketName = () => process.env.SUPABASE_STORAGE_BUCKET ?? "baromi-evidence";
const storageClient = () => {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
};

export async function persistScanEvidence(scanId: string, directory: string) {
  const client = storageClient();
  if (!client) {
    if (process.env.BAROMI_REPORT_STORAGE === "postgres") throw new Error("Supabase Storage 서버 키가 없어 증거를 보존하지 못했습니다.");
    return;
  }
  const files = (await readdir(directory, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png"));
  for (const file of files) {
    const bytes = await readFile(join(directory, file.name));
    const { error } = await client.storage.from(bucketName()).upload(`${scanId}/${file.name}`, bytes, {
      contentType: "image/png", upsert: true,
    });
    if (error) throw new Error(`증거 저장 실패 (${file.name}): ${error.message}`);
  }
}

export async function readScanEvidence(scanId: string, fileName: string) {
  const client = storageClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(bucketName()).download(`${scanId}/${fileName}`);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function deleteScanEvidence(scanId: string) {
  const client = storageClient();
  if (!client) return;
  const bucket = client.storage.from(bucketName());
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await bucket.list(scanId, { limit: 100, offset });
    if (error) throw new Error(`증거 목록 조회 실패: ${error.message}`);
    if (!data?.length) return;
    const { error: removeError } = await bucket.remove(data.map((file) => `${scanId}/${file.name}`));
    if (removeError) throw new Error(`증거 삭제 실패: ${removeError.message}`);
    if (data.length < 100) return;
  }
}
