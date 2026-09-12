#!/usr/bin/env python3
"""公開済み記事の一覧(まとめ記事の下書き)を生成する。

content/topics.yaml・topics_paid.yaml のstatus=usedな項目を柱(pillar)
ごとにグループ化し、content/index.md にMarkdownとして書き出す。
記事を実際にnoteで公開したら、該当トピックに `published_url:` を
追記しておくと、この一覧からそのURLへリンクされる(未設定の場合は
記事タイトルのみ表示)。

これは「まとめ記事」としてnoteに投稿し、プロフィールに固定したり、
定期的に読者に再案内したりするための土台として使う想定。

使い方:
    python scripts/generate_index.py
"""

import pathlib

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOPICS_PATH = ROOT / "content" / "topics.yaml"
TOPICS_PAID_PATH = ROOT / "content" / "topics_paid.yaml"
OUT_PATH = ROOT / "content" / "index.md"


def load_topics(path: pathlib.Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or []


def group_by_pillar(topics: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = {}
    for t in topics:
        if t.get("status") != "used":
            continue
        groups.setdefault(t["pillar"], []).append(t)
    return groups


def render_section(title: str, groups: dict[str, list[dict]], is_paid: bool) -> list[str]:
    if not groups:
        return []
    lines = [f"## {title}", ""]
    for pillar, topics in groups.items():
        lines.append(f"### {pillar}")
        for t in topics:
            price_note = f"(有料 {t['price']}円)" if is_paid else ""
            url = t.get("published_url")
            label = f"[{t['title']}]({url})" if url else t["title"]
            lines.append(f"- {label} {price_note}".rstrip())
        lines.append("")
    return lines


def main() -> None:
    free_topics = load_topics(TOPICS_PATH)
    paid_topics = load_topics(TOPICS_PAID_PATH)

    free_groups = group_by_pillar(free_topics)
    paid_groups = group_by_pillar(paid_topics)

    total = sum(len(v) for v in free_groups.values()) + sum(len(v) for v in paid_groups.values())
    if total == 0:
        print("公開済み(status=used)の記事がまだありません。")
        return

    lines = ["# 記事まとめ", "", "このページで、これまでの記事を柱ごとに一覧できます。", ""]
    lines += render_section("無料記事", free_groups, is_paid=False)
    lines += render_section("有料記事(ディープダイブ)", paid_groups, is_paid=True)

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"まとめ記事の下書きを書き出しました: {OUT_PATH} (記事数: {total})")
    print("公開済み記事にリンクを貼りたい場合は、topics.yaml/topics_paid.yamlの")
    print("該当項目に `published_url: <note記事のURL>` を追記してから再実行してください。")


if __name__ == "__main__":
    main()
