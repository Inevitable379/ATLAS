import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as s from "./schema";
import { DOMAINS, TOPICS, QUESTIONS, SAMPLE_ARTICLES } from "./seed-data";

export const RSS_SOURCES = [
  ["Livemint", "https://www.livemint.com/rss/economy", "business"],
  ["Finshots", "https://finshots.in/feed/", "business"],
  ["The Hindu Editorial", "https://www.thehindu.com/opinion/editorial/feeder/default.rss", "editorial"],
  ["Indian Express", "https://indianexpress.com/section/opinion/editorials/feed/", "editorial"],
  ["BBC World", "http://feeds.bbci.co.uk/news/world/rss.xml", "world"],
  ["Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "world"],
  ["Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", "science"],
  ["Down To Earth", "https://www.downtoearth.org.in/rss/", "science"],
  ["Scroll.in", "https://scroll.in/feed", "society"],
  ["The Wire", "https://thewire.in/feed", "society"],
] as const;

export async function seedIfEmpty(db: PostgresJsDatabase<typeof s>) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('atlas-seed'))`);
    const existing = await tx.select({ id: s.domains.id }).from(s.domains).limit(1);
    if (existing.length > 0) return;
    await tx.insert(s.domains).values(DOMAINS);
    await tx.insert(s.topics).values(TOPICS);
    await tx.insert(s.rssSources).values(RSS_SOURCES.map(([name, url, category]) => ({ name, url, category })));
    await tx.insert(s.questions).values(QUESTIONS.map((q) => ({
      domainId: q.domain, topicId: q.topic, type: q.type, difficulty: q.difficulty,
      passageText: q.passage ?? null, questionText: q.q,
      options: q.options ? JSON.stringify(q.options) : null,
      correctAnswer: q.answer, explanation: q.explanation, source: "seed", verified: 1,
    })));
    await tx.insert(s.articles).values(SAMPLE_ARTICLES.map((a, i) => ({
      title: a.title, url: `atlas://sample/${i + 1}`, sourceName: a.source, category: a.category,
      author: a.author, content: a.content,
      readingTimeMin: Math.max(1, Math.round(a.content.split(/\s+/).length / 200)),
    })));
  });
}
