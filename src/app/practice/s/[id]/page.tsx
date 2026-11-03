import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import SessionClient from "./session-client";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [{ id: rawId }, query] = await Promise.all([params, searchParams]);
  const rawQuestionIds = Array.isArray(query.q) ? query.q[0] : query.q;
  const ids = (rawQuestionIds ?? "").split(",").map(Number).filter(Boolean);
  if (!ids.length) notFound();
  const rows = db.select().from(questions).where(inArray(questions.id, ids)).all();
  const ordered = ids.map((i) => rows.find((r) => r.id === i)).filter((r): r is NonNullable<typeof r> => !!r);
  // Answers and explanations stay on the server until an attempt is submitted.
  const qs = ordered.map((q) => ({
    id: q.id, type: q.type as "mcq" | "numeric", passage: q.passageText, text: q.questionText,
    options: q.options ? (JSON.parse(q.options) as string[]) : [],
  }));
  return <SessionClient sessionId={Number(rawId)} questions={qs} />;
}
