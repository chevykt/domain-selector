import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local; mirror that here so the Prisma CLI sees the same
// values as the running app. Load .env.local first (developer overrides),
// then .env as a fallback.
loadEnv({ path: ".env.local" });
loadEnv();

// Migrations need a DIRECT (non-pooled) connection because Prisma uses
// Postgres advisory locks (SELECT pg_advisory_lock(...)) for migration
// safety, and Neon's -pooler endpoint runs pgBouncer in transaction-
// pooling mode which doesn't pin a backend connection across queries.
// Without a pinned session, the lock can't be acquired and we get
// "P1002: timed out trying to acquire advisory lock".
//
// Resolution order:
//   1. DIRECT_URL (recommended — set this in Vercel to the non-pooled URL)
//   2. DATABASE_URL (works locally if the URL happens to be non-pooled)
//   3. Placeholder so `prisma generate` succeeds without credentials
const migrateUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateUrl,
  },
});
