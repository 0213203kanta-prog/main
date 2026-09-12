#!/usr/bin/env python3
"""note記事の下書き + SNS横展開文を生成する。

未使用トピックを content/topics.yaml から1件選び、Claude APIで
note記事の下書きとX/Instagram用のティーザー文を生成し、
content/drafts/ 以下にMarkdownとして保存する。生成後、選んだトピックを
used に更新する。

使い方:
    python scripts/generate_draft.py                # 次の未使用トピックを自動選択
    python scripts/generate_draft.py --topic-id rollover-milestone
    python scripts/generate_draft.py --dry-run       # API呼び出しをせず選択結果だけ確認
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
PERSONA_PATH = ROOT / "content" / "persona.md"
DRAFTS_DIR = ROOT / "content" / "drafts"

MODEL = "claude-opus-5"


def load_topics() -> list[dict]:
    with open(TOPICS_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_topics(topics: list[dict]) -> None:
    with open(TOPICS_PATH, "w", encoding="utf-8") as f:
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


def build_prompt(topic: dict, persona: str) -> tuple[str, str]:
    system = (
        "あなたは日本語で子育て支援コンテンツを書くライターです。以下のペルソナ・"
        "トーン&マナーに厳密に従って執筆してください。\n\n" + persona
    )
    user = f"""次のトピックでnote記事の下書きを作成してください。

トピック: {topic['title']}
コンテンツの柱: {topic['pillar']}

出力は以下のMarkdown形式で、これ以外の前置き・後書きは一切書かないでください。

# [note記事本文]
(タイトル案を1つ、続けて本文。docs/strategy.md の記事テンプレート
「フック→結論の先出し→医学的解説→具体的アクション3〜5個→
受診の目安→まとめ+CTA→免責文」の構成に従うこと。
免責文とCTAはpersonaに記載の定型文をそのまま使うこと。
本文は1500〜2500文字程度。見出しには「## 」を使うこと。)

# [Xスレッド]
(4〜6投稿。各投稿は140字以内。1投稿目で結論を言い切り、
最後の投稿でnote記事へ誘導する一文を入れる。番号付きリストで出力。)

# [Instagramキャプション]
(冒頭2行で要約、続けて本文相当の要約、最後にハッシュタグを5〜8個。
ハッシュタグは子育て・理学療法・パパ育児関連のものにすること。)
"""
    return system, user


def call_claude(system: str, user: str) -> str:
    client = anthropic.Anthropic()
    with client.messages.stream(
        model=MODEL,
        max_tokens=8000,
        system=system,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        messages=[{"role": "user", "content": user}],
    ) as stream:
        response = stream.get_final_message()

    text_parts = [block.text for block in response.content if block.type == "text"]
    return "\n".join(text_parts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--topic-id", help="使用するトピックIDを指定(省略時は次の未使用トピック)")
    parser.add_argument("--dry-run", action="store_true", help="APIを呼ばずに選択結果のみ表示")
    args = parser.parse_args()

    topics = load_topics()
    topic = pick_topic(topics, args.topic_id)
    print(f"選択したトピック: {topic['id']} - {topic['title']}")

    if args.dry_run:
        return

    persona = PERSONA_PATH.read_text(encoding="utf-8")
    system, user = build_prompt(topic, persona)

    try:
        output = call_claude(system, user)
    except anthropic.AuthenticationError:
        sys.exit("ANTHROPIC_API_KEY が未設定、または無効です。")
    except anthropic.RateLimitError as e:
        sys.exit(f"レート制限に達しました: {e}")
    except anthropic.APIConnectionError:
        sys.exit("Claude APIへの接続に失敗しました。ネットワークを確認してください。")
    except anthropic.APIStatusError as e:
        sys.exit(f"Claude APIエラー ({e.status_code}): {e.message}")

    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.date.today().isoformat()
    out_path = DRAFTS_DIR / f"{date_str}-{slugify(topic['id'])}.md"
    out_path.write_text(output, encoding="utf-8")
    print(f"下書きを保存しました: {out_path}")

    for t in topics:
        if t["id"] == topic["id"]:
            t["status"] = "used"
    save_topics(topics)


if __name__ == "__main__":
    main()
