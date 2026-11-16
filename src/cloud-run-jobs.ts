import { GoogleAuth } from "google-auth-library";

export function cloudRunJobsEnabled() {
  return Boolean(process.env.BAROMI_CLOUD_RUN_JOB_NAME);
}

export async function executeScanJob(scanId: string) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID;
  const region = process.env.CLOUD_RUN_REGION;
  const jobName = process.env.BAROMI_CLOUD_RUN_JOB_NAME;
  if (!projectId || !region || !jobName) throw new Error("Cloud Run Job 프로젝트·리전·이름 설정이 필요합니다.");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  // AuthClient.getAccessToken() returns an object containing the token (and
  // response metadata), not the token string itself. Passing that object into
  // the Authorization header produces `Bearer [object Object]` and Cloud Run
  // rejects the request as unauthenticated.
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Cloud Run Job 실행 권한 토큰을 가져오지 못했습니다.");
  const jobPath = `projects/${projectId}/locations/${region}/jobs/${jobName}`;
  const response = await fetch(`https://run.googleapis.com/v2/${jobPath}:run`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      overrides: { containerOverrides: [{ args: [scanId] }] },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloud Run 진단 작업을 시작하지 못했습니다 (${response.status}): ${detail.slice(0, 400)}`);
  }
  return await response.json() as { name?: string };
}
