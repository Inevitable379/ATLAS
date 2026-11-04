import { desc, eq } from "drizzle-orm";
import { db, ensureDatabase } from "@/db";
import { preferences } from "@/db/schema";
import { defaultAiModel, defaultGeminiModel } from "@/lib/ai";
import { saveAiSettings } from "../actions";
import AiHealthCheck from "./ai-health-check";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureDatabase();
  const modelRows = await db.select({ value: preferences.value }).from(preferences)
    .where(eq(preferences.key, "ollama_model")).orderBy(desc(preferences.key)).limit(1);
  const model = modelRows[0]?.value ?? defaultAiModel();
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Settings</h1>
        <p className="mt-1 text-muted">Keep ATLAS local-first. AI is optional and never required for reading or practice.</p>
      </header>

      <section className="card space-y-4">
        <div>
          <h2 className="font-serif text-xl">Local AI</h2>
          <p className="mt-1 text-sm text-muted">ATLAS connects to Ollama at <code>127.0.0.1:11434</code> and caches generated article summaries.</p>
        </div>
        <form action={saveAiSettings} className="flex flex-wrap items-end gap-3">
          <label className="min-w-60 flex-1 text-sm">
            <span className="mb-1 block text-muted">Ollama model</span>
            <input className="w-full rounded-md border border-line bg-canvas px-3 py-2" name="model" defaultValue={model} required />
          </label>
          <button className="btn btn-primary" type="submit">Save model</button>
        </form>
        <AiHealthCheck />
        <p className="text-xs text-muted">Recommended for CPU-only machines: <code>qwen2.5:3b</code> or <code>phi3.5</code>. Start Ollama before using the AI buttons.</p>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="font-serif text-xl">Gemini cloud AI</h2>
          <p className="mt-1 text-sm text-muted">Gemini is an optional cloud fallback for stronger summaries and vocabulary definitions. Your key stays in the server environment and is never stored in the database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full px-2.5 py-1 ${geminiConfigured ? "bg-tint text-accent" : "bg-canvas text-muted"}`}>
            {geminiConfigured ? "API key configured" : "API key not configured"}
          </span>
          <span className="text-muted">Model: <code>{defaultGeminiModel()}</code></span>
        </div>
        <AiHealthCheck provider="gemini" />
        <p className="text-xs text-muted">Create a key in <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>, then add <code>GEMINI_API_KEY=…</code> to `.env.local` and restart the dev server.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-serif text-xl">Data backup</h2>
        <p className="text-sm text-muted">Download a JSON copy of your ATLAS data from Supabase.</p>
        <a className="btn" href="/api/backup">Download ATLAS backup</a>
      </section>
    </div>
  );
}
