import { db } from "@/db";
import * as schema from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const [
    domains, topics, articles, questions, practiceSessions, attempts, topicMastery,
    vocabulary, summaries, rssSources, dailyLog, preferences, automationRuns,
  ] = await Promise.all([
    db.select().from(schema.domains),
    db.select().from(schema.topics),
    db.select().from(schema.articles),
    db.select().from(schema.questions),
    db.select().from(schema.practiceSessions),
    db.select().from(schema.attempts),
    db.select().from(schema.topicMastery),
    db.select().from(schema.vocabulary),
    db.select().from(schema.summaries),
    db.select().from(schema.rssSources),
    db.select().from(schema.dailyLog),
    db.select().from(schema.preferences),
    db.select().from(schema.automationRuns),
  ]);
  const backup = JSON.stringify({
    exportedAt: new Date().toISOString(),
    tables: { domains, topics, articles, questions, practiceSessions, attempts, topicMastery, vocabulary, summaries, rssSources, dailyLog, preferences, automationRuns },
  }, null, 2);
  return new Response(backup, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="atlas-backup.json"',
      "cache-control": "no-store",
    },
  });
}
