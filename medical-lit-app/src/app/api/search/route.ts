import { NextResponse } from "next/server";
import { SOURCES, DEFAULT_SOURCE } from "@/lib/sources";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const sourceId = searchParams.get("source") ?? DEFAULT_SOURCE;

  if (!query) {
    return NextResponse.json({ error: "検索キーワードを指定してください。" }, { status: 400 });
  }

  const source = SOURCES[sourceId];
  if (!source) {
    return NextResponse.json({ error: `未対応の検索先です: ${sourceId}` }, { status: 400 });
  }

  try {
    const results = await source.search(query, { retmax: 30 });
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "検索中にエラーが発生しました。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
