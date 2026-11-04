import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
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
    try {
      await database.execute(sql`SELECT 1 FROM domains LIMIT 1`);
    } catch (error) {
      throw new Error(
        "ATLAS database tables are missing. Run the PostgreSQL setup SQL in Supabase before opening the app.",
        { cause: error },
      );
    }
  })().catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
}

export async function seedDatabase() {
  await ensureDatabase();
  await seedIfEmpty(database);
}

export const db = database;
export type DB = typeof database;
