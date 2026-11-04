import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import ReaderClient from "./reader-client";

export const dynamic = "force-dynamic";

export default async function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const a = Number.isFinite(id)
    ? (await db.select().from(articles).where(eq(articles.id, id)).limit(1))[0]
    : undefined;
  if (!a) notFound();
  return (
    <div>
      <Link href="/" className="text-sm text-muted hover:text-ink">← Daily feed</Link>
      <ReaderClient
        article={{
          id: a.id, title: a.title, source: a.sourceName, author: a.author, content: a.content,
          summary: a.summary, url: a.url.startsWith("http") ? a.url : null, readingTime: a.readingTimeMin ?? 5,
        }}
      />
    </div>
  );
}
