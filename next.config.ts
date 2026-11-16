import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "@prisma/adapter-pg", "better-sqlite3", "pg"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default config;
