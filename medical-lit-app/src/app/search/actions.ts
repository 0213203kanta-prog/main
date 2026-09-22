"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ArticleResult } from "@/lib/sources/types";

export async function saveArticle(article: ArticleResult, keywordTerm: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です。");

  const { error } = await supabase.from("saved_articles").upsert(
    {
      user_id: user.id,
      source: article.source,
      source_id: article.sourceId,
      title: article.title,
      authors: article.authors.join(", "),
      journal: article.journal,
      pub_date: article.pubDate,
      abstract: article.abstract,
      doi: article.doi,
      url: article.url,
      keyword_term: keywordTerm,
    },
    { onConflict: "user_id,source,source_id", ignoreDuplicates: true }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/saved");
  return { error: null };
}
