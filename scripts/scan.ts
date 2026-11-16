import { randomUUID } from "node:crypto";
import { db } from "../src/db";
import { runScanJob } from "../src/scan-job";
import { demoTarget } from "../src/targets";

async function main() {
  const scenario = process.argv[2];
  if (scenario !== "clean" && scenario !== "risky") {
    throw new Error("사용법: npm run scan -- <clean|risky>");
  }
  const store = db();
  const id = randomUUID();
  const targetUrl = demoTarget(scenario);
  try {
    const running = await store.scan.findFirst({ where: { status: "RUNNING", startedAt: { not: null } }, select: { id: true } });
    if (running) throw new Error("진행 중인 진단이 있습니다. 완료 후 다시 시도하세요.");
    await store.scan.create({ data: { id, scenario, targetUrl, status: "RUNNING", startedAt: new Date() } });
    console.log(await runScanJob(id, targetUrl));
  } finally {
    await store.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
