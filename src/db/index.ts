import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { DDL } from "./ddl";
import { seedIfEmpty } from "./seed";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL?.trim();
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
if (!connectionString && !isProductionBuild) {
  throw new Error("DATABASE_URL is required. Add the Supabase connection string to .env.local and Vercel.");
}

const client = postgres(connectionString ?? "postgres://build:build@localhost:5432/build", {
  prepare: false,
  max: 1,
  idle_timeout: 20,
});
const database = drizzle(client, { schema });
if (connectionString) {
  await database.execute(sql.raw(DDL));
  await seedIfEmpty(database);
}

export const db = database;
export type DB = typeof database;
