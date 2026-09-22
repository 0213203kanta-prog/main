# 医学文献チェックアプリ(自分専用)

Next.js (App Router) + TypeScript + Supabase で作った、個人用の医学文献検索・保存アプリです。
キーワードをカテゴリ(部位・疾患など)で階層管理し、PubMedを検索して気になった論文を保存できます。
PWA対応なので、iPhone/iPadのホーム画面に追加してアプリのように使えます。

## できること(第1段階)

- Supabase Authによるログイン(新規登録は無効。自分1人だけが使える)
- キーワードの登録・編集・削除、カテゴリによる階層分類
- PubMed検索(NCBI E-utilities、APIキー対応)
- 検索結果にタイトル・著者・雑誌名・発行日・抄録・DOI・PubMedリンクを表示
- 論文の保存・保存一覧の閲覧
- スマホ/PC両対応のレスポンシブ画面

## 技術構成

- Next.js 15 (App Router) + TypeScript
- Supabase(認証 + Postgresデータベース、Row Level Securityで自分のデータのみアクセス可)
- Tailwind CSS
- 手動実装のPWA(`public/manifest.json` + `public/sw.js`)
- 文献検索は `src/lib/sources/` にソースごとのモジュールを追加する設計。
  今はPubMedのみですが、`LiteratureSource` インターフェースを実装すれば
  J-STAGEやEurope PMCなどを後から追加できます(`src/lib/sources/index.ts` の
  `SOURCES` に登録するだけ)。

---

## セットアップ手順(初心者向け)

### 1. Supabaseプロジェクトを作る

1. https://supabase.com/ にアクセスし、無料でアカウント登録
2. 「New Project」でプロジェクトを作成(リージョンは Tokyo が近くて速いです)
3. 作成が終わったら、左メニューの **Project Settings → API** を開く
   - `Project URL` と `anon public` キーをメモしておく(あとで `.env.local` に貼ります)

### 2. データベースのテーブルを作る

1. Supabaseダッシュボードの左メニューから **SQL Editor** を開く
2. このリポジトリの `supabase/schema.sql` の中身を全部コピーして貼り付け、
   右下の「Run」ボタンを押す
   - これで `categories`(カテゴリ)・`keywords`(キーワード)・
     `saved_articles`(保存した論文)の3つのテーブルができます
   - 「自分の行しか読み書きできない」ようにRLS(Row Level Security)も
     同時に設定されます

### 3. 自分専用のログインアカウントを作る(新規登録は使わない)

このアプリは「新規登録」画面を持たず、あらかじめ用意した1つのアカウントだけで
ログインする作りです。

1. Supabaseダッシュボードの左メニューから **Authentication → Users** を開く
2. 「Add user」→「Create new user」を選び、自分のメールアドレスとパスワードを入力
   (「Auto Confirm User」にチェックを入れるとメール確認なしで使えます)
3. 続けて **Authentication → Settings → User Signups** を開き、
   「Allow new users to sign up」をオフにする
   → これで自分以外は新規登録できなくなります

### 4. このアプリを取得してパッケージをインストール

```bash
cd medical-lit-app
npm install
```

### 5. 環境変数を設定する

```bash
cp .env.local.example .env.local
```

`.env.local` を開いて、手順1でメモした値を入力してください。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ここに anon public キー
```

`NCBI_API_KEY` などPubMed関連の項目は空でも動きますが、設定すると
NCBI側のアクセス制限(1秒あたりのリクエスト数)が緩和されます。
APIキーは https://www.ncbi.nlm.nih.gov/account/ の
「Settings → API Key Management」から無料で発行できます。

**注意:** `.env.local` はGitにコミットされません(`.gitignore`で除外済み)。
APIキーやパスワードなどの秘密情報は、コードの中に直接書かないでください。

### 6. ローカルで動作確認する

```bash
npm run dev
```

ターミナルに表示される `http://localhost:3000` をブラウザで開きます。

1. ログイン画面が表示されるので、手順3で作ったメールアドレス・パスワードでログイン
2. 「キーワード」画面でカテゴリ(例: 膝関節)を作り、その下にキーワード
   (例: `total knee arthroplasty`)を登録
3. 「検索」画面で、登録したキーワードをプルダウンから選ぶか、検索欄に直接入力して
   「検索」ボタンを押す → PubMedの検索結果が表示される
4. 気になった論文の「保存する」ボタンを押す
5. 「保存済み」画面で、保存した論文が一覧に出ていることを確認する

うまく動けば準備は完了です。

### 7. iPhone/iPadのホーム画面に追加する(PWA)

スマホでこのアプリにアクセスするには、開発用サーバーを同じWi-Fi内の
別端末からも見えるようにするか、後述の「本番デプロイ」を行ってください。

1. Safariでアプリのページを開く
2. 共有ボタン(四角に上矢印のアイコン)をタップ
3. 「ホーム画面に追加」を選択
4. ホーム画面のアイコンから起動すると、ブラウザのアドレスバーなどがない
   アプリのような見た目で使えます

### 8. 本番環境に公開する(任意)

自宅のWi-Fi以外(外出先のスマホなど)からも使いたい場合は、
[Vercel](https://vercel.com/)(Next.js製作元のホスティングサービス、無料枠あり)に
デプロイするのが簡単です。

1. このリポジトリをGitHubにpush
2. Vercelで「Add New Project」→ このリポジトリを選択
   (Root Directoryを `medical-lit-app` に設定)
3. Environment Variablesに `.env.local` と同じ内容を設定
4. デプロイ後に発行されるURLに、スマホからアクセスしてホーム画面に追加する

---

## ディレクトリ構成

```
medical-lit-app/
  supabase/schema.sql       # Supabaseに流し込むテーブル定義
  public/manifest.json      # PWAマニフェスト
  public/sw.js               # Service Worker
  public/icons/               # アプリアイコン(scripts/generate-icons.mjsで生成)
  src/
    middleware.ts            # 未ログイン時に /login へリダイレクト
    lib/
      supabase/               # Supabaseクライアント(ブラウザ用・サーバー用)
      sources/                 # 文献データベースごとの検索モジュール
        types.ts                # 共通インターフェース(LiteratureSource)
        pubmed.ts                # PubMed(NCBI E-utilities)実装
        index.ts                  # ソース一覧。追加時はここに登録
      types.ts                  # カテゴリ・キーワード・保存論文の型
    app/
      login/                   # ログイン画面
      keywords/                # キーワード・カテゴリ管理画面
      search/                  # PubMed検索画面
      saved/                   # 保存済み論文一覧
      api/search/route.ts      # 検索API(サーバー側でPubMedにアクセス)
```

## 今後の拡張(第2段階以降のアイデア)

- 他の文献データベース(J-STAGE、Europe PMCなど)の追加
  → `src/lib/sources/` に新しいファイルを作り、`LiteratureSource` を実装して
    `src/lib/sources/index.ts` の `SOURCES` に追加するだけで、検索画面の
    ソース選択に組み込めるようになっています
- 複数キーワードのAND/OR検索
- 保存論文へのメモ・タグ付け
- キーワードごとの新着論文の自動チェック・通知
