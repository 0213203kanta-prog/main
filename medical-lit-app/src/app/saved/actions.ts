"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteSavedArticle(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("saved_articles").delete().eq("id", id);
  revalidatePath("/saved");
  revalidatePath("/search");
}
