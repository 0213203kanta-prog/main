#!/usr/bin/env python3
"""note記事の下書き + X横展開文を生成する。

未使用トピックを content/topics.yaml から1件選び、Claude APIで
note記事の下書きとX用のティーザー文を生成し、
content/drafts/ 以下にMarkdownとして保存する。生成後、選んだトピックを
used に更新する。

使い方:
    python scripts/generate_draft.py                # tierを自動判定して生成(既定)
    python scripts/generate_draft.py --tier free     # 無料記事を強制指定
    python scripts/generate_draft.py --tier paid     # 有料記事を強制指定
    python scripts/generate_draft.py --topic-id rollover-milestone
    python scripts/generate_draft.py --dry-run       # API呼び出しをせず選択結果だけ確認
    python scripts/generate_draft.py --no-web-search # 根拠確認なしで生成(コスト節約・オフライン確認用)

tierの自動判定ルール(--tier auto、既定):
    無料記事をFIRST_PAID_AFTER本使い終わるまでは常にfree。以降は、
    直近の有料記事から無料記事をPAID_INTERVAL本使うたびに1本paidを
    はさむ。有料記事のネタが尽きたら自動的にfreeに戻る。

Web検索(医学的根拠の確認)について:
    既定でClaude APIのWeb検索ツールを有効にし、PubMed・WHO・厚生労働省
    などの信頼できるドメインに限定して検索させ(EVIDENCE_ALLOWED_DOMAINS)、
    本文中の医学的な主張の裏付けを取らせたうえで、記事末に参考文献を
    明示させる。時事的な話題を記事に混ぜる目的では使わない(公開時点に
    依存する表現は禁止)。検索1回ごとに別途課金される(トークン課金とは
    別枠)。print_costのUSD表示は検索自体の課金を含まないため、実際の
    請求額はやや上振れする点に注意。
"""

import argparse
import datetime
import pathlib
import re
import sys

import anthropic
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOPICS_PATH = ROOT / "content" / "topics.yaml"
TOPICS_PAID_PATH = ROOT / "content" / "topics_paid.yaml"
PERSONA_PATH = ROOT / "content" / "persona.md"
DRAFTS_DIR = ROOT / "content" / "drafts"

MODEL = "claude-opus-5"
PRICE_PER_MTOK_INPUT_USD = 5.00
PRICE_PER_MTOK_OUTPUT_USD = 25.00
WEB_SEARCH_MAX_USES = 4  # 1生成あたりの検索回数の上限(コスト抑制)

# 医学的根拠の確認に使う検索先を、信頼できるドメインに限定する
EVIDENCE_ALLOWED_DOMAINS = [
    "pubmed.ncbi.nlm.nih.gov",
    "www.ncbi.nlm.nih.gov",
    "www.cochranelibrary.com",
    "www.who.int",
    "www.cdc.gov",
    "www.nichd.nih.gov",
    "www.aap.org",
    "www.mhlw.go.jp",
    "www.jpeds.or.jp",
    "www.japanpt.or.jp",
]

# tier自動判定のパラメータ(docs/strategy.md フェーズ1の投入方針に対応)
FIRST_PAID_AFTER = 6   # 最初の有料記事を出すまでに必要な無料記事の使用数
PAID_INTERVAL = 6      # 以降、有料記事1本あたりに挟む無料記事の本数


