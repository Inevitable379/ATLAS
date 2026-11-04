# ATLAS

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

ATLAS is a local-first CAT preparation workspace. The current Phase 1 implementation includes:

- A five-lane daily reading dashboard with sample articles and saved/completed/skipped states.
- A distraction-free reader with manual paste fallback, adjustable text size, active reading time, and vocabulary capture.
- QA, DILR, and VARC practice across 35 seeded questions.
- Pre-answer confidence, instant explanations, mistake categorisation, timed sessions, and session summaries.
- Topic mastery levels, section accuracy, and error-type progress views.
- Confidence calibration showing high-confidence misses and low-confidence correct answers.
- Spaced-repetition vocabulary review with Forgot, Hard, Good, and Easy ratings.
- Optional local Ollama summaries and contextual vocabulary definitions.
- Optional Gemini cloud summaries and contextual vocabulary definitions using a server-only API key.
- Gemini-generated CAT RC questions that can be reviewed and added to VARC practice.
- Settings page with Ollama model selection, health check, and database download.
- RSS refresh with deduplication, readable article extraction, and searchable archive.
- A scheduled automation worker that refreshes feeds daily and grows low-inventory practice topics without deleting attempts or history.
- A Supabase PostgreSQL database seeded automatically after its tables are created in Supabase.

The core reading/practice loop requires the configured Supabase database. For local AI, install Ollama separately, pull a small model such as `qwen2.5:3b`, start Ollama, then check it from `/settings`.

For local development, copy `.env.example` to `.env.local`, add the Supabase `DATABASE_URL`, add a key created in [Google AI Studio](https://aistudio.google.com/apikey), and restart the server. ATLAS sends only the article passage or selected vocabulary context to Gemini; neither the database password nor API key is exposed to the browser.

## Commands

```bash
npm run dev       # Start the development server
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript checks
npm run build     # Create a production build
npm run seed      # Create the database and seed it if empty
npm run automate  # Refresh feeds and replenish low-inventory practice topics once
```

The project requires Node 18.18+. Before the first deployment, run the PostgreSQL statements in [`src/db/ddl.ts`](./src/db/ddl.ts) in the Supabase SQL Editor, then run `npm run seed` once with the same `DATABASE_URL`. Runtime requests only verify the tables and never create or seed them, avoiding schema-lock waits on pooled serverless connections.

## Daily automation

The automation is intentionally a one-shot worker so it is safe to run from Windows Task Scheduler. It:

1. Refreshes RSS sources and deduplicates new articles.
2. Finds topics with fewer than three questions that have never been attempted.
3. Generates one batch of five questions for each low-inventory topic through Gemini.
4. Retries temporary Gemini failures after 15 seconds, 1 minute, and 3 minutes.
5. Keeps every existing question and attempt; new questions are appended to the rolling pool.

To schedule it on Windows, open **Task Scheduler**, create a basic daily task, choose a time when the computer is on, and set the action to start `npm` with argument `run automate`. Set **Start in** to the ATLAS repository directory. The task must run from the repository directory so it can load `.env.local` and connect to Supabase.

The worker does not retry forever or bypass quotas. If Gemini is busy or unavailable, RSS refresh still completes and the run records `completed_with_errors`; the next scheduled run tries again.

## Roadmap

The remaining roadmap is richer article/summarisation workflows, PWA offline caching, mobile navigation polish, and keyboard shortcuts.
