#!/usr/bin/env python3
"""未使用トピックから投稿カレンダー(CSV)を生成する。

週2本(火・金)を既定として、次の投稿日を自動で割り当てる。
API呼び出しは行わない(ネタ出しの並び替えのみ)ので無料。

使い方:
    python scripts/generate_calendar.py
    python scripts/generate_calendar.py --weeks 8 --days tue fri
"""

import argparse
import csv
import datetime
import pathlib

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOPICS_PATH = ROOT / "content" / "topics.yaml"
CALENDAR_PATH = ROOT / "content" / "calendar.csv"

WEEKDAY_MAP = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
}


def next_post_dates(start: datetime.date, weekdays: list[int], count: int) -> list[datetime.date]:
    dates = []
    d = start
    while len(dates) < count:
        if d.weekday() in weekdays:
            dates.append(d)
        d += datetime.timedelta(days=1)
    return dates


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--weeks", type=int, default=8, help="カレンダーを作る週数(既定8週)")
    parser.add_argument(
        "--days", nargs="+", default=["tue", "fri"],
        help="投稿曜日(既定: tue fri)。mon/tue/wed/thu/fri/sat/sun で指定",
    )
    parser.add_argument("--start", help="開始日(YYYY-MM-DD、省略時は今日)")
    args = parser.parse_args()

    weekdays = [WEEKDAY_MAP[d.lower()] for d in args.days]
    start = (
        datetime.date.fromisoformat(args.start)
        if args.start
        else datetime.date.today()
    )

    with open(TOPICS_PATH, encoding="utf-8") as f:
        topics = yaml.safe_load(f)

    pending = [t for t in topics if t.get("status", "pending") == "pending"]
    slots_per_week = len(weekdays)
    total_slots = args.weeks * slots_per_week
    count = min(total_slots, len(pending))

    if count == 0:
        print("未使用のトピックがありません。content/topics.yaml にトピックを追加してください。")
        return

    dates = next_post_dates(start, weekdays, count)

    with open(CALENDAR_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "topic_id", "pillar", "title"])
        for date, topic in zip(dates, pending[:count]):
            writer.writerow([date.isoformat(), topic["id"], topic["pillar"], topic["title"]])

    print(f"{count}件のカレンダーを生成しました: {CALENDAR_PATH}")
    if count < total_slots:
        shortfall = total_slots - count
        print(
            f"注意: トピックが{shortfall}件不足しています。"
            "content/topics.yaml に新しいトピックを追加してください。"
        )


if __name__ == "__main__":
    main()