def load_topics(path: pathlib.Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_topics(path: pathlib.Path, topics: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        yaml.safe_dump(topics, f, allow_unicode=True, sort_keys=False)


def pick_topic(topics: list[dict], topic_id: str | None) -> dict:
    if topic_id:
        for t in topics:
            if t["id"] == topic_id:
                return t
        raise SystemExit(f"topic-id '{topic_id}' が見つかりません")

    for t in topics:
        if t.get("status", "pending") == "pending":
            return t

    raise SystemExit("未使用のトピックがありません。content/topics.yaml に追加してください。")


def slugify(topic_id: str) -> str:
    return re.sub(r"[^a-z0-9\-]", "", topic_id.lower())


def decide_tier(free_topics: list[dict], paid_topics: list[dict]) -> str:
    paid_pending = any(t.get("status", "pending") == "pending" for t in paid_topics)
    if not paid_pending:
        return "free"

    free_used = sum(1 for t in free_topics if t.get("status") == "used")
    paid_used = sum(1 for t in paid_topics if t.get("status") == "used")
    threshold = FIRST_PAID_AFTER + paid_used * PAID_INTERVAL

    return "paid" if free_used >= threshold else "free"


EVIDENCE_INSTRUCTION = """執筆前に、web_searchツールを使って、本文で扱う医学的な主張(発達の目安・
リスク要因・対処法など)についてPubMed・WHO・厚生労働省・日本小児科学会・
日本理学療法士協会などの信頼できる情報源を検索し、裏付けを確認すること。

- 医学的に広く合意されている内容と、まだ十分なエビデンスがない・
  専門家の間で見解が分かれている内容は、はっきり区別して書くこと。
  例:「複数の研究で〜と報告されています」/
  「〜については現時点で十分な科学的根拠はなく、個人差が大きいとされています」
- 記事の最後、免責文の直前に「## 参考文献」という見出しを作り、実際に
  検索でヒットした情報源のタイトルとURLを箇条書きで示すこと。
  検索で裏付けが確認できなかった主張は参考文献に含めない、または
  本文中に「明確な出典は確認できませんでした」等、正直に明記すること。
- 実在しない論文・URL・団体名を創作すること(ハルシネーション)は
  絶対に禁止。1件も裏付けが見つからない場合は、参考文献の見出し自体を
  省略してよい(空欄や架空の項目を作らない)。

重要: この記事は「いつ・誰が読んでも通用する」内容にすること。
「現在は」「今年は」「最近」「〜が話題になっています」のような、
公開時点に依存する表現は本文に一切含めないこと。Web検索は医学的な
事実確認・引用のためだけに使い、時事的な話題を記事に反映しないこと。
"""


def build_prompt(topic: dict, persona: str, tier: str) -> tuple[str, str]:
    system = (
        "あなたは日本語で子育て支援コンテンツを書くライターです。以下のペルソナ・"
        "トーン&マナーに厳密に従って執筆してください。\n\n" + persona
    )

    if tier == "paid":
        user = f"""{EVIDENCE_INSTRUCTION}
次のトピックで、note有料記事(ディープダイブ)の下書きを作成してください。

タイトル: {topic['title']}
コンテンツの柱: {topic['pillar']}
関連する無料記事のid: {topic['related_free_id']}
価格: {topic['price']}円
有料エリアの形式: {topic['format']}

出力は以下のMarkdown形式で、これ以外の前置き・後書きは一切書かないでください。
persona.md の「有料記事(ディープダイブ)のテンプレート」の構成に厳密に従うこと。

# [note記事本文]
(タイトル案を1つ、続けて無料エリア(フック→重要性→関連無料記事への
一言リンク)。次に `▼ここから有料エリア` という行を単独で入れ、
続けて有料エリア({topic['format']}の形式で、読むだけでなく
「使える」内容にする)。そのあとに「## 参考文献」(EVIDENCE_INSTRUCTION
参照。裏付けがなければ省略)、最後に免責文とCTA。
全体で2000〜3000文字程度。見出しには「## 」を使うこと。)

# [Xスレッド]
(4〜6投稿。各投稿は140字以内。1投稿目で結論(無料で分かること)を
言い切り、最後の投稿で有料記事へ誘導する一文を入れる。
番号付きリストで出力。)
"""
        return system, user

    user = f"""{EVIDENCE_INSTRUCTION}
次のトピックでnote記事の下書きを作成してください。

トピック: {topic['title']}
コンテンツの柱: {topic['pillar']}

出力は以下のMarkdown形式で、これ以外の前置き・後書きは一切書かないでください。

# [note記事本文]
(タイトル案を1つ、続けて本文。docs/strategy.md の記事テンプレート
「フック→結論の先出し→医学的解説→具体的アクション3〜5個→
受診の目安→まとめ+CTA→参考文献→免責文」の構成に従うこと。
参考文献はEVIDENCE_INSTRUCTION参照(裏付けがなければ見出しごと省略)。
免責文とCTAはpersonaに記載の定型文をそのまま使うこと。
本文は1500〜2500文字程度。見出しには「## 」を使うこと。)

# [Xスレッド]
(4〜6投稿。各投稿は140字以内。1投稿目で結論を言い切り、
最後の投稿でnote記事へ誘導する一文を入れる。番号付きリストで出力。)
"""
    return system, user


def call_claude(system: str, user: str, use_web_search: bool) -> str:
    client = anthropic.Anthropic()
    tools = []
    if use_web_search:
        tools.append({
            "type": "web_search_20260209",
            "name": "web_search",
            "max_uses": WEB_SEARCH_MAX_USES,
            "allowed_domains": EVIDENCE_ALLOWED_DOMAINS,
        })

    with client.messages.stream(
        model=MODEL,
        max_tokens=8000,
        system=system,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        tools=tools,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        response = stream.get_final_message()

    text_parts = [block.text for block in response.content if block.type == "text"]
    return "\n".join(text_parts), response.usage


def print_cost(usage) -> None:
    input_cost = usage.input_tokens * PRICE_PER_MTOK_INPUT_USD / 1_000_000
    output_cost = usage.output_tokens * PRICE_PER_MTOK_OUTPUT_USD / 1_000_000
    total_cost = input_cost + output_cost
    print(
        f"トークン使用量: input={usage.input_tokens}, output={usage.output_tokens} "
        f"(うちthinkingを含む) / 概算コスト: ${total_cost:.4f}"
        " (Web検索を使った場合、検索自体の課金は別途発生し上記には含まれません)"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--tier", choices=["auto", "free", "paid"], default="auto",
        help="auto: 使用実績から自動判定(既定) / free・paidで強制指定も可能",
    )
    parser.add_argument("--topic-id", help="使用するトピックIDを指定(省略時は次の未使用トピック)")
    parser.add_argument("--dry-run", action="store_true", help="APIを呼ばずに選択結果のみ表示")
    parser.add_argument(
        "--no-web-search", action="store_true",
        help="医学的根拠の確認(Web検索)を無効化する(コスト節約・オフライン確認用)",
    )
    args = parser.parse_args()

    free_topics = load_topics(TOPICS_PATH)
    paid_topics = load_topics(TOPICS_PAID_PATH)

    if args.tier == "auto":
        tier = decide_tier(free_topics, paid_topics)
        print(f"tierを自動判定: {tier}")
    else:
        tier = args.tier

    topics_path = TOPICS_PAID_PATH if tier == "paid" else TOPICS_PATH
    topics = paid_topics if tier == "paid" else free_topics
    topic = pick_topic(topics, args.topic_id)
    print(f"[{tier}] 選択したトピック: {topic['id']} - {topic['title']}")

    if args.dry_run:
        return

    persona = PERSONA_PATH.read_text(encoding="utf-8")
    system, user = build_prompt(topic, persona, tier)

    try:
        output, usage = call_claude(system, user, use_web_search=not args.no_web_search)
    except anthropic.AuthenticationError:
        sys.exit("ANTHROPIC_API_KEY が未設定、または無効です。")
    except anthropic.RateLimitError as e:
        sys.exit(f"レート制限に達しました: {e}")
    except anthropic.APIConnectionError:
        sys.exit("Claude APIへの接続に失敗しました。ネットワークを確認してください。")
    except anthropic.APIStatusError as e:
        sys.exit(f"Claude APIエラー ({e.status_code}): {e.message}")

    out_dir = DRAFTS_DIR / "paid" if tier == "paid" else DRAFTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    date_str = datetime.date.today().isoformat()
    out_path = out_dir / f"{date_str}-{slugify(topic['id'])}.md"
    out_path.write_text(output, encoding="utf-8")
    print(f"下書きを保存しました: {out_path}")
    print_cost(usage)

    for t in topics:
        if t["id"] == topic["id"]:
            t["status"] = "used"
    save_topics(topics_path, topics)


if __name__ == "__main__":
    main()
