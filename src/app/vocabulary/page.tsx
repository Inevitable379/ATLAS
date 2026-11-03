import { desc } from "drizzle-orm";
import { db } from "@/db";
import { vocabulary } from "@/db/schema";
import { today } from "@/lib/utils";
import ReviewClient from "./review-client";

export const dynamic = "force-dynamic";

export default function Vocabulary() {
  const words = db.select().from(vocabulary).orderBy(desc(vocabulary.id)).all();
  const due = words.filter((word) => !word.nextReviewDate || word.nextReviewDate <= today());
  const cards = due.map((word) => ({
    id: word.id,
    word: word.word,
    meaning: word.meaning,
    context: word.contextSentence,
    reviewCount: word.reviewCount ?? 0,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Vocabulary</h1>
        <p className="mt-1 text-muted">{words.length} saved · {due.length} due for review today.</p>
      </header>
      {words.length === 0 && <p className="text-muted">Nothing saved yet. Select a word while reading an article to add it here.</p>}
      {cards.length > 0 && <ReviewClient cards={cards} />}
      {words.length > 0 && due.length === 0 && <p className="text-muted">You are caught up. Come back when the next cards are due.</p>}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">All saved words</h2>
        <ul className="space-y-3">
          {words.map((w) => (
            <li key={w.id} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-lg">{w.word}</p>
                <p className="text-xs text-muted">{w.nextReviewDate ? `Next review: ${w.nextReviewDate}` : "Due now"}</p>
              </div>
              {w.meaning && <p className="text-sm">{w.meaning}</p>}
              {w.contextSentence && <p className="mt-1 text-sm italic text-muted">{w.contextSentence}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
