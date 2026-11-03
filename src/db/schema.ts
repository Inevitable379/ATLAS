import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(datetime('now'))`;

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0),
});

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  domainId: text("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  sourceName: text("source_name").notNull(),
  category: text("category").notNull(),
  author: text("author"),
  content: text("content"),
  summary: text("summary"),
  readingTimeMin: integer("reading_time_min").default(5),
  status: text("status").default("unread"),
  discoveredAt: text("discovered_at").default(now),
  openedAt: text("opened_at"),
  completedAt: text("completed_at"),
  timeSpentS: integer("time_spent_s").default(0),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domainId: text("domain_id").notNull().references(() => domains.id),
  topicId: text("topic_id").references(() => topics.id),
  articleId: integer("article_id").references(() => articles.id),
  type: text("type").notNull(),
  difficulty: text("difficulty").default("medium"),
  passageText: text("passage_text"),
  questionText: text("question_text").notNull(),
  options: text("options"),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation").notNull(),
  source: text("source").default("seed"),
  verified: integer("verified").default(0),
  createdAt: text("created_at").default(now),
});

export const practiceSessions = sqliteTable("practice_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domainId: text("domain_id").notNull().references(() => domains.id),
  topicId: text("topic_id").references(() => topics.id),
  totalQuestions: integer("total_questions").default(0),
  correctCount: integer("correct_count").default(0),
  totalTimeS: integer("total_time_s").default(0),
  startedAt: text("started_at").default(now),
  completedAt: text("completed_at"),
});

export const attempts = sqliteTable("attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: integer("question_id").notNull().references(() => questions.id),
  sessionId: integer("session_id").references(() => practiceSessions.id),
  userAnswer: text("user_answer").notNull(),
  isCorrect: integer("is_correct").notNull(),
  timeSpentS: integer("time_spent_s").notNull(),
  confidence: integer("confidence"),
  mistakeType: text("mistake_type"),
  attemptedAt: text("attempted_at").default(now),
});

export const topicMastery = sqliteTable("topic_mastery", {
  topicId: text("topic_id").primaryKey().references(() => topics.id),
  totalAttempts: integer("total_attempts").default(0),
  correctAttempts: integer("correct_attempts").default(0),
  currentStreak: integer("current_streak").default(0),
  bestStreak: integer("best_streak").default(0),
  avgTimeS: real("avg_time_s").default(0),
  lastPracticed: text("last_practiced"),
  masteryLevel: text("mastery_level").default("new"),
  updatedAt: text("updated_at").default(now),
});

export const vocabulary = sqliteTable("vocabulary", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  contextSentence: text("context_sentence"),
  customExample: text("custom_example"),
  articleId: integer("article_id").references(() => articles.id),
  nextReviewDate: text("next_review_date"),
  reviewCount: integer("review_count").default(0),
  easeFactor: real("ease_factor").default(2.5),
  intervalDays: integer("interval_days").default(0),
  createdAt: text("created_at").default(now),
});

export const summaries = sqliteTable("summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").notNull().references(() => articles.id),
  userSummary: text("user_summary").notNull(),
  aiFeedback: text("ai_feedback"),
  score: integer("score"),
  createdAt: text("created_at").default(now),
});

export const rssSources = sqliteTable("rss_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  category: text("category").notNull(),
  isActive: integer("is_active").default(1),
  lastFetched: text("last_fetched"),
});

export const dailyLog = sqliteTable("daily_log", {
  date: text("date").primaryKey(),
  articlesRead: integer("articles_read").default(0),
  questionsAttempted: integer("questions_attempted").default(0),
  questionsCorrect: integer("questions_correct").default(0),
  vocabAdded: integer("vocab_added").default(0),
  vocabReviewed: integer("vocab_reviewed").default(0),
  timeSpentS: integer("time_spent_s").default(0),
  summariesWritten: integer("summaries_written").default(0),
});

export const preferences = sqliteTable("preferences", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const automationRuns = sqliteTable("automation_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull(),
  articlesAdded: integer("articles_added").default(0),
  questionsAdded: integer("questions_added").default(0),
  error: text("error"),
  startedAt: text("started_at").default(now),
  finishedAt: text("finished_at"),
});
