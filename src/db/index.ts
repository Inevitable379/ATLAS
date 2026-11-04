import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { DDL } from "./ddl";
import { seedIfEmpty } from "./seed";

loadEnvConfig(process.cwd());
const connectionString = process.env.DATABASE_URL?.trim();

const client = postgres(connectionString ?? "postgres://build:build@localhost:5432/build", {
  prepare: false,
  ssl: connectionString ? "require" : false,
  max: 1,
  connect_timeout: 10,
  idle_timeout: 20,
});
const database = drizzle(client, { schema });
let initialization: Promise<void> | undefined;

export async function ensureDatabase() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. Add the Supabase connection string to .env.local and Vercel.");
  }
  initialization ??= (async () => {
    for (const statement of DDL.split(";").map((part) => part.trim()).filter(Boolean)) {
      await database.execute(sql.raw(statement));
    }
    await seedIfEmpty(database);
  })().catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
}

export const db = database;
export type DB = typeof database;
