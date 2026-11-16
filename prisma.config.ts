import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/database-url";

export default defineConfig({
  schema: process.env.PRISMA_PROVIDER === "postgresql" ? "prisma/postgresql/schema.prisma" : "prisma/schema.prisma",
  migrations: { path: process.env.PRISMA_PROVIDER === "postgresql" ? "prisma/postgresql/migrations" : "prisma/migrations" },
  datasource: { url: databaseUrl() },
});
