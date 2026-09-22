import { createClient } from "@/lib/supabase/server";
import SearchClient from "./SearchClient";
import type { Category, Keyword } from "@/lib/types";

function categoryPath(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) return "";
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parts: string[] = [];
  let current = byId.get(categoryId);
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return parts.join(" / ");
}

export default async function SearchPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: keywords }, { data: saved }] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id, sort_order"),
    supabase.from("keywords").select("id, term, category_id").order("term"),
    supabase.from("saved_articles").select("source, source_id").eq("source", "pubmed"),
  ]);

  const keywordOptions = ((keywords ?? []) as Keyword[]).map((k) => ({
    id: k.id,
    term: k.term,
    groupLabel: categoryPath(k.category_id, (categories ?? []) as Category[]) || "未分類",
  }));

  const savedIds = (saved ?? []).map((row) => row.source_id as string);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">PubMed検索</h1>
        <p className="text-sm text-slate-500">
          登録したキーワードを選ぶか、自由にキーワードを入力して検索できます。
        </p>
      </div>
      <SearchClient keywordOptions={keywordOptions} initialSavedIds={savedIds} />
    </div>
  );
}
