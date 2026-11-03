import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const file = await readFile(path.join(process.cwd(), "atlas.db"));
  return new Response(file, {
    headers: {
      "content-type": "application/x-sqlite3",
      "content-disposition": 'attachment; filename="atlas.db"',
      "cache-control": "no-store",
    },
  });
}
