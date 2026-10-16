"""Validate data/raw/research/KAxx.json files against RESEARCH_PROTOCOL schema.

Usage: python3 -m research.parsers.validate_research [--summary]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / "data" / "raw" / "research"
ALLOWED_FACT_STATUS = {"VERIFIED", "DERIVED", "SECONDARY_UNCONFIRMED"}


def validate(path: Path) -> list[str]:
    errs = []
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"JSON parse error: {e}"]
    for k in ("account_id", "entity", "facts", "evidence", "research_log"):
        if k not in d:
            errs.append(f"missing key {k}")
    ev_ids = {e.get("evidence_id") for e in d.get("evidence", [])}
    for e in d.get("evidence", []):
        if not e.get("source_url") and e.get("source_type") != "BENCHMARK":
            errs.append(f"{e.get('evidence_id')}: no source_url")
    for f in d.get("facts", []):
        fid = f.get("fact_id")
        if f.get("verification_status") not in ALLOWED_FACT_STATUS:
            errs.append(f"{fid}: bad verification_status {f.get('verification_status')}")
        if not f.get("evidence_ids"):
            errs.append(f"{fid}: no evidence_ids")
        for eid in f.get("evidence_ids", []):
            if eid not in ev_ids:
                errs.append(f"{fid}: dangling evidence {eid}")
        if f.get("value") in (None, ""):
            errs.append(f"{fid}: empty value")
        if not f.get("unit"):
            errs.append(f"{fid}: no unit")
    st = d.get("entity", {}).get("entity_status")
    if st not in ("CONFIRMED", "PROBABLE", "UNCERTAIN"):
        errs.append(f"entity_status invalid: {st}")
    return errs


def summary(path: Path) -> str:
    d = json.loads(path.read_text(encoding="utf-8"))
    fs = d.get("facts", [])
    v = sum(1 for f in fs if f.get("verification_status") == "VERIFIED")
    s = sum(1 for f in fs if f.get("verification_status") == "SECONDARY_UNCONFIRMED")
    kisa = [f"{f['fiscal_year']}:{f['value']}{f.get('unit','')}" for f in fs if f.get("metric") == "kisa_it_investment"]
    return (f"{d['account_id']} {d.get('original_name','')[:14]:14} ent={d['entity'].get('entity_status')} "
            f"corp={d['entity'].get('corp_code')} facts={len(fs)} V={v} S={s} ev={len(d.get('evidence', []))} "
            f"drv={len(d.get('drivers', []))} kisa_it={kisa}")


if __name__ == "__main__":
    bad = 0
    for p in sorted(RES.glob("KA*.json")):
        errs = validate(p)
        if errs:
            bad += 1
            print(f"[FAIL] {p.name}: {len(errs)} issues -> {errs[:6]}")
        if "--summary" in sys.argv and not errs:
            print("[OK]  " + summary(p))
    sys.exit(1 if bad else 0)
