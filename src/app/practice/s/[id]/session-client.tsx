"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { finishSession, submitAttempt, tagMistake } from "../../../actions";
import { MISTAKES, pct } from "@/lib/utils";

type Q = { id: number; type: "mcq" | "numeric"; passage: string | null; text: string; options: string[] };
type Result = { attemptId: number; isCorrect: boolean; correctAnswer: string; explanation: string };
type Done = { isCorrect: boolean; time: number; mistake: string | null };

export default function SessionClient({ sessionId, questions }: { sessionId: number; questions: Q[] }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [mistake, setMistake] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [busy, setBusy] = useState(false);
  const started = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const finished = i >= questions.length;

  useEffect(() => {
    if (!started.current) started.current = Date.now();
  }, []);
  useEffect(() => {
    if (result || finished) return;
    if (!started.current) started.current = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [result, finished, i]);
  useEffect(() => { if (finished) finishSession(sessionId); }, [finished, sessionId]);

  const q = questions[i];
  async function submit() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    const time = Math.round((Date.now() - started.current) / 1000);
    setResult(await submitAttempt({ questionId: q.id, sessionId, answer, timeSpent: time, confidence }));
    setElapsed(time);
    setBusy(false);
  }
  async function tag(type: string) {
    if (!result) return;
    setMistake(type);
    await tagMistake(result.attemptId, type);
  }
  function next() {
    setDone((d) => [...d, { isCorrect: result!.isCorrect, time: elapsed, mistake }]);
    setI(i + 1); setAnswer(""); setConfidence(null); setResult(null); setMistake(null);
    started.current = Date.now(); setElapsed(0);
  }

  if (finished) {
    const correct = done.filter((d) => d.isCorrect).length;
    const total = done.reduce((s, d) => s + d.time, 0);
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-serif text-3xl">Session summary</h1>
        <div className="grid grid-cols-3 gap-3">
          <div className="card"><p className="text-sm text-muted">Accuracy</p><p className="font-serif text-2xl">{pct(correct, done.length)}%</p><p className="text-sm text-muted">{correct} of {done.length}</p></div>
          <div className="card"><p className="text-sm text-muted">Total time</p><p className="font-serif text-2xl">{Math.floor(total / 60)}m {total % 60}s</p></div>
          <div className="card"><p className="text-sm text-muted">Per question</p><p className="font-serif text-2xl">{done.length ? Math.round(total / done.length) : 0}s</p></div>
        </div>
        <div className="card">
          <h2 className="font-serif text-lg">Why you missed marks</h2>
          {done.some((d) => !d.isCorrect) ? (
            <ul className="mt-2 space-y-1 text-sm">
              {[...MISTAKES, { id: "untagged", label: "Not tagged", hint: "" }].map((m) => {
                const n = done.filter((d) => !d.isCorrect && (d.mistake ?? "untagged") === m.id).length;
                return n ? <li key={m.id}>{m.label}: {n}</li> : null;
              })}
            </ul>
          ) : <p className="mt-2 text-muted">No mistakes this session.</p>}
        </div>
        <div className="flex gap-2"><Link href="/practice" className="btn btn-primary">Back to practice</Link><Link href="/progress" className="btn">See progress</Link></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Question {i + 1} of {questions.length}</span>
        <span aria-live="off">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
      </div>
      {q.passage && <div className="card whitespace-pre-line font-serif leading-relaxed">{q.passage}</div>}
      <p className="whitespace-pre-line text-lg">{q.text}</p>

      {q.type === "mcq" ? (
        <div className="space-y-2" role="radiogroup" aria-label="Answer options">
          {q.options.map((o, k) => {
            const selected = answer === o;
            const state = result
              ? (o === result.correctAnswer ? "border-accent bg-tint" : selected ? "border-danger bg-red-50 text-red-950" : "border-line")
              : selected ? "border-ink bg-ink text-canvas shadow-sm" : "border-line bg-surface hover:border-ink hover:bg-tint";
            return (
              <button key={o} role="radio" aria-checked={answer === o} disabled={!!result} onClick={() => setAnswer(o)}
                className={`block w-full rounded-md border px-4 py-2.5 text-left ${state}`}>
                <span className={`mr-2 ${selected && !result ? "text-canvas/70" : "text-muted"}`}>{String.fromCharCode(65 + k)}.</span>{o}
              </button>
            );
          })}
        </div>
      ) : (
        <input inputMode="decimal" className="w-48 rounded-md border border-line bg-surface px-3 py-2" placeholder="Your answer" value={answer}
          disabled={!!result} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      )}

      {!result && (
        <>
          <fieldset className="text-sm">
            <legend className="text-muted">Confidence before answering (optional)</legend>
            <div className="mt-1 flex gap-2">
              {[1, 2, 3, 4, 5].map((c) => (
                <button key={c} onClick={() => setConfidence(confidence === c ? null : c)} aria-pressed={confidence === c}
                  className={`btn ${confidence === c ? "border-accent bg-tint" : ""}`}>{c}</button>
              ))}
              <span className="self-center text-muted">1 = guess · 3 = reasonable · 5 = certain</span>
            </div>
          </fieldset>
          <button className="btn btn-primary" onClick={submit} disabled={!answer.trim() || busy}>Check answer</button>
        </>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`card ${result.isCorrect ? "border-accent" : "border-danger"}`}>
            <p className="font-medium">{result.isCorrect ? "Correct" : `Incorrect. The answer is ${result.correctAnswer}.`}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{result.explanation}</p>
          </div>
          {!result.isCorrect && (
            <fieldset>
              <legend className="mb-2 text-sm text-muted">What went wrong?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MISTAKES.map((m) => (
                  <button key={m.id} onClick={() => tag(m.id)} aria-pressed={mistake === m.id}
                    className={`rounded-md border px-3 py-2 text-left text-sm ${mistake === m.id ? "border-accent bg-tint" : "border-line"}`}>
                    <span className="font-medium">{m.label}</span><br /><span className="text-muted">{m.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <button className="btn btn-primary" onClick={next}>{i + 1 === questions.length ? "Finish session" : "Next question"}</button>
        </div>
      )}
    </div>
  );
}
