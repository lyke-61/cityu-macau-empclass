#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 urp.cityu.edu.mo 的 RoomsBroadcast 页面抓取教室占用表，输出 rooms.json。

只依赖 Python 标准库，GitHub Actions 里不用装任何东西。

用法：
    python3 scraper/fetch_rooms.py                # 抓线上并写入 data/rooms.json
    python3 scraper/fetch_rooms.py --out x.json   # 指定输出
    python3 scraper/fetch_rooms.py --offline 目录 # 用本地已保存的 html 调试
"""

import argparse
import html
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = "https://urp.cityu.edu.mo/RoomManagement/RoomsBroadcast.aspx?BuildID=TC&FloorID={code}"

# 六栋楼。只保留含「課室」的房间（可自习）。
BUILDINGS = [
    ("L", "中葡樓"),
    ("N", "蔡繼有樓"),
    ("S", "何鴻燊樓"),
    ("T", "大豐樓"),
    ("W", "王寬誠樓"),
    ("H", "何賢會議中心"),
]

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

DAY_START_HOUR = 8      # 表格从 8:00 开始
SLOT_MINUTES = 10       # 每格 10 分钟
SLOTS_PER_DAY = 96      # 16 小时 × 6 格
KEEP_KEYWORD = "課室"    # 只留这类房间

MACAU_TZ = timezone(timedelta(hours=8))


def fetch(code, offline_dir=None):
    """取一个楼栋的 HTML。带 UA 是必须的，否则服务器返回 System Error 页。"""
    if offline_dir:
        path = f"{offline_dir}/b_{code}.html"
        with open(path, encoding="utf-8") as f:
            return f.read()

    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(BASE.format(code=code), headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
                "Referer": "https://urp.cityu.edu.mo/RoomManagement/RoomsBroadcast.aspx",
                "Connection": "close",
            })
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read()
                print(f"    {code}: HTTP {resp.status}, {len(raw)} 字节", file=sys.stderr)
                return raw.decode("utf-8", errors="replace")

        except urllib.error.HTTPError as e:
            body = e.read()[:400].decode("utf-8", errors="replace").replace("\n", " ")
            last = f"HTTP {e.code} {e.reason} | 响应开头: {body}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"

        print(f"    {code}: 第 {attempt + 1} 次失败 —— {last}", file=sys.stderr)
        time.sleep(2 * (attempt + 1))

    raise RuntimeError(f"{code} 抓取失败（已重试 3 次）：{last}")


def clean(text):
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).replace("\xa0", " ").strip()


def parse_page(page, code, building_name):
    """解析一张表，返回 (日期字符串, [房间...])。"""
    if "SystemError" in page:
        raise RuntimeError(f"{code}: 服务器返回错误页（可能被限流或 UA 被拦）")

    m = re.search(r"日期 Date:\s*<a>\s*([\d/]+)\s*</a>", page)
    date_str = m.group(1) if m else ""

    table = re.search(r'<table id="uiTable".*?</table>', page, re.S)
    if not table:
        raise RuntimeError(f"{code}: 页面上找不到 uiTable")
    table = table.group(0)

    rooms = []
    for tr in re.findall(r"<tr>(.*?)</tr>", table, re.S):
        tds = re.findall(r"<td([^>]*)>(.*?)</td>", tr, re.S)
        if not tds:
            continue

        name = clean(tds[0][1])
        if not name or name.startswith("教室名稱"):
            continue  # 表头

        # 第一格的 colspan 恒为 1（房间名），剩余跨度应等于 96
        slots = []
        for attrs, text in tds[1:]:
            cs = re.search(r'colspan="(\d+)"', attrs)
            span = int(cs.group(1)) if cs else 1
            used = "Used" in attrs
            label = clean(text)
            slots.extend([label if used else None] * span)

        if len(slots) != SLOTS_PER_DAY:
            # 数据异常就跳过这一间，避免整站算错
            print(f"  ! {code} {name}: 跨度 {len(slots)} != {SLOTS_PER_DAY}，跳过", file=sys.stderr)
            continue

        if KEEP_KEYWORD not in name:
            continue

        # 相邻且同名的占用格合并成块
        blocks = []
        i = 0
        while i < len(slots):
            if slots[i] is None:
                i += 1
                continue
            j = i
            while j + 1 < len(slots) and slots[j + 1] == slots[i]:
                j += 1
            blocks.append([i, j + 1, slots[i] or "占用"])
            i = j + 1

        rooms.append({
            "room": name,
            "short": re.sub(r"\s*(課室|Classroom|Class Room).*$", "", name).strip(),
            "blocks": blocks,
        })

    return date_str, rooms


def load_holiday(date_iso):
    """从 data/holidays.json 里查当天是不是公众假期。查不到就返回 None。"""
    try:
        with open("data/holidays.json", encoding="utf-8") as f:
            table = json.load(f).get("holidays", {})
    except FileNotFoundError:
        return None
    return table.get(date_iso[5:])  # "YYYY-MM-DD" → "MM-DD"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/rooms.json")
    ap.add_argument("--offline", help="用本地目录里的 b_<code>.html 调试")
    args = ap.parse_args()

    result = {
        "generated_at": datetime.now(MACAU_TZ).isoformat(timespec="seconds"),
        "date": None,
        "day_start_hour": DAY_START_HOUR,
        "slot_minutes": SLOT_MINUTES,
        "slots_per_day": SLOTS_PER_DAY,
        "buildings": [],
    }

    try:
        import socket
        print(f"urp.cityu.edu.mo 解析到 {socket.gethostbyname('urp.cityu.edu.mo')}", file=sys.stderr)
    except Exception as e:
        print(f"DNS 解析失败：{e}", file=sys.stderr)

    total = 0
    for code, name in BUILDINGS:
        page = fetch(code, args.offline)
        date_str, rooms = parse_page(page, code, name)
        if date_str:
            # 页面是 D/M/YYYY，统一成 YYYY-MM-DD
            d, mth, y = date_str.split("/")
            result["date"] = f"{y}-{mth.zfill(2)}-{d.zfill(2)}"
        total += len(rooms)
        result["buildings"].append({"code": code, "name": name, "rooms": rooms})
        print(f"  {code} {name}: {len(rooms)} 间可自习教室", file=sys.stderr)
        if not args.offline:
            time.sleep(0.8)  # 对学校服务器客气一点

    result["room_count"] = total
    result["holiday"] = load_holiday(result["date"]) if result["date"] else None

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))

    print(f"写入 {args.out}：{total} 间教室，日期 {result['date']}", file=sys.stderr)


if __name__ == "__main__":
    main()
