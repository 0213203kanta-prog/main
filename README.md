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
- 有料記事は手動実行(`workflow_dispatch`でtier=paidを指定)で任意のタイミングに生成

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
# 次の未使用トピックで無料記事の下書きを1本生成
python scripts/generate_draft.py

# 有料記事(ディープダイブ)を生成
python scripts/generate_draft.py --tier paid

# トピックを指定して生成
python scripts/generate_draft.py --topic-id rollover-milestone

# 生成せず選択結果だけ確認
python scripts/generate_draft.py --dry-run

# 今後8週間・週2本(火・金)の投稿カレンダーを生成
python scripts/generate_calendar.py --weeks 8 --days tue fri
```

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
2. `.github/workflows/weekly-draft.yml` が毎週火・金にレビュー用PRを自動作成(無料記事)
3. 有料記事を作りたいときは Actions タブから `Weekly note draft` を選び、
   「Run workflow」→ tierに`paid`を指定して手動実行
4. PRの内容(医学的正確性・免責文の有無、有料記事なら区切り位置)を確認してマージ
5. note.comとXへ手動で転記・公開

## ディレクトリ構成

```
content/
  persona.md         # ペルソナ・トーン&マナー・免責/CTA定型文・有料記事テンプレート
  topics.yaml        # 無料記事のトピックバンク(使用状況を自動更新)
  topics_paid.yaml   # 有料記事(ディープダイブ)のトピックバンク
  calendar.csv       # generate_calendar.py の出力
  drafts/            # generate_draft.py の出力(無料記事)
  drafts/paid/       # generate_draft.py --tier paid の出力
scripts/
  generate_draft.py
  generate_calendar.py
docs/
  strategy.md     # 自動化・収益化・周知の全体戦略
  compliance.md   # 法規制・免責に関する注意点
.github/workflows/
  weekly-draft.yml
```
