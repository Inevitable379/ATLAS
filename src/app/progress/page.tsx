import { eq, sql } from "drizzle-orm";
import { db, ensureDatabase } from "@/db";
import { domains, topicMastery, topics } from "@/db/schema";
import { MISTAKES, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Bar({ value, label, detail }: { value: number; label: string; detail: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted">{detail}</span></div>
      <div className="mt-1 h-2 rounded bg-line" role="img" aria-label={`${label} ${value}%`}>
        <div className="h-2 rounded bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default async function Progress() {
  await ensureDatabase();
  const doms = await db.select().from(domains).orderBy(domains.sortOrder);
  const acc = await db.execute<{ domain: string; n: number; c: number; t: number }>(sql`
    SELECT q.domain_id AS domain, COUNT(*) AS n, SUM(a.is_correct) AS c, SUM(a.time_spent_s) AS t
    FROM attempts a JOIN questions q ON q.id = a.question_id GROUP BY q.domain_id`);
  const errs = await db.execute<{ domain: string; type: string; n: number }>(sql`
    SELECT q.domain_id AS domain, COALESCE(a.mistake_type, 'untagged') AS type, COUNT(*) AS n
    FROM attempts a JOIN questions q ON q.id = a.question_id WHERE a.is_correct = 0 GROUP BY 1, 2`);
  const calibration = await db.execute<{ band: string; outcome: string; n: number }>(sql`
    SELECT CASE WHEN a.confidence >= 4 THEN 'High confidence' ELSE 'Low confidence' END AS band,
      CASE WHEN a.is_correct = 1 THEN 'Correct' ELSE 'Incorrect' END AS outcome, COUNT(*) AS n
    FROM attempts a WHERE a.confidence IS NOT NULL GROUP BY 1, 2`);
  const mastery = await db.select({
    name: topics.name, domain: topics.domainId, level: topicMastery.masteryLevel,
    total: topicMastery.totalAttempts, correct: topicMastery.correctAttempts, avg: topicMastery.avgTimeS,
  }).from(topics).leftJoin(topicMastery, eq(topics.id, topicMastery.topicId)).orderBy(topics.domainId, topics.sortOrder);
  const label = (t: string) => MISTAKES.find((m) => m.id === t)?.label ?? "Not tagged";

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-3xl">Progress</h1>
        <p className="mt-1 text-muted">Accuracy shows where you stand; error types show why you lose marks.</p>
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Accuracy by section</h2>
        {acc.length === 0 && <p className="text-muted">No attempts yet. Complete a practice set and your numbers will appear here.</p>}
        {doms.map((d) => {
          const r = acc.find((x) => x.domain === d.id);
          return r ? <Bar key={d.id} value={pct(r.c, r.n)} label={d.name} detail={`${r.c}/${r.n} correct · ${Math.round(r.t / r.n)}s avg`} /> : null;
        })}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Error types</h2>
        {errs.length === 0 && <p className="text-muted">No mistakes logged yet.</p>}
        {doms.map((d) => {
          const rows = errs.filter((e) => e.domain === d.id);
          const total = rows.reduce((s, r) => s + r.n, 0);
          if (!total) return null;
          return (
            <div key={d.id} className="card space-y-3">
              <h3 className="font-medium">{d.name} · {total} mistakes</h3>
              {rows.sort((a, b) => b.n - a.n).map((r) => <Bar key={r.type} value={pct(r.n, total)} label={label(r.type)} detail={`${r.n} (${pct(r.n, total)}%)`} />)}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Confidence calibration</h2>
        <p className="text-sm text-muted">High-confidence misses are blind spots. Low-confidence correct answers may be underconfidence or lucky guesses.</p>
        {calibration.length === 0 ? <p className="text-muted">Rate confidence before answering practice questions to see this matrix.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {["High confidence", "Low confidence"].map((band) => (
              <div key={band} className="card">
                <h3 className="font-medium">{band}</h3>
                <p className="mt-2 text-sm">Correct: {calibration.find((row) => row.band === band && row.outcome === "Correct")?.n ?? 0}</p>
                <p className="text-sm">Incorrect: {calibration.find((row) => row.band === band && row.outcome === "Incorrect")?.n ?? 0}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Topic mastery</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted"><tr><th className="py-2 pr-4 font-normal">Topic</th><th className="pr-4 font-normal">Level</th><th className="pr-4 font-normal">Accuracy</th><th className="font-normal">Attempts</th></tr></thead>
            <tbody>
              {mastery.map((m) => (
                <tr key={m.name} className="border-t border-line">
                  <td className="py-2 pr-4">{m.name}</td>
                  <td className="pr-4">{m.level ?? "new"}</td>
                  <td className="pr-4">{m.total ? `${pct(m.correct ?? 0, m.total)}%` : "–"}</td>
                  <td>{m.total ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
