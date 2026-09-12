# note運用自動化ツールキット

理学療法士(PT)パパによる子育て情報発信アカウント
([note.com/quiet_alpaca7765k](https://note.com/quiet_alpaca7765k)) の
運用を半自動化するためのツール一式。

戦略の全体像(自動化・収益化・周知)は **[docs/strategy.md](docs/strategy.md)**、
法規制・免責の注意点は **[docs/compliance.md](docs/compliance.md)** を参照。

## できること

- `content/topics.yaml` のトピックバンクから、Claude APIでnote記事の
  下書き・X(Twitter)スレッドを自動生成
- 週2本ペースの投稿カレンダーを自動生成
- GitHub Actionsで毎週自動的に下書きPRを起票(人間のレビュー→手動投稿を前提)

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
# 次の未使用トピックで下書きを1本生成
python scripts/generate_draft.py

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

生成された下書きは `content/drafts/YYYY-MM-DD-<topic-id>.md` に保存される。
中身は以下の2セクション:

1. note記事本文(免責文・CTA込み)
2. Xスレッド用の投稿文

## GitHub Actionsで自動化する場合

1. リポジトリの Settings → Secrets に `ANTHROPIC_API_KEY` を登録
2. `.github/workflows/weekly-draft.yml` が毎週月曜にレビュー用PRを自動作成
3. PRの内容(医学的正確性・免責文の有無)を確認してマージ
4. note.comとSNSへ手動で転記・公開

## ディレクトリ構成

```
content/
  persona.md      # ペルソナ・トーン&マナー・免責/CTA定型文
  topics.yaml     # コンテンツのトピックバンク(使用状況を自動更新)
  calendar.csv    # generate_calendar.py の出力
  drafts/         # generate_draft.py の出力
scripts/
  generate_draft.py
  generate_calendar.py
docs/
  strategy.md     # 自動化・収益化・周知の全体戦略
  compliance.md   # 法規制・免責に関する注意点
.github/workflows/
  weekly-draft.yml
```
