import { eq, sql } from "drizzle-orm";
import { db, ensureDatabase } from "@/db";
import { domains, topicMastery, topics } from "@/db/schema";
import { startSession } from "../actions";

export const dynamic = "force-dynamic";

export default async function PracticeHub() {
  await ensureDatabase();
  const doms = await db.select().from(domains).orderBy(domains.sortOrder);
  const rows = await db.select({
    id: topics.id, name: topics.name, domain: topics.domainId, level: topicMastery.masteryLevel,
    total: topicMastery.totalAttempts, correct: topicMastery.correctAttempts,
    qCount: sql<number>`(SELECT COUNT(*) FROM questions q WHERE q.topic_id = ${topics.id})`,
  }).from(topics).leftJoin(topicMastery, eq(topics.id, topicMastery.topicId)).orderBy(topics.sortOrder);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Practice</h1>
        <p className="mt-1 text-muted">Pick a topic, or mix a whole section. Least-practiced questions come first.</p>
      </header>
      {doms.map((d) => (
        <section key={d.id} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl">{d.name}</h2>
            <form action={startSession}>
              <input type="hidden" name="domain" value={d.id} /><input type="hidden" name="n" value="5" />
              <button className="btn">Mixed set of 5</button>
            </form>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.filter((r) => r.domain === d.id).map((t) => (
              <form key={t.id} action={startSession} className="card flex items-center justify-between gap-3">
                <input type="hidden" name="domain" value={d.id} /><input type="hidden" name="topic" value={t.id} />
                <input type="hidden" name="n" value="5" />
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted">
                    {t.qCount} questions · {t.level ?? "new"}
                    {t.total ? ` · ${Math.round(((t.correct ?? 0) / t.total) * 100)}%` : ""}
                  </p>
                </div>
                <button className="btn btn-primary">Start</button>
              </form>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
