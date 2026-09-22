import { createClient } from "@/lib/supabase/server";
import CategoryTree from "./CategoryTree";
import type { Category, Keyword } from "@/lib/types";

export default async function KeywordsPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: keywords }] = await Promise.all([
    supabase.from("categories").select("id, name, parent_id, sort_order").order("sort_order"),
    supabase.from("keywords").select("id, term, category_id").order("term"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">キーワード管理</h1>
        <p className="text-sm text-slate-500">
          部位・疾患などのカテゴリを作り、その下に検索キーワードを登録します。
        </p>
      </div>
      <CategoryTree
        initialCategories={(categories ?? []) as Category[]}
        initialKeywords={(keywords ?? []) as Keyword[]}
      />
    </div>
  );
}
