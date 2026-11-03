"use client";

import { useState } from "react";
import { reviewVocabulary } from "../actions";

type Card = { id: number; word: string; meaning: string; context: string | null; reviewCount: number };
type Rating = "forgot" | "hard" | "good" | "easy";

export default function ReviewClient({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const card = cards[index];

  async function rate(rating: Rating) {
    if (!card || busy) return;
    setBusy(true);
    await reviewVocabulary(card.id, rating);
    setBusy(false);
    setFlipped(false);
    setIndex((value) => value + 1);
  }

  if (!card) return <div className="card border-accent bg-tint"><p className="font-medium">Review complete.</p><p className="mt-1 text-sm">Your next intervals have been saved.</p></div>;

  return (
    <section className="card space-y-4 border-accent">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Review {index + 1} of {cards.length}</span>
        <span>{card.reviewCount} previous reviews</span>
      </div>
      <button className="min-h-36 w-full rounded-md border border-line bg-canvas p-6 text-left" type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Hide definition" : "Show definition"}>
        {!flipped ? (
          <span className="font-serif text-3xl">{card.word}</span>
        ) : (
          <span className="space-y-2">
            <strong className="block font-serif text-2xl">{card.word}</strong>
            <span className="block text-sm">{card.meaning || "No definition saved."}</span>
            {card.context && <span className="block text-sm italic text-muted">{card.context}</span>}
          </span>
        )}
      </button>
      <p className="text-center text-sm text-muted">Click the card to {flipped ? "hide" : "reveal"} the definition.</p>
      {flipped && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["forgot", "Forgot", "Reset to 1 day"],
            ["hard", "Hard", "Repeat interval"],
            ["good", "Good", "Normal interval"],
            ["easy", "Easy", "Boost interval"],
          ] as const).map(([value, label, hint]) => (
            <button key={value} className="btn" type="button" onClick={() => rate(value)} disabled={busy}>
              <span><strong className="block">{label}</strong><small className="text-muted">{hint}</small></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
