"use client";

import { useState } from "react";
import type { Category, Keyword } from "@/lib/types";
import {
  addCategory,
  renameCategory,
  deleteCategory,
  addKeyword,
  renameKeyword,
  deleteKeyword,
} from "./actions";

type Props = {
  initialCategories: Category[];
  initialKeywords: Keyword[];
};

export default function CategoryTree({ initialCategories, initialKeywords }: Props) {
  const topLevel = initialCategories.filter((c) => c.parent_id === null);
  const uncategorized = initialKeywords.filter((k) => k.category_id === null);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">新しいカテゴリ(例: 部位・疾患)</h2>
        <AddCategoryForm parentId={null} />
      </div>

      <div className="space-y-3">
        {topLevel.map((cat) => (
          <CategoryNode
            key={cat.id}
            category={cat}
            categories={initialCategories}
            keywords={initialKeywords}
            depth={0}
          />
        ))}
        {topLevel.length === 0 && (
          <p className="text-sm text-slate-400">まだカテゴリがありません。上のフォームから追加してください。</p>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-slate-600">未分類のキーワード</h3>
        <KeywordList keywords={uncategorized} />
        <AddKeywordForm categoryId={null} />
      </div>
    </div>
  );
}

function CategoryNode({
  category,
  categories,
  keywords,
  depth,
}: {
  category: Category;
  categories: Category[];
  keywords: Keyword[];
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [addingKeyword, setAddingKeyword] = useState(false);

  const children = categories.filter((c) => c.parent_id === category.id);
  const ownKeywords = keywords.filter((k) => k.category_id === category.id);

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3"
      style={{ marginLeft: depth > 0 ? 16 : 0 }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-slate-600"
          aria-label={expanded ? "折りたたむ" : "展開する"}
        >
          {expanded ? "▾" : "▸"}
        </button>

        {editing ? (
          <form
            action={async (formData) => {
              await renameCategory(formData);
              setEditing(false);
            }}
            className="flex items-center gap-1"
          >
            <input type="hidden" name="id" value={category.id} />
            <input
              name="name"
              defaultValue={category.name}
              autoFocus
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <button type="submit" className="text-xs text-brand-600 hover:underline">
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-slate-400 hover:underline"
            >
              取消
            </button>
          </form>
        ) : (
          <span className="font-medium text-slate-800">{category.name}</span>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs">
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-slate-500 hover:underline">
              名前変更
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddingChild((v) => !v)}
            className="text-slate-500 hover:underline"
          >
            ＋サブカテゴリ
          </button>
          <button
            type="button"
            onClick={() => setAddingKeyword((v) => !v)}
            className="text-slate-500 hover:underline"
          >
            ＋キーワード
          </button>
          <form
            action={deleteCategory}
            onSubmit={(e) => {
              if (!confirm(`「${category.name}」を削除しますか?配下のカテゴリ・キーワードも削除されます。`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={category.id} />
            <button type="submit" className="text-red-500 hover:underline">
              削除
            </button>
          </form>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2">
          {addingChild && (
            <div className="rounded border border-slate-100 bg-slate-50 p-2">
              <AddCategoryForm parentId={category.id} onDone={() => setAddingChild(false)} />
            </div>
          )}

          {ownKeywords.length > 0 && <KeywordList keywords={ownKeywords} />}

          {addingKeyword && (
            <div className="rounded border border-slate-100 bg-slate-50 p-2">
              <AddKeywordForm categoryId={category.id} onDone={() => setAddingKeyword(false)} />
            </div>
          )}

          {children.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              categories={categories}
              keywords={keywords}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KeywordList({ keywords }: { keywords: Keyword[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (keywords.length === 0) return null;

  return (
    <ul className="space-y-1">
      {keywords.map((kw) => (
        <li
          key={kw.id}
          className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-sm text-slate-700"
        >
          {editingId === kw.id ? (
            <form
              action={async (formData) => {
                await renameKeyword(formData);
                setEditingId(null);
              }}
              className="flex flex-1 items-center gap-1"
            >
              <input type="hidden" name="id" value={kw.id} />
              <input
                name="term"
                defaultValue={kw.term}
                autoFocus
                className="flex-1 rounded border border-slate-300 px-2 py-0.5 text-sm"
              />
              <button type="submit" className="text-xs text-brand-600 hover:underline">
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-xs text-slate-400 hover:underline"
              >
                取消
              </button>
            </form>
          ) : (
            <>
              <span className="flex-1">{kw.term}</span>
              <button
                type="button"
                onClick={() => setEditingId(kw.id)}
                className="text-xs text-slate-500 hover:underline"
              >
                編集
              </button>
              <form action={deleteKeyword}>
                <input type="hidden" name="id" value={kw.id} />
                <button type="submit" className="text-xs text-red-500 hover:underline">
                  削除
                </button>
              </form>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function AddCategoryForm({ parentId, onDone }: { parentId: string | null; onDone?: () => void }) {
  return (
    <form
      action={async (formData) => {
        await addCategory(formData);
        onDone?.();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="parent_id" value={parentId ?? ""} />
      <input
        name="name"
        required
        placeholder="カテゴリ名(例: 膝関節)"
        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700"
      >
        追加
      </button>
    </form>
  );
}

function AddKeywordForm({ categoryId, onDone }: { categoryId: string | null; onDone?: () => void }) {
  return (
    <form
      action={async (formData) => {
        await addKeyword(formData);
        onDone?.();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="category_id" value={categoryId ?? ""} />
      <input
        name="term"
        required
        placeholder="キーワード(例: total knee arthroplasty)"
        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-slate-700 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800"
      >
        追加
      </button>
    </form>
  );
}
