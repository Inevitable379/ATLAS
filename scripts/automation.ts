import { loadEnvConfig } from "@next/env";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { articles, automationRuns, attempts, questions, topics } from "../src/db/schema";
import { generatePracticeQuestionsWithGemini, type GeneratedPracticeQuestion } from "../src/lib/ai";
import { refreshFeeds } from "../src/lib/feeds";

loadEnvConfig(process.cwd());

const MIN_UNUSED_QUESTIONS = 3;
const RETRY_DELAYS_MS = [15_000, 60_000, 180_000];
const dryRun = process.argv.includes("--dry-run");
const domainNames: Record<string, string> = {
  qa: "Quantitative Ability",
  dilr: "Data Interpretation & Logical Reasoning",
  varc: "Verbal Ability & Reading Comprehension",
};

function isRetryable(error: string) {
  return /HTTP (408|429|500|502|503|504)|timed out|timeout|temporarily|unavailable|high demand/i.test(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(topic: typeof topics.$inferSelect, passage: string) {
  let result = await generatePracticeQuestionsWithGemini(
    domainNames[topic.domainId] ?? topic.domainId,
    topic.name,
    passage,
  );
  for (let attempt = 0; !result.ok && attempt < RETRY_DELAYS_MS.length && isRetryable(result.error); attempt += 1) {
    await sleep(RETRY_DELAYS_MS[attempt]);
    result = await generatePracticeQuestionsWithGemini(
      domainNames[topic.domainId] ?? topic.domainId,
      topic.name,
      passage,
    );
  }
  return result;
}

function unusedQuestionCount(topicId: string) {
  return db.select({
    count: sql<number>`coalesce(sum(case when ${attempts.id} is null then 1 else 0 end), 0)`,
  }).from(questions)
    .leftJoin(attempts, eq(attempts.questionId, questions.id))
    .where(eq(questions.topicId, topicId))
    .get()?.count ?? 0;
}

function existingQuestionTexts(topicId: string) {
  return new Set(
    db.select({ text: questions.questionText }).from(questions)
      .where(eq(questions.topicId, topicId)).all()
      .map((question) => question.text.trim().toLowerCase()),
  );
}

function addQuestions(topic: typeof topics.$inferSelect, generated: GeneratedPracticeQuestion[], passage: typeof articles.$inferSelect | undefined) {
  const existing = existingQuestionTexts(topic.id);
  const fresh = generated.filter((question) => {
    const key = question.question.trim().toLowerCase();
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  if (!fresh.length) return 0;

  db.insert(questions).values(fresh.map((question) => ({
    domainId: topic.domainId,
    topicId: topic.id,
    articleId: passage?.id ?? null,
    type: "mcq",
    difficulty: "medium",
    passageText: passage?.content ?? null,
    questionText: question.question,
    options: JSON.stringify(question.options),
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    source: "ai_generated",
    verified: 0,
  }))).run();
  return fresh.length;
}

async function main() {
  if (dryRun) {
    const topicsToRefresh = db.select().from(topics).all()
      .filter((topic) => unusedQuestionCount(topic.id) < MIN_UNUSED_QUESTIONS);
    console.log(JSON.stringify({
      status: "dry_run",
      topics: topicsToRefresh.map((topic) => topic.name),
    }));
    return;
  }
  const run = db.insert(automationRuns).values({ status: "running" })
    .returning({ id: automationRuns.id }).get();
  let articlesAdded = 0;
  let questionsAdded = 0;
  try {
    const feedResult = await refreshFeeds();
    articlesAdded = feedResult.added;
    const errors = feedResult.failures.map((failure) => `${failure.source}: ${failure.error}`);
    const topicsToRefresh = db.select().from(topics).all()
      .filter((topic) => unusedQuestionCount(topic.id) < MIN_UNUSED_QUESTIONS);
    const latestArticle = db.select().from(articles)
      .where(and(eq(articles.status, "unread"), sql`${articles.content} is not null`))
      .orderBy(sql`${articles.discoveredAt} desc`).limit(1).get();

    for (const topic of topicsToRefresh) {
      const passage = topic.domainId === "varc" && topic.id === "inference" ? latestArticle : undefined;
      const result = await generateWithRetry(topic, passage?.content ?? "");
      if (!result.ok) {
        console.warn(`Skipped ${topic.name}: ${result.error}`);
        errors.push(`${topic.name}: ${result.error}`);
        continue;
      }
      questionsAdded += addQuestions(topic, result.value, passage);
    }

    db.update(automationRuns).set({
      status: errors.length ? "completed_with_errors" : "completed",
      articlesAdded,
      questionsAdded,
      error: errors.length ? errors.join(" | ").slice(0, 500) : null,
      finishedAt: sql`datetime('now')`,
    }).where(eq(automationRuns.id, run.id)).run();
    console.log(JSON.stringify({
      status: errors.length ? "completed_with_errors" : "completed",
      articlesAdded,
      questionsAdded,
      errors,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    db.update(automationRuns).set({
      status: "failed",
      articlesAdded,
      questionsAdded,
      error: message.slice(0, 500),
      finishedAt: sql`datetime('now')`,
    }).where(eq(automationRuns.id, run.id)).run();
    console.error(`ATLAS automation failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
