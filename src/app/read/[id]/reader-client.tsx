"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addReadingTime, generateArticleSummary, generateGeminiArticleSummary, generateGeminiQuestions, generateGeminiVocabularyDefinition, generateVocabularyDefinition, openArticle, saveGeneratedQuestions, saveManualContent, saveVocab, setArticleStatus } from "../../actions";
import type { GeneratedCatQuestion } from "@/lib/ai";

type A = { id: number; title: string; source: string; author: string | null; content: string | null; summary: string | null; url: string | null; readingTime: number };

export default function ReaderClient({ article }: { article: A }) {
  const router = useRouter();
  const [size, setSize] = useState(19);
  const [sel, setSel] = useState<{ word: string; context: string } | null>(null);
  const [meaning, setMeaning] = useState("");
  const [toast, setToast] = useState("");
  const [paste, setPaste] = useState("");
  const [summary, setSummary] = useState(article.summary);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedCatQuestion[]>([]);
  const [questionsSaved, setQuestionsSaved] = useState(false);
  const pending = useRef(0);

  // Reading timer: counts only while the tab is visible.
  useEffect(() => {
    openArticle(article.id);
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") pending.current += 1;
      if (pending.current >= 20) flush();
    }, 1000);
    const flush = () => { const s = pending.current; pending.current = 0; if (s) addReadingTime(article.id, s); };
    const onVis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", onVis); flush(); };
  }, [article.id]);

  function captureSelection() {
    const s = window.getSelection();
    const text = s?.toString().trim() ?? "";
    if (!s || !text || text.length > 80) return setSel(null);
    const para = s.anchorNode?.parentElement?.closest("p")?.textContent ?? text;
    const sentence = para.split(/(?<=[.!?])\s+/).find((x) => x.includes(text)) ?? para;
    setSel({ word: text, context: sentence });
    setMeaning("");
  }

  async function save() {
    if (!sel) return;
    await saveVocab({ word: sel.word, meaning, context: sel.context, articleId: article.id });
    setToast(`Saved “${sel.word}” to vocabulary`);
    setSel(null);
    setTimeout(() => setToast(""), 2500);
  }

  async function defineWithAi(provider: "local" | "gemini") {
    if (!sel) return;
    setAiBusy(true);
    setAiError("");
    try {
      const result = provider === "gemini"
        ? await generateGeminiVocabularyDefinition(sel.word, sel.context)
        : await generateVocabularyDefinition(sel.word, sel.context);
      if (!result.ok) {
        setAiError(result.error);
      } else {
        setMeaning(`${result.value.definition} Example: ${result.value.example}`);
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function summarize(provider: "local" | "gemini") {
    setAiBusy(true);
    setAiError("");
    try {
      const result = provider === "gemini"
        ? await generateGeminiArticleSummary(article.id)
        : await generateArticleSummary(article.id);
      if (!result.ok) setAiError(result.error);
      else setSummary(result.summary);
    } finally {
      setAiBusy(false);
    }
  }

  async function generateQuestions() {
    setAiBusy(true);
    setAiError("");
    setGeneratedQuestions([]);
    setQuestionsSaved(false);
    try {
      const result = await generateGeminiQuestions(article.id);
      if (!result.ok) setAiError(result.error);
      else setGeneratedQuestions(result.value);
    } finally {
      setAiBusy(false);
    }
  }

  async function saveQuestions() {
    setAiBusy(true);
    setAiError("");
    try {
      await saveGeneratedQuestions(article.id, generatedQuestions);
      setQuestionsSaved(true);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Questions could not be saved.");
    } finally {
      setAiBusy(false);
    }
  }

  async function finish(status: "completed" | "saved" | "skipped") {
    await setArticleStatus(article.id, status);
    router.push("/");
  }

  const paragraphs = article.content?.split(/\n{2,}/).filter(Boolean) ?? [];
  return (
    <article className="mx-auto mt-4 max-w-[70ch]">
      <h1 className="font-serif text-3xl leading-tight">{article.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {article.source}{article.author ? ` · ${article.author}` : ""} · {article.readingTime} min read
        {article.url && <> · <a className="underline" href={article.url} target="_blank" rel="noreferrer">Read on original site</a></>}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn" type="button" onClick={() => summarize("local")} disabled={aiBusy || Boolean(summary)}>
          {summary ? "AI summary saved" : aiBusy ? "Thinking…" : "Summarize locally"}
        </button>
        <button className="btn" type="button" onClick={() => summarize("gemini")} disabled={aiBusy}>
          {aiBusy ? "Thinking…" : "Summarize with Gemini"}
        </button>
        <button className="btn" type="button" onClick={generateQuestions} disabled={aiBusy}>
          {aiBusy ? "Generating…" : "Generate CAT questions"}
        </button>
        {aiError && <p className="text-sm text-danger" role="status">{aiError}</p>}
      </div>
      {summary && (
        <aside className="card mt-4 border-accent bg-tint">
          <p className="text-sm font-medium text-accent">Local AI summary</p>
          <p className="mt-1 text-sm leading-relaxed">{summary}</p>
        </aside>
      )}
      {generatedQuestions.length > 0 && (
        <section className="card mt-4 space-y-4 border-accent">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl">Generated CAT questions</h2>
              <p className="text-sm text-muted">Review these before adding them to VARC practice.</p>
            </div>
            {!questionsSaved && <button className="btn btn-primary" type="button" onClick={saveQuestions} disabled={aiBusy}>Add to practice</button>}
            {questionsSaved && <span className="text-sm text-accent">Added to VARC practice</span>}
          </div>
          <div className="space-y-4">
            {generatedQuestions.map((question, index) => (
              <article key={`${question.question}-${index}`} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                <p className="font-medium">{index + 1}. {question.question}</p>
                <ol className="mt-2 list-[upper-alpha] space-y-1 pl-6 text-sm">
                  {question.options.map((option) => <li key={option}>{option}{option === question.correctAnswer && <span className="ml-2 text-accent">(answer)</span>}</li>)}
                </ol>
                <p className="mt-2 text-sm text-muted">{question.explanation}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="mt-3 flex items-center gap-2 text-sm text-muted">
        Text size
        <button className="btn" onClick={() => setSize((s) => Math.max(15, s - 1))} aria-label="Smaller text">A−</button>
        <button className="btn" onClick={() => setSize((s) => Math.min(26, s + 1))} aria-label="Larger text">A+</button>
        <span>Select a word or phrase to save it.</span>
      </div>

      {paragraphs.length ? (
        <div className="prose-reader mt-6" style={{ fontSize: size }} onMouseUp={captureSelection} onKeyUp={captureSelection}>
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      ) : (
        <div className="card mt-6 space-y-3">
          <p>This article couldn’t be extracted. Paste the text here to read and analyze it.</p>
          <textarea className="h-48 w-full rounded-md border border-line bg-canvas p-3" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="btn btn-primary" onClick={() => saveManualContent(article.id, paste).then(() => router.refresh())}>Use this text</button>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-4">
        <button className="btn btn-primary" onClick={() => finish("completed")}>Mark completed</button>
        <button className="btn" onClick={() => finish("saved")}>Save for later</button>
        <button className="btn" onClick={() => finish("skipped")}>Skip</button>
      </div>

      {sel && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-3 shadow-lg" role="dialog" aria-label="Save to vocabulary">
          <div className="mx-auto flex max-w-[70ch] flex-wrap items-center gap-2">
            <strong className="font-serif">“{sel.word}”</strong>
            <input className="min-w-40 flex-1 rounded-md border border-line bg-canvas px-2 py-1.5 text-sm" placeholder="Meaning (optional)"
              value={meaning} onChange={(e) => setMeaning(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
            <button className="btn btn-primary" onClick={save}>Save word</button>
            <button className="btn" onClick={() => defineWithAi("local")} disabled={aiBusy}>
              {aiBusy ? "Defining…" : "Define with AI"}
            </button>
            <button className="btn" onClick={() => defineWithAi("gemini")} disabled={aiBusy}>Define with Gemini</button>
            <button className="btn" onClick={() => setSel(null)}>Cancel</button>
          </div>
          {aiError && <p className="mx-auto mt-2 max-w-[70ch] text-sm text-danger" role="status">{aiError}</p>}
        </div>
      )}
      {toast && <p role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-accent px-3 py-2 text-sm text-canvas">{toast}</p>}
    </article>
  );
}
