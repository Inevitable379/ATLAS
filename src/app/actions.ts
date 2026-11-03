"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, attempts, practiceSessions, questions, topicMastery, vocabulary, preferences } from "@/db/schema";
import {
  checkGemini,
  checkOllama,
  defaultAiModel,
  defaultGeminiModel,
  defineVocabulary,
  defineVocabularyWithGemini,
  generateCatQuestionsWithGemini,
  type GeneratedCatQuestion,
  summarizeArticle,
  summarizeArticleWithGemini,
} from "@/lib/ai";
import { refreshFeeds as refreshFeedSources } from "@/lib/feeds";
import { levelFor } from "@/lib/mastery";
import { addDays, today } from "@/lib/utils";

type LogCol = "articles_read" | "questions_attempted" | "questions_correct" | "vocab_added" | "vocab_reviewed" | "time_spent_s";
function configuredAiModel() {
  return db.select({ value: preferences.value }).from(preferences)
    .where(eq(preferences.key, "ollama_model")).get()?.value ?? defaultAiModel();
}

function bumpLog(col: LogCol, n: number) {
  if (!n) return;
  db.run(sql`INSERT INTO daily_log (date, ${sql.raw(col)}) VALUES (${today()}, ${n})
    ON CONFLICT(date) DO UPDATE SET ${sql.raw(col)} = ${sql.raw(col)} + ${n}`);
}

/* ---------- Articles ---------- */
export async function openArticle(id: number) {
  db.update(articles).set({ status: "reading", openedAt: sql`datetime('now')` })
    .where(and(eq(articles.id, id), inArray(articles.status, ["unread", "saved", "reading"]))).run();
}

export async function addReadingTime(id: number, seconds: number) {
  const s = Math.max(0, Math.min(Math.round(seconds), 600));
  if (!s) return;
  db.update(articles).set({ timeSpentS: sql`${articles.timeSpentS} + ${s}` }).where(eq(articles.id, id)).run();
  bumpLog("time_spent_s", s);
}

export async function setArticleStatus(id: number, status: "saved" | "skipped" | "completed" | "unread") {
  const prev = db.select({ s: articles.status }).from(articles).where(eq(articles.id, id)).get();
  db.update(articles).set({
    status,
    completedAt: status === "completed" ? sql`datetime('now')` : null,
  }).where(eq(articles.id, id)).run();
  if (status === "completed" && prev?.s !== "completed") bumpLog("articles_read", 1);
  revalidatePath("/");
}

export async function saveManualContent(id: number, text: string) {
  const clean = text.trim();
  if (!clean) return;
  db.update(articles).set({
    content: clean, readingTimeMin: Math.max(1, Math.round(clean.split(/\s+/).length / 200)),
  }).where(eq(articles.id, id)).run();
  revalidatePath(`/read/${id}`);
}

export async function refreshFeeds() {
  const result = await refreshFeedSources();
  revalidatePath("/");
  revalidatePath("/archive");
  return result;
}

export async function generateArticleSummary(articleId: number) {
  const article = db.select({ content: articles.content, summary: articles.summary })
    .from(articles).where(eq(articles.id, articleId)).get();
  if (!article) throw new Error("Article not found.");
  if (article.summary) return { ok: true as const, summary: article.summary, cached: true };
  const result = await summarizeArticle(article.content ?? "", configuredAiModel());
  if (!result.ok) return result;
  db.update(articles).set({ summary: result.value }).where(eq(articles.id, articleId)).run();
  revalidatePath(`/read/${articleId}`);
  return { ok: true as const, summary: result.value, cached: false };
}

export async function generateGeminiArticleSummary(articleId: number) {
  const article = db.select({ content: articles.content, summary: articles.summary })
    .from(articles).where(eq(articles.id, articleId)).get();
  if (!article) throw new Error("Article not found.");
  const result = await summarizeArticleWithGemini(article.content ?? "", defaultGeminiModel());
  if (!result.ok) return result;
  db.update(articles).set({ summary: result.value }).where(eq(articles.id, articleId)).run();
  revalidatePath(`/read/${articleId}`);
  return { ok: true as const, summary: result.value, cached: false };
}

export async function generateGeminiQuestions(articleId: number) {
  const article = db.select({ content: articles.content }).from(articles)
    .where(eq(articles.id, articleId)).get();
  if (!article) throw new Error("Article not found.");
  return generateCatQuestionsWithGemini(article.content ?? "", defaultGeminiModel());
}

