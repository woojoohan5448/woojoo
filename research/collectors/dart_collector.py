"""OpenDART collector (direct API). Requires env DART_API_KEY — never committed, never sent to the frontend.

Usage: DART_API_KEY=xxxx python3 -m research.collectors.dart_collector KA03 [--year 2025]
Writes data/raw/dart/{account_id}_{year}.json and logs failures to data/raw/logs/dart_collector.log.
In the 2026-10-16 build environment opendart.fss.or.kr was not reachable (DNS/proxy) and no key was set,
so financials were collected through the PlayMCP OpenDART MCP connector instead (source_type DART_API).
"""
from __future__ import annotations

import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "raw" / "dart"
LOG = ROOT / "data" / "raw" / "logs" / "dart_collector.log"
API = "https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json"


def log(msg: str):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{datetime.now(timezone.utc).isoformat()} {msg}\n")


def corp_code_for(aid: str) -> str | None:
    p = ROOT / "docs" / "ACCOUNT_MASTER.csv"
    for r in csv.DictReader(open(p, encoding="utf-8-sig")):
        if r["account_id"] == aid:
            return r["corp_code"] or None
    return None


def fetch(aid: str, year: int, fs_div: str = "OFS", retries: int = 3) -> dict | None:
    key = os.environ.get("DART_API_KEY")
    if not key:
        log(f"{aid} SKIP no DART_API_KEY")
        print("DART_API_KEY not set", file=sys.stderr)
        return None
    cc = corp_code_for(aid)
    if not cc:
        log(f"{aid} SKIP no corp_code (entity unresolved)")
        return None
    params = {"crtfc_key": key, "corp_code": cc, "bsns_year": str(year), "reprt_code": "11011", "fs_div": fs_div}
    for i in range(retries):
        try:
            r = requests.get(API, params=params, timeout=20)
            j = r.json()
            if j.get("status") == "000":
                OUT.mkdir(parents=True, exist_ok=True)
                j["_meta"] = {"account_id": aid, "corp_code": cc, "accessed_at": datetime.now(timezone.utc).isoformat(), "fs_div": fs_div}
                (OUT / f"{aid}_{year}_{fs_div}.json").write_text(json.dumps(j, ensure_ascii=False, indent=1), encoding="utf-8")
                log(f"{aid} OK {year} {fs_div} rows={len(j.get('list', []))}")
                return j
            log(f"{aid} API status={j.get('status')} msg={j.get('message')} (retryable={j.get('status') in ('020', '800')})")
            return None
        except Exception as e:  # network errors: retry with backoff
            log(f"{aid} ERROR attempt {i + 1}: {e}")
            time.sleep(2 ** i)
    return None


if __name__ == "__main__":
    aid = sys.argv[1]
    year = int(sys.argv[sys.argv.index("--year") + 1]) if "--year" in sys.argv else 2025
    fetch(aid, year)
