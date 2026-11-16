import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "./database-url";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaClient as PostgresPrismaClient } from "./generated/prisma-postgres/client";

const shared = globalThis as typeof globalThis & { scanDb?: PrismaClient };

export function db() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL을 설정하세요.");
  if (shared.scanDb) return shared.scanDb;
  if (/^postgres(?:ql)?:\/\//i.test(url)) {
    return shared.scanDb = new PostgresPrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) as unknown as PrismaClient;
  }
  return shared.scanDb = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
