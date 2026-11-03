import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles, dailyLog, topicMastery, topics } from "@/db/schema";
import { CATEGORIES, today } from "@/lib/utils";
import FeedRefreshButton from "./feed-refresh-button";
import { setArticleStatus, startSession } from "./actions";

export const dynamic = "force-dynamic";

function weakest(domainIds: string[]) {
  const rows = db.select({
    id: topics.id, name: topics.name, domain: topics.domainId,
    attempts: topicMastery.totalAttempts, correct: topicMastery.correctAttempts,
  }).from(topics).leftJoin(topicMastery, eq(topics.id, topicMastery.topicId))
    .where(inArray(topics.domainId, domainIds)).all();
  const score = (r: (typeof rows)[number]) => (r.attempts ? (r.correct ?? 0) / r.attempts : -1); // untouched topics first
  return rows.sort((a, b) => score(a) - score(b))[0];
}

function RecCard({ title, topic, label }: { title: string; topic?: ReturnType<typeof weakest>; label: string }) {
  if (!topic) return null;
  const acc = topic.attempts ? `${Math.round(((topic.correct ?? 0) / topic.attempts) * 100)}% accuracy` : "Not practiced yet";
  return (
    <form action={startSession} className="card flex items-center justify-between gap-4">
      <input type="hidden" name="domain" value={topic.domain} />
      <input type="hidden" name="topic" value={topic.id} />
      <input type="hidden" name="n" value="5" />
      <div>
        <p className="text-sm text-muted">{title}</p>
        <p className="font-serif text-lg">{topic.name}</p>
        <p className="text-sm text-muted">{acc}</p>
      </div>
      <button className="btn btn-primary">{label}</button>
    </form>
  );
}

export default function Dashboard() {
  const last = db.select().from(dailyLog).orderBy(dailyLog.date).all().at(-1);
  const gapDays = last ? Math.floor((Date.parse(today()) - Date.parse(last.date)) / 86400000) : 0;

  const feed = CATEGORIES.map(([key, label]) => ({
    key, label,
    article: db.select().from(articles)
      .where(and(eq(articles.category, key), inArray(articles.status, ["unread", "reading"])))
      .orderBy(desc(articles.discoveredAt), desc(articles.id)).limit(1).get(),
  }));
  const saved = db.select().from(articles).where(eq(articles.status, "saved")).all();
  const qa = weakest(["qa"]);
  const other = weakest(["dilr", "varc"]);

  return (
    <div className="space-y-10">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl">{gapDays >= 3 ? "Welcome back." : "Today"}</h1>
            <p className="mt-1 text-muted">
              {gapDays >= 3 ? "Here is your balanced plan for today." : "Five articles, one from each lane, and two practice sets chosen from your weakest topics."}
            </p>
          </div>
          <FeedRefreshButton />
        </div>
      </header>

      <section aria-labelledby="reading" className="space-y-3">
        <h2 id="reading" className="font-serif text-xl">Reading</h2>
        {feed.map(({ key, label, article }) => (
          <article key={key} className="card">
            <p className="text-sm text-muted">{label}</p>
            {article ? (
              <>
                <h3 className="mt-1 font-serif text-lg">{article.title}</h3>
                <p className="text-sm text-muted">{article.sourceName} · {article.readingTimeMin} min read</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/read/${article.id}`} className="btn btn-primary">Read now</Link>
                  <form action={setArticleStatus.bind(null, article.id, "saved")}><button className="btn">Save for later</button></form>
                  <form action={setArticleStatus.bind(null, article.id, "skipped")}><button className="btn">Skip</button></form>
                  <form action={setArticleStatus.bind(null, article.id, "completed")}><button className="btn">Mark completed</button></form>
                </div>
              </>
            ) : (
              <p className="mt-1 text-muted">No unread articles in this lane. New ones arrive when feed refresh ships in Phase 2.</p>
            )}
          </article>
        ))}
        {saved.length > 0 && (
          <p className="text-sm text-muted">
            Saved for later:{" "}
            {saved.map((s, i) => (
              <span key={s.id}>{i > 0 && ", "}<Link className="underline" href={`/read/${s.id}`}>{s.title}</Link></span>
            ))}
          </p>
        )}
      </section>

      <section aria-labelledby="practice" className="space-y-3">
        <h2 id="practice" className="font-serif text-xl">Recommended practice</h2>
        <RecCard title="Quant set · 5 questions" topic={qa} label="Start set" />
        <RecCard title="DILR / VARC set · 5 questions" topic={other} label="Start set" />
      </section>
    </div>
  );
}
