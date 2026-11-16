import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET ?? "baromi-evidence";
  if (!url) throw new Error("SUPABASE_URL 설정이 필요합니다.");
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!serviceRoleKey) {
    for await (const chunk of process.stdin) serviceRoleKey += chunk.toString();
  }
  serviceRoleKey = serviceRoleKey.trim();
  if (!serviceRoleKey) throw new Error("Supabase service-role secret을 stdin으로 전달해야 합니다.");
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = await client.storage.getBucket(bucketName);
  if (existing.data) {
    console.log(`Private evidence bucket ready: ${bucketName}`);
    return;
  }
  const created = await client.storage.createBucket(bucketName, { public: false, allowedMimeTypes: ["image/png"] });
  if (created.error) throw new Error(`Evidence bucket creation failed: ${created.error.message}`);
  console.log(`Private evidence bucket created: ${bucketName}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
