import { createClient } from "@/lib/supabase/server";
import type { SavedArticle } from "@/lib/types";
import { deleteSavedArticle } from "./actions";

export default async function SavedPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_articles")
    .select(
      "id, source, source_id, title, authors, journal, pub_date, abstract, doi, url, keyword_term, saved_at"
    )
    .order("saved_at", { ascending: false });

  const articles = (data ?? []) as SavedArticle[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">保存した論文</h1>
        <p className="text-sm text-slate-500">{articles.length}件</p>
      </div>

      {articles.length === 0 && (
        <p className="text-sm text-slate-400">まだ保存した論文がありません。検索画面から保存できます。</p>
      )}

      <ul className="space-y-3">
        {articles.map((article) => (
          <li key={article.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-700 hover:underline"
              >
                {article.title || "(タイトル不明)"}
              </a>
              <form action={deleteSavedArticle} className="shrink-0">
                <input type="hidden" name="id" value={article.id} />
                <button type="submit" className="text-xs text-red-500 hover:underline">
                  削除
                </button>
              </form>
            </div>

            <p className="mt-1 text-sm text-slate-600">{article.authors || "著者不明"}</p>
            <p className="text-sm text-slate-500">
              {[article.journal, article.pub_date].filter(Boolean).join(" ・ ")}
            </p>

            {article.keyword_term && (
              <span className="mt-2 inline-block rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                キーワード: {article.keyword_term}
              </span>
            )}

            {article.abstract && (
              <details className="mt-2 text-sm text-slate-700">
                <summary className="cursor-pointer text-brand-600">抄録を表示</summary>
                <p className="mt-1 whitespace-pre-line">{article.abstract}</p>
              </details>
            )}

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {article.doi && (
                <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer" className="hover:underline">
                  DOI: {article.doi}
                </a>
              )}
              <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
                PubMedで開く
              </a>
              <span className="ml-auto text-slate-400">
                保存日: {new Date(article.saved_at).toLocaleDateString("ja-JP")}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