function isGeneratedQuestion(value: unknown): value is GeneratedCatQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<GeneratedCatQuestion>;
  return typeof question.question === "string"
    && question.question.trim().length >= 10
    && Array.isArray(question.options)
    && question.options.length === 4
    && question.options.every((option) => typeof option === "string" && option.trim().length > 0)
    && typeof question.correctAnswer === "string"
    && question.options.includes(question.correctAnswer)
    && typeof question.explanation === "string"
    && question.explanation.trim().length >= 10;
}

export async function saveGeneratedQuestions(articleId: number, generated: unknown) {
  const article = db.select({ content: articles.content }).from(articles)
    .where(eq(articles.id, articleId)).get();
  if (!article) throw new Error("Article not found.");
  if (!Array.isArray(generated) || generated.length !== 3 || !generated.every(isGeneratedQuestion)) {
    throw new Error("Generated questions failed validation and were not saved.");
  }
  db.insert(questions).values(generated.map((question) => ({
    domainId: "varc",
    topicId: "inference",
    articleId,
    type: "mcq",
    difficulty: "hard",
    passageText: article.content,
    questionText: question.question.trim().slice(0, 1_000),
    options: JSON.stringify(question.options.map((option) => option.trim().slice(0, 300))),
    correctAnswer: question.correctAnswer.trim().slice(0, 300),
    explanation: question.explanation.trim().slice(0, 1_000),
    source: "ai_generated",
    verified: 0,
  }))).run();
  revalidatePath("/practice");
  return { saved: generated.length };
}

export async function generateVocabularyDefinition(word: string, context: string) {
  return defineVocabulary(word, context, configuredAiModel());
}

export async function generateGeminiVocabularyDefinition(word: string, context: string) {
  return defineVocabularyWithGemini(word, context, defaultGeminiModel());
}

export async function checkLocalAi() {
  return checkOllama(configuredAiModel());
}

export async function checkGeminiAi() {
  return checkGemini(defaultGeminiModel());
}

export async function saveAiSettings(formData: FormData) {
  const model = String(formData.get("model") ?? "").trim().slice(0, 100);
  if (!model) throw new Error("An Ollama model name is required.");
  db.insert(preferences).values({ key: "ollama_model", value: model })
    .onConflictDoUpdate({ target: preferences.key, set: { value: model } }).run();
  revalidatePath("/settings");
}

/* ---------- Vocabulary ---------- */
export async function saveVocab(input: { word: string; meaning: string; context: string; articleId: number }) {
  const word = input.word.trim().slice(0, 80);
  if (!word) throw new Error("A vocabulary word is required.");
  db.insert(vocabulary).values({
    word, meaning: input.meaning.trim(), contextSentence: input.context.trim().slice(0, 600),
    articleId: input.articleId, nextReviewDate: today(),
  }).run();
  bumpLog("vocab_added", 1);
  revalidatePath("/vocabulary");
}

export async function reviewVocabulary(id: number, rating: "forgot" | "hard" | "good" | "easy") {
  const word = db.select().from(vocabulary).where(eq(vocabulary.id, id)).get();
  if (!word) throw new Error("Vocabulary card not found.");
  const oldEase = word.easeFactor ?? 2.5;
  const oldCount = word.reviewCount ?? 0;
  const oldInterval = word.intervalDays ?? 0;
  let interval: number;
  let ease = oldEase;
  if (rating === "forgot") {
    interval = 1;
    ease = Math.max(1.3, oldEase - 0.2);
  } else if (rating === "hard") {
    interval = Math.max(1, oldInterval || 1);
    ease = Math.max(1.3, oldEase - 0.05);
  } else {
    interval = rating === "easy"
      ? Math.max(1, Math.round((oldInterval || 1) * (oldEase + 0.3)))
      : oldCount === 0 ? 1 : oldCount === 1 ? 3 : oldCount === 2 ? 7 : oldCount === 3 ? 16 : 35;
    ease = rating === "easy" ? oldEase + 0.1 : oldEase;
  }
  db.update(vocabulary).set({
    nextReviewDate: addDays(today(), interval),
    reviewCount: oldCount + 1,
    easeFactor: ease,
    intervalDays: interval,
  }).where(eq(vocabulary.id, id)).run();
  bumpLog("vocab_reviewed", 1);
  revalidatePath("/vocabulary");
}

