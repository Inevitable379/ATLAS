export const DDL = `
CREATE TABLE IF NOT EXISTS domains (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY, domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, sort_order INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE, source_name TEXT NOT NULL,
  category TEXT NOT NULL, author TEXT, content TEXT, summary TEXT, reading_time_min INTEGER DEFAULT 5,
  status TEXT DEFAULT 'unread', discovered_at TEXT DEFAULT CURRENT_TIMESTAMP, opened_at TEXT, completed_at TEXT,
  time_spent_s INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY, domain_id TEXT NOT NULL REFERENCES domains(id), topic_id TEXT REFERENCES topics(id),
  article_id INTEGER REFERENCES articles(id), type TEXT NOT NULL, difficulty TEXT DEFAULT 'medium', passage_text TEXT,
  question_text TEXT NOT NULL, options TEXT, correct_answer TEXT NOT NULL, explanation TEXT NOT NULL,
  source TEXT DEFAULT 'seed', verified INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS practice_sessions (
  id SERIAL PRIMARY KEY, domain_id TEXT NOT NULL REFERENCES domains(id), topic_id TEXT REFERENCES topics(id),
  total_questions INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0, total_time_s INTEGER DEFAULT 0,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);
CREATE TABLE IF NOT EXISTS attempts (
  id SERIAL PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES questions(id),
  session_id INTEGER REFERENCES practice_sessions(id), user_answer TEXT NOT NULL, is_correct INTEGER NOT NULL,
  time_spent_s INTEGER NOT NULL, confidence INTEGER, mistake_type TEXT, attempted_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS topic_mastery (
  topic_id TEXT PRIMARY KEY REFERENCES topics(id), total_attempts INTEGER DEFAULT 0, correct_attempts INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0, best_streak INTEGER DEFAULT 0, avg_time_s DOUBLE PRECISION DEFAULT 0.0,
  last_practiced TEXT, mastery_level TEXT DEFAULT 'new', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS vocabulary (
  id SERIAL PRIMARY KEY, word TEXT NOT NULL, meaning TEXT NOT NULL, context_sentence TEXT, custom_example TEXT,
  article_id INTEGER REFERENCES articles(id), next_review_date TEXT, review_count INTEGER DEFAULT 0,
  ease_factor DOUBLE PRECISION DEFAULT 2.5, interval_days INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS summaries (
  id SERIAL PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id), user_summary TEXT NOT NULL,
  ai_feedback TEXT, score INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rss_sources (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
  is_active INTEGER DEFAULT 1, last_fetched TEXT);
CREATE TABLE IF NOT EXISTS daily_log (
  date TEXT PRIMARY KEY, articles_read INTEGER DEFAULT 0, questions_attempted INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0, vocab_added INTEGER DEFAULT 0, vocab_reviewed INTEGER DEFAULT 0,
  time_spent_s INTEGER DEFAULT 0, summaries_written INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS automation_runs (
  id SERIAL PRIMARY KEY, status TEXT NOT NULL, articles_added INTEGER DEFAULT 0,
  questions_added INTEGER DEFAULT 0, error TEXT, started_at TEXT DEFAULT CURRENT_TIMESTAMP, finished_at TEXT
);
`;
