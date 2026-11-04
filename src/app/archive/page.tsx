import Link from "next/link";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { CATEGORIES } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string | string[]; category?: string | string[] };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Archive({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const search = first(query.q)?.trim().slice(0, 100) ?? "";
  const category = first(query.category) ?? "";
  const rows = await db.select().from(articles)
    .where(and(
      search ? like(articles.title, `%${search}%`) : undefined,
      category ? eq(articles.category, category) : undefined,
    ))
    .orderBy(desc(articles.discoveredAt), desc(articles.id))
    ;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Article archive</h1>
        <p className="mt-1 text-muted">Search everything ATLAS has stored, including completed and saved reading.</p>
      </header>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        <label className="min-w-60 flex-1 text-sm">
          <span className="mb-1 block text-muted">Search titles</span>
          <input className="w-full rounded-md border border-line bg-canvas px-3 py-2" name="q" defaultValue={search} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Category</span>
          <select className="rounded-md border border-line bg-canvas px-3 py-2" name="category" defaultValue={category}>
            <option value="">All categories</option>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">Search</button>
        {(search || category) && <Link className="btn" href="/archive">Clear</Link>}
      </form>

      <p className="text-sm text-muted">{rows.length} article{rows.length === 1 ? "" : "s"}</p>
      <div className="space-y-3">
        {rows.map((article) => (
          <article key={article.id} className="card">
            <p className="text-sm text-muted">{article.sourceName} · {article.category} · {article.status}</p>
            <h2 className="mt-1 font-serif text-lg"><Link className="hover:underline" href={`/read/${article.id}`}>{article.title}</Link></h2>
            <p className="mt-1 text-sm text-muted">{article.readingTimeMin ?? 5} min read</p>
          </article>
        ))}
        {!rows.length && <p className="text-muted">No articles match those filters.</p>}
      </div>
    </div>
  );
}
