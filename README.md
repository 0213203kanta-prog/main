# note運用自動化ツールキット

理学療法士(PT)パパによる子育て情報発信アカウント
([note.com/quiet_alpaca7765k](https://note.com/quiet_alpaca7765k)) の
運用を半自動化するためのツール一式。

戦略の全体像(自動化・収益化・周知)は **[docs/strategy.md](docs/strategy.md)**、
法規制・免責の注意点は **[docs/compliance.md](docs/compliance.md)** を参照。

## できること

- `content/topics.yaml`(無料記事)/ `content/topics_paid.yaml`(有料記事)の
  トピックバンクから、Claude APIでnote記事の下書き・X(Twitter)スレッドを自動生成
- 週2本ペースの投稿カレンダーを自動生成
- GitHub Actionsで週2回(火・金)自動的に下書きPRを起票(人間のレビュー→手動投稿を前提)
- 無料記事を一定本数使うたびに、**有料記事(ディープダイブ)を自動判定して
  自動的に混ぜる**(`--tier auto`が既定。ルールは`docs/strategy.md`参照)

note.comには投稿を行う公式APIが存在しないため、実際の公開は
レビュー後に手動で行う(数分の作業)。詳しくは
`docs/strategy.md` の「1. 自動化の設計方針」を参照。

## セットアップ

```bash
pip install -r requirements.txt
cp .env.example .env   # ANTHROPIC_API_KEY を設定
export $(cat .env | xargs)
```

## 使い方

```bash
# tierを自動判定して下書きを1本生成(既定。通常はこれだけでよい)
python scripts/generate_draft.py

# free/paidを強制指定したいとき
python scripts/generate_draft.py --tier free
python scripts/generate_draft.py --tier paid

# トピックを指定して生成
python scripts/generate_draft.py --topic-id rollover-milestone

# 生成せず選択結果だけ確認
python scripts/generate_draft.py --dry-run

# 今後8週間・週2本(火・金)の投稿カレンダーを生成
python scripts/generate_calendar.py --weeks 8 --days tue fri

# 公開済み記事(status=used)のまとめ記事を柱ごとに自動生成
# (記事が10本前後溜まったら実行するのがおすすめ。docs/strategy.md「9.」参照)
python scripts/generate_index.py
```

`generate_draft.py` は既定でClaude APIのWeb検索を使い、生成のたびに
「今の時期に関連する話題」を調べてから執筆する(トレンドは味付け程度で、
医学的なコア情報は普遍的な内容を維持)。無効化したい場合は
`--no-web-search` を付ける。詳しくは `docs/strategy.md` の「8.」を参照。

`generate_draft.py` は生成のたびに実際のトークン使用量と概算コスト(USD)を
標準出力に表示する。GitHub Actions実行時はジョブのログで確認できる。
概算の考え方は `docs/strategy.md` の「7. 想定コスト」を参照。

生成された下書きは `content/drafts/YYYY-MM-DD-<topic-id>.md`
(有料記事は `content/drafts/paid/` 以下)に保存される。中身は以下の2セクション:

1. note記事本文(免責文・CTA込み。有料記事は `▼ここから有料エリア` で
   区切られているので、note公開時にその位置で有料設定をすること)
2. Xスレッド用の投稿文

## GitHub Actionsで自動化する場合

1. リポジトリの Settings → Secrets に `ANTHROPIC_API_KEY` を登録
2. `.github/workflows/weekly-draft.yml` が毎週火・金にレビュー用PRを自動作成
   (tierは自動判定。無料記事が続き、条件を満たすと自動で有料記事が混ざる)
3. PRタイトルの `[free]` / `[paid]` でどちらが生成されたか分かる
4. PRの内容(医学的正確性・免責文の有無、有料記事なら区切り位置)を確認してマージ
5. note.comとXへ手動で転記・公開(有料記事は`▼ここから有料エリア`の
   位置でnoteの有料設定をすること)

強制的にfree/paidを指定したい場合のみ、Actionsタブの「Run workflow」から
tierを選んで手動実行できる。

## ディレクトリ構成

```
content/
  persona.md         # ペルソナ・トーン&マナー・免責/CTA定型文・有料記事テンプレート
  topics.yaml        # 無料記事のトピックバンク(使用状況を自動更新)
  topics_paid.yaml   # 有料記事(ディープダイブ)のトピックバンク
  calendar.csv       # generate_calendar.py の出力
  drafts/            # generate_draft.py の出力(無料記事)
  drafts/paid/       # generate_draft.py --tier paid の出力
  index.md           # generate_index.py の出力(まとめ記事の下書き)
scripts/
  generate_draft.py
  generate_calendar.py
  generate_index.py
docs/
  strategy.md     # 自動化・収益化・周知の全体戦略
  compliance.md   # 法規制・免責に関する注意点
.github/workflows/
  weekly-draft.yml
```
