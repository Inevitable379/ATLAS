import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";
import { DDL } from "./ddl";
import { seedIfEmpty } from "./seed";

function create() {
  const sqlite = new Database(path.join(process.cwd(), "atlas.db"));
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  const db = drizzle(sqlite, { schema });
  seedIfEmpty(db);
  return db;
}

// Reuse one connection across hot reloads in dev.
const g = globalThis as unknown as { __atlasDb?: ReturnType<typeof create> };
export const db = g.__atlasDb ?? (g.__atlasDb = create());
export type DB = typeof db;
