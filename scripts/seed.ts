import { seedDatabase } from "../src/db";

async function main() {
  await seedDatabase();
  console.log("ATLAS database ready (Supabase PostgreSQL).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
