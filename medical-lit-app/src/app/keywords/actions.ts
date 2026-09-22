"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です。");
  return { supabase, userId: user.id };
}

export async function addCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = (formData.get("parent_id") as string) || null;
  if (!name) return;

  const { supabase, userId } = await requireUser();
  await supabase.from("categories").insert({ name, parent_id: parentId, user_id: userId });
  revalidatePath("/keywords");
}

export async function renameCategory(formData: FormData) {
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const { supabase } = await requireUser();
  await supabase.from("categories").update({ name }).eq("id", id);
  revalidatePath("/keywords");
}

export async function deleteCategory(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;

  const { supabase } = await requireUser();
  // 子カテゴリ・所属キーワードは schema.sql の ON DELETE CASCADE / SET NULL で自動処理される
  await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/keywords");
}

export async function addKeyword(formData: FormData) {
  const term = String(formData.get("term") ?? "").trim();
  const categoryId = (formData.get("category_id") as string) || null;
  if (!term) return;

  const { supabase, userId } = await requireUser();
  await supabase.from("keywords").insert({ term, category_id: categoryId, user_id: userId });
  revalidatePath("/keywords");
  revalidatePath("/search");
}

export async function renameKeyword(formData: FormData) {
  const id = String(formData.get("id"));
  const term = String(formData.get("term") ?? "").trim();
  if (!id || !term) return;

  const { supabase } = await requireUser();
  await supabase.from("keywords").update({ term }).eq("id", id);
  revalidatePath("/keywords");
  revalidatePath("/search");
}

export async function deleteKeyword(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;

  const { supabase } = await requireUser();
  await supabase.from("keywords").delete().eq("id", id);
  revalidatePath("/keywords");
  revalidatePath("/search");
}
