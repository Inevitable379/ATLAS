import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import Parser from "rss-parser";
import { and, eq } from "drizzle-orm";
import { db, ensureDatabase } from "@/db";
import { articles, rssSources } from "@/db/schema";

const REQUEST_TIMEOUT_MS = 12_000;
const ITEMS_PER_SOURCE = 3;

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  creator?: string;
  author?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
};

type FeedResult = {
  source: string;
  added: number;
  skipped: number;
  fallbacks: number;
  error?: string;
};

export type FeedRefreshResult = {
  added: number;
  skipped: number;
  fallbacks: number;
  failures: Array<{ source: string; error: string }>;
};

const parser = new Parser<FeedItem>();

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 240);
}

function normalizeUrl(value: string | undefined, sourceUrl: string) {
  if (!value) return null;
  try {
    const url = new URL(value, sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "ATLAS/1.0 article reader" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function fallbackText(item: FeedItem) {
  const raw = item.contentSnippet ?? item.content ?? "";
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function extractArticle(url: string) {
  try {
    const html = await fetchText(url);
    const dom = new JSDOM(html, { url });
    const parsed = new Readability(dom.window.document).parse();
    if (!parsed?.textContent?.trim()) return { article: null, error: "No readable article content found" };
    const content = parsed.textContent
      .replace(/\r/g, "")
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
    return { article: { content, author: parsed.byline?.trim() || null }, error: null };
  } catch (error) {
    return { article: null, error: errorMessage(error) };
  }
}

async function refreshSource(source: typeof rssSources.$inferSelect): Promise<FeedResult> {
  const xml = await fetchText(source.url);
  const feed = await parser.parseString(xml);
  let added = 0;
  let skipped = 0;
  let fallbacks = 0;

  for (const item of feed.items.slice(0, ITEMS_PER_SOURCE)) {
    const url = normalizeUrl(item.link ?? item.guid, source.url);
    const title = item.title?.trim();
    if (!url || !title) {
      skipped += 1;
      continue;
    }

    const existingRows = await db.select({ id: articles.id }).from(articles)
      .where(and(eq(articles.url, url), eq(articles.sourceName, source.name))).limit(1);
    const existing = existingRows[0];
    if (existing) {
      skipped += 1;
      continue;
    }

    const extracted = await extractArticle(url);
    if (extracted.error) fallbacks += 1;
    const content = extracted.article?.content || fallbackText(item) || null;
    const readingTimeMin = content ? Math.max(1, Math.round(content.split(/\s+/).length / 200)) : 5;
    const result = await db.insert(articles).values({
      title,
      url,
      sourceName: source.name,
      category: source.category,
      author: extracted.article?.author ?? item.creator ?? item.author ?? null,
      content,
      readingTimeMin,
    }).onConflictDoNothing({ target: articles.url }).returning({ id: articles.id });

    if (result.length > 0) added += 1;
    else skipped += 1;
  }

  await db.update(rssSources).set({ lastFetched: new Date().toISOString() })
    .where(eq(rssSources.id, source.id));
  return { source: source.name, added, skipped, fallbacks };
}

export async function refreshFeeds(): Promise<FeedRefreshResult> {
  await ensureDatabase();
  const sources = await db.select().from(rssSources).where(eq(rssSources.isActive, 1));
  const results = await Promise.all(sources.map(async (source) => {
    try {
      return await refreshSource(source);
    } catch (error) {
      return { source: source.name, added: 0, skipped: 0, fallbacks: 0, error: errorMessage(error) };
    }
  }));

  return {
    added: results.reduce((sum, result) => sum + result.added, 0),
    skipped: results.reduce((sum, result) => sum + result.skipped, 0),
    fallbacks: results.reduce((sum, result) => sum + result.fallbacks, 0),
    failures: results
      .filter((result): result is FeedResult & { error: string } => Boolean(result.error))
      .map(({ source, error }) => ({ source, error })),
  };
}
