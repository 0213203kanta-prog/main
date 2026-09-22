"use client";

import { useMemo, useState, useTransition } from "react";
import type { ArticleResult } from "@/lib/sources/types";
import { saveArticle } from "./actions";

type KeywordOption = { id: string; term: string; groupLabel: string };

type Props = {
  keywordOptions: KeywordOption[];
  initialSavedIds: string[];
};

export default function SearchClient({ keywordOptions, initialSavedIds }: Props) {
  const [query, setQuery] = useState("");
  const [selectedKeywordTerm, setSelectedKeywordTerm] = useState<string>("");
  const [results, setResults] = useState<ArticleResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, KeywordOption[]>();
    for (const opt of keywordOptions) {
      const list = groups.get(opt.groupLabel) ?? [];
      list.push(opt);
      groups.set(opt.groupLabel, list);
    }
    return Array.from(groups.entries());
  }, [keywordOptions]);

  async function runSearch(term: string) {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&source=pubmed`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "検索に失敗しました。");
        setResults([]);
        return;
      }
      setResults(data.results as ArticleResult[]);
    } catch {
      setError("検索中に通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  function handleSave(article: ArticleResult) {
    startTransition(async () => {
      const result = await saveArticle(article, selectedKeywordTerm || null);
      if (!result.error) {
        setSavedIds((prev) => new Set(prev).add(article.sourceId));
      }
    });
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              登録キーワードから選ぶ
            </label>
            <select
              value={selectedKeywordTerm}
              onChange={(e) => {
                setSelectedKeywordTerm(e.target.value);
                if (e.target.value) setQuery(e.target.value);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- 選択しない --</option>
              {groupedOptions.map(([groupLabel, opts]) => (
                <optgroup key={groupLabel} label={groupLabel}>
                  {opts.map((opt) => (
                    <option key={opt.id} value={opt.term}>
                      {opt.term}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">検索キーワード</label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例: rotator cuff repair rehabilitation"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "検索中..." : "検索"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">PubMedの検索構文(AND/OR、[Title]など)がそのまま使えます。</p>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && results.length === 0 && !error && (
        <p className="text-sm text-slate-400">まだ検索結果がありません。</p>
      )}

      <ul className="space-y-3">
        {results.map((article) => {
          const isSaved = savedIds.has(article.sourceId);
          const isExpanded = expandedIds.has(article.sourceId);
          const abstract = article.abstract || "抄録なし";
          return (
            <li key={article.sourceId} className="rounded-lg border border-slate-200 bg-white p-4">
              <a
                href={article.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-700 hover:underline"
              >
                {article.title || "(タイトル不明)"}
              </a>
              <p className="mt-1 text-sm text-slate-600">
                {article.authors.join(", ") || "著者不明"}
              </p>
              <p className="text-sm text-slate-500">
                {[article.journal, article.pubDate].filter(Boolean).join(" ・ ")}
              </p>

              <p className={`mt-2 whitespace-pre-line text-sm text-slate-700 ${isExpanded ? "" : "line-clamp-3"}`}>
                {abstract}
              </p>
              {abstract.length > 160 && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(article.sourceId)}
                  className="mt-1 text-xs text-brand-600 hover:underline"
                >
                  {isExpanded ? "折りたたむ" : "抄録全文を表示"}
                </button>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {article.doi && (
                  <a
                    href={`https://doi.org/${article.doi}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    DOI: {article.doi}
                  </a>
                )}
                <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
                  PubMedで開く
                </a>
                <button
                  type="button"
                  disabled={isSaved || isPending}
                  onClick={() => handleSave(article)}
                  className={`ml-auto rounded-md px-3 py-1 font-medium ${
                    isSaved
                      ? "bg-slate-100 text-slate-400"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  } disabled:cursor-not-allowed`}
                >
                  {isSaved ? "保存済み" : "保存する"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
