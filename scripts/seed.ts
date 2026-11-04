import { ensureDatabase } from "../src/db";

await ensureDatabase();
console.log("ATLAS database ready (Supabase PostgreSQL).");
