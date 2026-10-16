"""N/A audit & coverage measurement (Phase 1-1 / 1-7).

python3 -m models.audit baseline   # audits data/processed/dashboard_v1_baseline.json → data/phase1/NA_BASELINE_AUDIT.csv
python3 -m models.audit current    # audits current dashboard.json → data/phase1/NA_CURRENT_AUDIT.csv + coverage json

Status taxonomy (Phase 1 spec):
VERIFIED, DERIVED, ESTIMATED_HIGH, ESTIMATED_MEDIUM, ESTIMATED_LOW, INTERNAL_REQUIRED,
INSUFFICIENT_EVIDENCE, NOT_APPLICABLE, ERROR
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

from models.common import PROCESSED, ROOT

OUT = ROOT / "data" / "phase1"
FRONT = ROOT / "frontend" / "src" / "data" / "dashboard.json"

EXTERNAL_FIELDS = [("2026", "TS"), ("2026", "RAW"), ("2026", "FPR"), ("2031", "TS"), ("2031", "RAW"), ("2031", "FPR")]
INTERNAL_FIELDS = [("2026", "CR"), ("2026", "CSOW"), ("2026", "PCR"), ("2026", "UPSIDE"), ("2031", "TARGET"), ("2031", "TARGET_SOW")]
NOT_APPLICABLE = {}  # (account_id, year, metric) -> reason; filled from config/not_applicable.json if present


def rec_of(a: dict, year: str, metric: str) -> dict:
    if year == "2026":
        return a["m"]["2026"][metric]
    b = a["m"]["2031"]["base"]
    return {"TS": b["TS"], "RAW": b["RAW_base"], "FPR": b["FPR_base"], "TARGET": a["m"]["target"]["TARGET"],
            "TARGET_SOW": a["m"]["target"]["TARGET_SOW"]}[metric]


def grade(rec: dict) -> str:
    st, c = rec["status"], rec.get("confidence", 0) or 0
    if st in ("VERIFIED", "DERIVED"):
        return st
    if rec.get("grade"):  # v2 engine supplies an explicit grade
        return rec["grade"]
    if st == "SCENARIO":
        return "ESTIMATED_LOW"
    if c >= 60:
        return "ESTIMATED_HIGH"
    if c >= 40:
        return "ESTIMATED_MEDIUM"
    return "ESTIMATED_LOW"


def classify(a: dict, year: str, metric: str, na_cfg: dict) -> tuple[str, str]:
    key = f"{a['account_id']}|{year}|{metric}"
    if key in na_cfg:
        return "NOT_APPLICABLE", na_cfg[key]
    rec = rec_of(a, year, metric)
    errs = [i for i in a["issues"] if i["severity"] == "ERROR" and (i.get("metric") in (metric, None))]
    if errs:
        return "ERROR", errs[0]["message"]
    internal = (year, metric) in INTERNAL_FIELDS
    if internal:
        if metric == "TARGET" and rec["status"] == "SCENARIO" and not any("경영진 입력" in n for n in rec.get("notes", [])):
            return "INTERNAL_REQUIRED", "경영진 목표 미입력 — 화면에는 FPR×50% 시나리오 표시값만 존재"
        if metric == "TARGET_SOW" and rec["status"] == "SCENARIO":
            return "INTERNAL_REQUIRED", "Target이 시나리오 값 — 경영진 목표 입력 필요"
        if rec["value"] is None:
            return "INTERNAL_REQUIRED", "사내 CR(현재 매출) 미입력" if metric != "TARGET" else "FPR 미산출"
        return grade(rec), "사내 입력 반영"
    if rec["value"] is None:
        return "INSUFFICIENT_EVIDENCE", f"앵커 {a['anchor']['method']} — " + (a.get("override_notes") or ["근거 부족"])[0][:120]
    return grade(rec), f"{a['anchor']['method']} · conf {rec.get('confidence')}"


def load_na_cfg() -> dict:
    p = ROOT / "config" / "not_applicable.json"
    cfg = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return {k: v for k, v in cfg.items() if not k.startswith("_")}


def audit(dash: dict, label: str) -> list[dict]:
    na_cfg = load_na_cfg()
    rows = []
    for a in dash["accounts"]:
        for (y, m) in EXTERNAL_FIELDS + INTERNAL_FIELDS:
            rec = rec_of(a, y, m)
            st, reason = classify(a, y, m, na_cfg)
            rows.append({"audit": label, "account_id": a["account_id"], "original_name": a["original_name"], "segment": a["segment"],
                         "year": y, "metric": m, "scope": "EXTERNAL" if (y, m) in EXTERNAL_FIELDS else "INTERNAL",
                         "value_eok_or_ratio": "" if rec["value"] is None else round(rec["value"], 4),
                         "engine_status": rec["status"], "confidence": rec.get("confidence"), "na_class": st,
                         "displayed_as_na": rec["value"] is None, "cause": reason})
    return rows


def frontend_sync_check(dash: dict) -> list[str]:
    """Value exists in processed DB output but frontend bundle differs → mapping/sync error."""
    if not FRONT.exists():
        return ["frontend bundle missing"]
    fb = json.loads(FRONT.read_text(encoding="utf-8"))
    errs = []
    if fb["meta"]["data_version"] != dash["meta"]["data_version"]:
        errs.append(f"version mismatch frontend={fb['meta']['data_version']} processed={dash['meta']['data_version']}")
    fa = {a["account_id"]: a for a in fb["accounts"]}
    for a in dash["accounts"]:
        for (y, m) in EXTERNAL_FIELDS + INTERNAL_FIELDS:
            v1, v2 = rec_of(a, y, m)["value"], rec_of(fa[a["account_id"]], y, m)["value"]
            if (v1 is None) != (v2 is None) or (v1 is not None and abs(v1 - v2) > 0.01):
                errs.append(f"{a['account_id']} {y} {m}: processed={v1} frontend={v2}")
    return errs


def coverage(rows: list[dict]) -> dict:
    ext = [r for r in rows if r["scope"] == "EXTERNAL" and r["na_class"] != "NOT_APPLICABLE"]
    ok = {"VERIFIED", "DERIVED", "ESTIMATED_HIGH", "ESTIMATED_MEDIUM", "ESTIMATED_LOW"}
    from collections import Counter
    return {"external_fields": len(ext), "external_covered": sum(r["na_class"] in ok for r in ext),
            "external_coverage": round(sum(r["na_class"] in ok for r in ext) / max(1, len(ext)), 4),
            "external_missing": sum(r["na_class"] == "INSUFFICIENT_EVIDENCE" for r in ext),
            "verified_or_derived": sum(r["na_class"] in ("VERIFIED", "DERIVED") for r in ext),
            "internal_required": sum(r["na_class"] == "INTERNAL_REQUIRED" for r in rows),
            "not_applicable": sum(r["na_class"] == "NOT_APPLICABLE" for r in rows),
            "errors": sum(r["na_class"] == "ERROR" for r in rows),
            "by_class": dict(Counter(r["na_class"] for r in rows))}


def write(rows, path):
    OUT.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "current"
    if mode == "baseline":
        d = json.loads((PROCESSED / "dashboard_v1_baseline.json").read_text(encoding="utf-8"))
        rows = audit(d, "v1_baseline")
        write(rows, OUT / "NA_BASELINE_AUDIT.csv")
        cov = coverage(rows)
        (OUT / "baseline_coverage.json").write_text(json.dumps(cov, ensure_ascii=False, indent=1), encoding="utf-8")
    else:
        d = json.loads((PROCESSED / "dashboard.json").read_text(encoding="utf-8"))
        rows = audit(d, "current")
        write(rows, OUT / "NA_CURRENT_AUDIT.csv")
        cov = coverage(rows)
        cov["frontend_sync_errors"] = frontend_sync_check(d)
        base = json.loads((OUT / "baseline_coverage.json").read_text(encoding="utf-8"))
        b_rows = {(r["account_id"], r["year"], r["metric"]): r for r in csv.DictReader(open(OUT / "NA_BASELINE_AUDIT.csv", encoding="utf-8-sig"))}
        missing0 = [k for k, r in b_rows.items() if r["scope"] == "EXTERNAL" and r["na_class"] == "INSUFFICIENT_EVIDENCE"]
        okc = {"VERIFIED", "DERIVED", "ESTIMATED_HIGH", "ESTIMATED_MEDIUM", "ESTIMATED_LOW"}
        now = {(r["account_id"], r["year"], r["metric"]): r for r in rows}
        recovered = [k for k in missing0 if now[k]["na_class"] in okc]
        cov["baseline"] = base
        cov["initial_external_missing"] = len(missing0)
        cov["recovered_external_fields"] = len(recovered)
        cov["na_recovery_rate"] = round(len(recovered) / max(1, len(missing0)), 4)
        cov["recovered_keys"] = ["|".join(k) for k in recovered]
        (OUT / "current_coverage.json").write_text(json.dumps(cov, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in cov.items() if k not in ("recovered_keys", "baseline")}, ensure_ascii=False, indent=1))
