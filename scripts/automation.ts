import { loadEnvConfig } from "@next/env";
import { and, eq, sql } from "drizzle-orm";
import { db, ensureDatabase } from "../src/db";
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

async function unusedQuestionCount(topicId: string) {
  const rows = await db.select({
    count: sql<number>`coalesce(sum(case when ${attempts.id} is null then 1 else 0 end), 0)`,
  }).from(questions)
    .leftJoin(attempts, eq(attempts.questionId, questions.id))
    .where(eq(questions.topicId, topicId));
  return rows[0]?.count ?? 0;
}

async function existingQuestionTexts(topicId: string) {
  return new Set(
    (await db.select({ text: questions.questionText }).from(questions)
      .where(eq(questions.topicId, topicId)))
      .map((question) => question.text.trim().toLowerCase()),
  );
}

async function addQuestions(topic: typeof topics.$inferSelect, generated: GeneratedPracticeQuestion[], passage: typeof articles.$inferSelect | undefined) {
  const existing = await existingQuestionTexts(topic.id);
  const fresh = generated.filter((question) => {
    const key = question.question.trim().toLowerCase();
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  if (!fresh.length) return 0;

  await db.insert(questions).values(fresh.map((question) => ({
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
  })));
  return fresh.length;
}

async function main() {
  await ensureDatabase();
  if (dryRun) {
    const allTopics = await db.select().from(topics);
    const topicsToRefresh = [];
    for (const topic of allTopics) {
      if (await unusedQuestionCount(topic.id) < MIN_UNUSED_QUESTIONS) topicsToRefresh.push(topic);
    }
    console.log(JSON.stringify({
      status: "dry_run",
      topics: topicsToRefresh.map((topic) => topic.name),
    }));
    return;
  }
  const [run] = await db.insert(automationRuns).values({ status: "running" })
    .returning({ id: automationRuns.id });
  let articlesAdded = 0;
  let questionsAdded = 0;
  try {
    const feedResult = await refreshFeeds();
    articlesAdded = feedResult.added;
    const errors = feedResult.failures.map((failure) => `${failure.source}: ${failure.error}`);
    const allTopics = await db.select().from(topics);
    const topicsToRefresh = [];
    for (const topic of allTopics) {
      if (await unusedQuestionCount(topic.id) < MIN_UNUSED_QUESTIONS) topicsToRefresh.push(topic);
    }
    const latestArticleRows = await db.select().from(articles)
      .where(and(eq(articles.status, "unread"), sql`${articles.content} is not null`))
      .orderBy(sql`${articles.discoveredAt} desc`).limit(1);
    const latestArticle = latestArticleRows[0];

    for (const topic of topicsToRefresh) {
      const passage = topic.domainId === "varc" && topic.id === "inference" ? latestArticle : undefined;
      const result = await generateWithRetry(topic, passage?.content ?? "");
      if (!result.ok) {
        console.warn(`Skipped ${topic.name}: ${result.error}`);
        errors.push(`${topic.name}: ${result.error}`);
        continue;
      }
      questionsAdded += await addQuestions(topic, result.value, passage);
    }

    await db.update(automationRuns).set({
      status: errors.length ? "completed_with_errors" : "completed",
      articlesAdded,
      questionsAdded,
      error: errors.length ? errors.join(" | ").slice(0, 500) : null,
      finishedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(automationRuns.id, run.id));
    console.log(JSON.stringify({
      status: errors.length ? "completed_with_errors" : "completed",
      articlesAdded,
      questionsAdded,
      errors,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(automationRuns).set({
      status: "failed",
      articlesAdded,
      questionsAdded,
      error: message.slice(0, 500),
      finishedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(automationRuns.id, run.id));
    console.error(`ATLAS automation failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
