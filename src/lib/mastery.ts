// Mastery levels per PRD §Module 4. The PRD leaves two gaps; resolved here:
//  - 6–10 attempts with accuracy ≥ 70% → "practicing" (not enough evidence for "strong").
//  - >10 attempts, accuracy ≥ 70% but not yet mastered → "strong".
export type Level = "new" | "learning" | "practicing" | "strong" | "mastered";

export function levelFor(total: number, correct: number, streak: number): Level {
  if (total === 0) return "new";
  if (total <= 5) return "learning";
  const acc = correct / total;
  if (total > 15 && acc > 0.85 && streak >= 3) return "mastered";
  if (total > 10 && acc >= 0.7) return "strong";
  return "practicing";
}
