import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const origin = "http://127.0.0.1:3100";
const riskyUrl = origin + "/demo/risky/product";
let worker: ChildProcess | undefined;
let aiProvider: Server | undefined;

test.afterEach(async () => {
  if (worker?.pid && worker.exitCode === null) {
    const child = worker;
    const pid = child.pid!;
    const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
    try { process.kill(-pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
    if (child.exitCode === null) {
      try { process.kill(-pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    }
  }
  worker = undefined;
  if (aiProvider?.listening) await new Promise<void>((resolve) => aiProvider!.close(() => resolve()));
  aiProvider = undefined;
});

test("URL과 동의를 검증하고 대기 중인 진단을 중단한다", async ({ request }) => {
  const api = origin + "/api/v1/";
  const health = await request.get(api + "health");
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toMatchObject({
    status: "ok", service: "baromi", worker: { queued: expect.any(Number), running: expect.any(Number), stale: expect.any(Number) },
  });
  expect((await health.json()).worker.stale).toBe(0);
  for (const data of [{ url: riskyUrl, consent: false }, { url: "https://example.invalid", consent: true }]) {
    expect((await request.post(api + "shops", { data })).status()).toBe(400);
  }
  const external = await request.post(api + "shops", {
    data: { url: "https://store.example.com/products/gift", consent: true },
  });
  expect(external.status()).toBe(201);
  const externalShop = await external.json();
  expect(externalShop.verification.metaTag).toContain('name="baromi-site-verification"');
  expect(externalShop.verification.token).toHaveLength(32);
  const unverifiedDynamic = await request.post(api + "scans", { data: {
    shopId: externalShop.shopId, profile: "DYNAMIC", flows: ["PURCHASE"], productLimit: 1, viewport: "DESKTOP",
  } });
  expect(unverifiedDynamic.status()).toBe(409);
  const invalidPath = await request.post(api + "scans", { data: {
    shopId: externalShop.shopId, profile: "CONTEST", flows: ["PURCHASE"], productLimit: 1, viewport: "DESKTOP", purchasePath: "UNKNOWN",
  } });
  expect(invalidPath.status()).toBe(400);
  const shop = await (await request.post(api + "shops", { data: { url: riskyUrl, consent: true } })).json();
  expect(shop.verification).toBeNull();
  const shops = await request.get(api + "shops?limit=10");
  expect(shops.status()).toBe(200);
  expect(await shops.json()).toMatchObject({ limit: 10, shops: expect.arrayContaining([
    expect.objectContaining({ shopId: shop.shopId, url: riskyUrl }),
  ]) });
  const verified = await request.post(api + "shops/" + shop.shopId + "/verify", { data: {} });
  expect(verified.status()).toBe(200);
  expect((await verified.json()).verified).toBe(true);
  expect((await request.get(api + "shops/" + shop.shopId)).status()).toBe(200);
  const submitted = await request.post(api + "scans", { data: {
    shopId: shop.shopId, profile: "CONTEST", flows: ["PURCHASE"], productLimit: 1, viewport: "DESKTOP",
  } });
  expect(submitted.status()).toBe(202);
  const scan = await submitted.json();
  expect(scan.status).toBe("QUEUED");
  const duplicate = await request.post(api + "scans", { data: {
    shopId: shop.shopId, profile: "CONTEST", flows: ["PURCHASE"], productLimit: 1, viewport: "DESKTOP",
  } });
  expect(duplicate.status()).toBe(202);
  expect(await duplicate.json()).toMatchObject({ scanId: scan.scanId, deduplicated: true });
  expect((await request.post(api + "scans/" + scan.scanId + "/cancel", { data: {} })).status()).toBe(200);
  const status = await (await request.get(api + "scans/" + scan.scanId)).json();
  expect(status.status).toBe("CANCELLED");
  expect(status.summary.notTested).toBe(3);
  expect(status.currentStage).toBe("CANCELLED");
  expect(Object.values(status.phaseResults).every((phase: any) => phase.status !== "PENDING" && phase.status !== "RUNNING")).toBe(true);
  expect(status.phaseResults["product"].status).toBe("SKIPPED");
  expect((await request.get(api + "shops/" + shop.shopId + "/scans")).json()).resolves.toEqual([
    expect.objectContaining({ scanId: scan.scanId, status: "CANCELLED", purchasePath: "CART" }),
  ]);
  expect((await request.delete(api + "shops/" + shop.shopId)).status()).toBe(200);
  expect((await request.get(api + "shops/" + shop.shopId)).status()).toBe(404);
});

test("소유 세션을 폐기하면 기존 상점에 접근할 수 없다", async ({ request }) => {
  const api = origin + "/api/v1/";
  const created = await request.post(api + "shops", { data: { url: riskyUrl, consent: true } });
  expect(created.status()).toBe(201);
  const { shopId } = await created.json();
  expect((await request.get(api + "shops/" + shopId)).status()).toBe(200);
  const revoked = await request.delete(api + "session");
  expect(revoked.status()).toBe(200);
  expect(await revoked.json()).toEqual({ revoked: true });
  expect((await request.get(api + "shops/" + shopId)).status()).toBe(404);
});

test("웹에서 진단하고 증거를 확인한 후 같은 조건으로 재진단한다", async ({ page, playwright }) => {
  test.setTimeout(120_000);
  aiProvider = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { input?: { role: string; content: string }[] };
      const prompt = body.input?.find((item) => item.role === "user")?.content ?? "{}";
      const candidate = (JSON.parse(prompt) as { candidate: { evidence: { evidenceId: string }[] } }).candidate;
      const result = { verdict: "RISK", summary: "선택된 항목의 위험 신호", reason: "근거가 연결되어 있습니다.",
        observedFacts: ["화면에서 확인됨"], evidenceIds: [candidate.evidence[0].evidenceId], recommendations: ["선택 상태를 고쳐주세요."], limitations: [] };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ output_text: JSON.stringify(result), usage: { input_tokens: 120, output_tokens: 80 } }));
    });
  });
  await new Promise<void>((resolve) => aiProvider!.listen(0, "127.0.0.1", resolve));
  const address = aiProvider.address();
  if (!address || typeof address === "string") throw new Error("테스트 AI 제공자 포트를 열지 못했습니다.");
  worker = spawn(process.execPath, ["--import", "tsx", "scripts/worker.ts"], {
    env: {
      ...process.env,
      BAROMI_SPRING_QUEUE_ENABLED: "false",
      BAROMI_SPRING_API_URL: "",
      BAROMI_AI_API_URL: `http://127.0.0.1:${address.port}/responses`,
      BAROMI_AI_API_KEY: "test-only-key",
      BAROMI_AI_MODEL: "test-review-model",
      DEMO_ORIGIN: origin,
    },
    stdio: "inherit",
    detached: true,
  });
  await page.goto(origin + "/scan/new");
  await page.getByLabel("쇼핑몰 URL").fill(riskyUrl);
  await page.getByRole("checkbox", { name: /자동 진단 권한/ }).check();
  await page.getByRole("button", { name: "진단 시작" }).click();
  await expect(page.getByText("별도 탐색 영역", { exact: true })).toBeVisible();
  for (const surface of ["상품 목록·카테고리·검색", "로그인·회원가입", "쿠폰·프로모션", "추천·인기·후기", "구독·멤버십·자동 갱신", "해지·탈퇴·환불", "배송·교환·반품·정책"]) {
    await expect(page.getByText(surface, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("진단 항목", { exact: true })).toBeVisible();
  await expect(page.getByText("총 16개 유형")).toBeVisible();
  await page.getByRole("link", { name: "진단 결과 보기" }).click({ timeout: 60_000 });
  await page.waitForURL("**/report/*");
  await expect(page.getByRole("heading", { name: "16개 유형별 검사 결과" })).toBeVisible();
  await expect(page.getByText(/기본 엔진/).first()).toBeVisible();
  await expect(page.getByText(/AI 맥락 검토/).first()).toBeVisible();
  const reportUrl = page.url();
  const baselineScanId = new URL(reportUrl).pathname.split("/").at(-1);
  const downloadResponse = await page.request.get(origin + "/api/v1/scans/" + baselineScanId + "/report?download=1");
  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-disposition"]).toContain(`baromi-${baselineScanId}.json`);
  const downloadedReport = await downloadResponse.json();
  expect(downloadedReport.authContext).toBe("ANONYMOUS");
  expect(downloadedReport.ruleCoverage.FORCED_ACTION).toMatchObject({ status: "NOT_OBSERVED", evidenceIds: ["evidence:checkout"] });
  expect(downloadedReport.ruleCoverage.URGENCY_SCARCITY).toMatchObject({ decisionMode: "AI_CONTEXT", status: "REVIEW_NEEDED" });
  expect(downloadedReport.ruleCoverage.PRESELECTION).toMatchObject({ decisionMode: "BASIC_ENGINE", status: "SUSPECTED" });
  expect(downloadedReport.reviewCandidates).toEqual(expect.arrayContaining([expect.objectContaining({ ruleType: "URGENCY_SCARCITY" })]));
  expect(Object.values(downloadedReport.summary).reduce((sum: number, count: any) => sum + count, 0)).toBe(16);
  expect(Object.keys(downloadedReport.ruleCoverage)).toHaveLength(16);
  expect(Object.values(downloadedReport.ruleCoverage).every((item: any) =>
    typeof item.reason === "string" && item.reason.length > 0 && Array.isArray(item.evidenceIds))).toBe(true);
  expect(downloadedReport.phaseResults.product).toMatchObject({ status: "COVERED", durationMs: expect.any(Number), evidenceIds: expect.any(Array) });
  const viewedReport = await (await page.request.get(origin + "/api/v1/scans/" + baselineScanId + "/report")).json();
  expect(viewedReport.ruleCoverage).toEqual(downloadedReport.ruleCoverage);
  expect(viewedReport.phaseResults).toEqual(downloadedReport.phaseResults);
  expect(viewedReport.reviewCandidates).toEqual(downloadedReport.reviewCandidates);
  expect((await page.request.post(origin + "/api/v1/scans/" + baselineScanId + "/ai-review", { data: { selectedRuleTypes: ["PRESELECTION"] } })).status()).toBe(402);
  execFileSync("npx", ["prisma", "db", "execute", "--stdin"], {
    cwd: process.cwd(), env: process.env,
    input: `UPDATE "Shop" SET plan = 'PREMIUM' WHERE id = '${downloadedReport.shopId}';`,
  });
  const aiRequest = await page.request.post(origin + "/api/v1/scans/" + baselineScanId + "/ai-review", { data: { selectedRuleTypes: ["PRESELECTION", "HIDDEN_SUBSCRIPTION"] } });
  expect(aiRequest.status()).toBe(202);
  expect(await aiRequest.json()).toMatchObject({ status: "QUEUED", candidateCount: expect.any(Number) });
  await expect.poll(async () => {
    const response = await page.request.get(origin + "/api/v1/scans/" + baselineScanId + "/report");
    return (await response.json()).aiReview?.status;
  }, { timeout: 15_000 }).toBe("COMPLETED");
  const reviewedReport = await (await page.request.get(origin + "/api/v1/scans/" + baselineScanId + "/report")).json();
  expect(reviewedReport.aiReview.result.results).toEqual(expect.arrayContaining([expect.objectContaining({ ruleType: "PRESELECTION", verdict: "RISK" })]));
  expect(reviewedReport.ruleCoverage.PRESELECTION).toEqual(downloadedReport.ruleCoverage.PRESELECTION);
  const differentShop = await page.request.post(origin + "/api/v1/shops", {
    data: { url: riskyUrl, consent: true },
  });
  const { shopId } = await differentShop.json();
  const wrongBaseline = await page.request.post(origin + "/api/v1/scans", { data: {
    shopId, baselineScanId, profile: "CONTEST", flows: ["PURCHASE"], productLimit: 1, viewport: "DESKTOP",
  } });
  expect(wrongBaseline.status()).toBe(404);
  await expect(page.getByRole("link", { name: "특정 옵션의 사전선택" })).toBeVisible();
  await Promise.all([
    page.waitForURL("**/report/*/*"),
    page.getByRole("link", { name: "순차공개 가격책정" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "순차공개 가격책정" })).toBeVisible();
  await expect(page.getByText("근거 ID ·")).toBeVisible();
  await expect(page.getByRole("link", { name: /제21조의2/ })).toBeVisible();
  const image = page.getByRole("img", { name: "주문서 진단 화면" });
  await expect(page.getByRole("img", { name: "위험 신호 위치" })).toHaveCount(1);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  const evidence = (await image.getAttribute("src"))!;
  const anonymous = await playwright.request.newContext();
  try {
    expect((await anonymous.get(origin + evidence)).status()).toBe(404);
  } finally {
    await anonymous.dispose();
  }
  await page.getByRole("link", { name: "진단 결과로 돌아가기" }).click();
  await page.getByRole("button", { name: "같은 조건으로 재진단" }).click();
  await page.getByRole("link", { name: "진단 결과 보기" }).click({ timeout: 60_000 });
  await page.waitForURL("**/report/*");
  expect(page.url()).not.toBe(reportUrl);
  await expect(page.getByRole("heading", { name: "재진단 비교" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "재발견 2건" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이번에 미발견 0건" })).toBeVisible();
  await expect(page.getByRole("link", { name: "기준 보고서 보기" })).toHaveAttribute("href", new URL(reportUrl).pathname);
  await expect(page.getByRole("link", { name: "순차공개 가격책정" })).toBeVisible();
});

test("워커가 진단 시작 전에 실패해도 16개 유형과 실패 사유가 있는 보고서를 연다", async ({ page }) => {
  test.setTimeout(60_000);
  const api = origin + "/api/v1/";
  const shop = await (await page.request.post(api + "shops", { data: { url: riskyUrl, consent: true } })).json();
  const created = await page.request.post(api + "scans", { data: {
    shopId: shop.shopId, profile: "CONTEST", flows: ["PURCHASE"], productLimit: 1, viewport: "DESKTOP",
  } });
  expect(created.status()).toBe(202);
  const { scanId } = await created.json();
  execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    "const { db } = await import('./src/db.ts'); await db().scan.update({ where: { id: process.argv[1] }, data: { credentialCiphertext: 'intentionally-invalid-ciphertext' } }); await db().$disconnect();",
    scanId], { env: process.env, stdio: "inherit" });
  worker = spawn(process.execPath, ["--import", "tsx", "scripts/worker.ts"], {
    env: { ...process.env, BAROMI_SPRING_QUEUE_ENABLED: "false", BAROMI_SPRING_API_URL: "", DEMO_ORIGIN: origin },
    stdio: "inherit", detached: true,
  });
  await expect.poll(async () => (await (await page.request.get(api + "scans/" + scanId)).json()).status, { timeout: 30_000 }).toBe("FAILED");
  const status = await (await page.request.get(api + "scans/" + scanId)).json();
  expect(status.hasReport).toBe(true);
  await page.goto(origin + "/scan/" + scanId);
  await page.getByRole("link", { name: "진단 결과 보기" }).click();
  await expect(page.getByText(/진단이 종료된 이유/)).toBeVisible();
  await expect(page.getByText("16개 유형")).toBeVisible();
  const downloaded = await page.request.get(api + "scans/" + scanId + "/report?download=1");
  expect(downloaded.status()).toBe(200);
  const report = await downloaded.json();
  expect(report.scanStatus).toBe("FAILED");
  expect(Object.keys(report.ruleCoverage)).toHaveLength(16);
  expect(report.collectionFailure).toContain("암호문");
});

test("웹 동적 검사 폼은 전용 테스트 계정을 스캔 요청에만 전달한다", async ({ page }) => {
  let scanPayload: Record<string, unknown> | undefined;
  await page.route("**/api/v1/shops", async (route) => {
    await route.fulfill({ json: { shopId: "shop-credential-test", url: "https://shop.example.com/", verification: null } });
  });
  await page.route("**/api/v1/scans", async (route) => {
    scanPayload = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { scanId: "scan-credential-test", status: "QUEUED" } });
  });
  await page.goto(origin + "/scan/new");
  await page.getByLabel("쇼핑몰 URL").fill("https://shop.example.com/");
  await page.getByRole("button", { name: "소유 확인 후 동적 구매 흐름까지 검사" }).click();
  await page.getByLabel("아이디").fill("test@example.com");
  await page.getByLabel("비밀번호").fill("only-in-memory-password");
  await page.getByRole("checkbox", { name: /자동 진단 권한/ }).check();
  await page.getByRole("button", { name: "진단 시작" }).click();
  await expect.poll(() => scanPayload).toMatchObject({
    profile: "DYNAMIC", credentials: { username: "test@example.com", password: "only-in-memory-password" },
  });
  await expect(page).toHaveURL(/\/scan\/scan-credential-test$/);
});
