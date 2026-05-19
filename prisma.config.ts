import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local; mirror that here so the Prisma CLI sees the same
// values as the running app. Load .env.local first (developer overrides),
// then .env as a fallback.
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Placeholder lets `prisma generate` succeed without credentials.
    // Real migrate / db push commands will fail with a connection error
    // (the correct behavior) unless DATABASE_URL is set.
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
