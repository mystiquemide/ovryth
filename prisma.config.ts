import path from "node:path";
import { defineConfig } from "prisma/config";
import { config as loadEnv } from "dotenv";

// Prisma 7 no longer auto-loads .env; load our local env for CLI commands.
loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  // Migrations/introspection connect directly (5432). Runtime uses the pg adapter (pooler).
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});