/* ---------- Practice ---------- */
export async function startSession(formData: FormData) {
  const domain = String(formData.get("domain"));
  const topic = String(formData.get("topic") ?? "") || null;
  const requested = Number(formData.get("n") ?? 5);
  const n = Math.min(Math.max(Number.isFinite(requested) ? Math.round(requested) : 5, 1), 15);
  const where = topic ? and(eq(questions.domainId, domain), eq(questions.topicId, topic)) : eq(questions.domainId, domain);
  const rows = db.select({
    id: questions.id,
    seen: sql<number>`(SELECT COUNT(*) FROM attempts a WHERE a.question_id = ${questions.id})`,
  }).from(questions).where(where).all();
  if (!rows.length) redirect("/practice");
  rows.sort((a, b) => a.seen - b.seen || Math.random() - 0.5); // least-practiced first
  const ids = rows.slice(0, n).map((r) => r.id);
  const s = db.insert(practiceSessions).values({ domainId: domain, topicId: topic })
    .returning({ id: practiceSessions.id }).get();
  redirect(`/practice/s/${s.id}?q=${ids.join(",")}`);
}

export async function submitAttempt(input: {
  questionId: number; sessionId: number; answer: string; timeSpent: number; confidence: number | null;
}) {
  const q = db.select().from(questions).where(eq(questions.id, input.questionId)).get();
  if (!q) throw new Error("Question not found");
  const session = db.select().from(practiceSessions).where(eq(practiceSessions.id, input.sessionId)).get();
  if (!session) throw new Error("Practice session not found");
  if (session.domainId !== q.domainId || (session.topicId && session.topicId !== q.topicId)) {
    throw new Error("Question does not belong to this practice session");
  }
  const priorAttempt = db.select({ id: attempts.id }).from(attempts)
    .where(and(eq(attempts.questionId, q.id), eq(attempts.sessionId, input.sessionId))).get();
  if (priorAttempt) throw new Error("Question has already been submitted in this session");
  if (input.confidence !== null && (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 5)) {
    throw new Error("Confidence must be between 1 and 5");
  }
  if (typeof input.answer !== "string" || !Number.isFinite(input.timeSpent) || input.timeSpent < 0) {
    throw new Error("Invalid practice response");
  }
  const given = input.answer.trim();
  const isCorrect = q.type === "numeric"
    ? given !== "" && Number(given) === Number(q.correctAnswer)
    : given === q.correctAnswer;
  const time = Math.max(0, Math.round(input.timeSpent));

  const a = db.insert(attempts).values({
    questionId: q.id, sessionId: input.sessionId, userAnswer: given, isCorrect: isCorrect ? 1 : 0,
    timeSpentS: time, confidence: input.confidence, mistakeType: isCorrect ? "none" : null,
  }).returning({ id: attempts.id }).get();

  db.update(practiceSessions).set({
    totalQuestions: sql`${practiceSessions.totalQuestions} + 1`,
    correctCount: sql`${practiceSessions.correctCount} + ${isCorrect ? 1 : 0}`,
    totalTimeS: sql`${practiceSessions.totalTimeS} + ${time}`,
  }).where(eq(practiceSessions.id, input.sessionId)).run();

  if (q.topicId) {
    const m = db.select().from(topicMastery).where(eq(topicMastery.topicId, q.topicId)).get();
    const total = (m?.totalAttempts ?? 0) + 1;
    const correct = (m?.correctAttempts ?? 0) + (isCorrect ? 1 : 0);
    const streak = isCorrect ? (m?.currentStreak ?? 0) + 1 : 0;
    const row = {
      topicId: q.topicId, totalAttempts: total, correctAttempts: correct, currentStreak: streak,
      bestStreak: Math.max(m?.bestStreak ?? 0, streak),
      avgTimeS: ((m?.avgTimeS ?? 0) * (total - 1) + time) / total,
      lastPracticed: today(), masteryLevel: levelFor(total, correct, streak),
      updatedAt: sql`datetime('now')`,
    };
    db.insert(topicMastery).values(row).onConflictDoUpdate({ target: topicMastery.topicId, set: row }).run();
  }
  bumpLog("questions_attempted", 1);
  bumpLog("questions_correct", isCorrect ? 1 : 0);
  bumpLog("time_spent_s", time);
  return { attemptId: a.id, isCorrect, correctAnswer: q.correctAnswer, explanation: q.explanation };
}

export async function tagMistake(attemptId: number, type: string) {
  if (!["conceptual", "careless", "misread", "time_pressure"].includes(type)) return;
  db.update(attempts).set({ mistakeType: type }).where(eq(attempts.id, attemptId)).run();
}

export async function finishSession(sessionId: number) {
  db.update(practiceSessions).set({ completedAt: sql`datetime('now')` })
    .where(and(eq(practiceSessions.id, sessionId), sql`${practiceSessions.completedAt} IS NULL`)).run();
  revalidatePath("/progress");
  revalidatePath("/");
}
