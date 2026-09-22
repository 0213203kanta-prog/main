-- 医学文献チェックアプリ用のテーブル定義
-- Supabaseダッシュボードの「SQL Editor」に貼り付けて実行してください。
-- 個人利用(1ユーザー)を前提に、行レベルセキュリティ(RLS)で
-- 「自分のuser_idの行しか読み書きできない」ように制限しています。

create extension if not exists "pgcrypto";

-- カテゴリ(部位・疾患など)。parent_id で親子関係を作り、階層分類できる
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references categories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on categories(user_id);
create index if not exists categories_parent_id_idx on categories(parent_id);

-- キーワード。カテゴリに紐づけて登録する(カテゴリ未設定も可)
create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term text not null,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists keywords_user_id_idx on keywords(user_id);
create index if not exists keywords_category_id_idx on keywords(category_id);

-- 保存した論文。source列を持たせておき、将来PubMed以外
-- (J-STAGE, Europe PMCなど)を追加しても同じテーブルで扱える設計
create table if not exists saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null default 'pubmed',
  source_id text not null,
  title text not null default '',
  authors text not null default '',
  journal text not null default '',
  pub_date text not null default '',
  abstract text not null default '',
  doi text,
  url text not null default '',
  keyword_term text,
  saved_at timestamptz not null default now(),
  unique (user_id, source, source_id)
);

create index if not exists saved_articles_user_id_idx on saved_articles(user_id);
create index if not exists saved_articles_saved_at_idx on saved_articles(saved_at desc);

-- RLSを有効化し、「自分の行だけ」操作できるポリシーを設定
alter table categories enable row level security;
alter table keywords enable row level security;
alter table saved_articles enable row level security;

drop policy if exists "own rows" on categories;
create policy "own rows" on categories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own rows" on keywords;
create policy "own rows" on keywords
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own rows" on saved_articles;
create policy "own rows" on saved_articles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
