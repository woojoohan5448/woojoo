"""N/A Recovery Priority Engine (Phase 1-3). python3 -m models.priority → data/phase1/NA_RECOVERY_PLAN.csv

priority = 30·strategic + 25·impact + 20·availability + 15·uncertainty + 10·dashboard_need   (0–100)
- strategic   : segment-family weight (ANALYST ASSUMPTION — LG U+ 사업 연관도; 내부 우선순위로 교체 필요)
- impact      : log-scaled size proxy (TS if estimated, else revenue/SG&A fact, else family median)
- availability: listed/KISA-mandatory 1.0, audit-report filer (MyDART) 0.8, foreign entity w/ KR audit report 0.5, no filer 0.3
- uncertainty : INSUFFICIENT 1.0, ESTIMATED_LOW 0.7, MEDIUM 0.4, HIGH 0.1
- dashboard_need: number of external fields missing / 6
Also flags internal_only (CR/Target) — never researchable externally.
"""
from __future__ import annotations

import csv
import json
import math

from models.common import PROCESSED, ROOT, to_eok

FAMILY_W = {"HYPERSCALER": 1.0, "CLOUD_DC": 1.0, "PLATFORM": 0.9, "FIN": 0.8, "FINTECH": 0.7, "ITS": 0.7, "DC_FUND": 0.7,
            "PUBLIC": 0.6, "GLOBAL_NET": 0.6, "INDUSTRY": 0.5, "RETAIL_SVC": 0.5, "DEFENSE": 0.5}
UNC = {"INSUFFICIENT_EVIDENCE": 1.0, "ESTIMATED_LOW": 0.7, "ESTIMATED_MEDIUM": 0.4, "ESTIMATED_HIGH": 0.1, "VERIFIED": 0.0, "DERIVED": 0.0}


def main():
    d = json.loads((PROCESSED / "dashboard_v1_baseline.json").read_text(encoding="utf-8"))
    audit = list(csv.DictReader(open(ROOT / "data" / "phase1" / "NA_BASELINE_AUDIT.csv", encoding="utf-8-sig")))
    rows = []
    for a in d["accounts"]:
        ext = [r for r in audit if r["account_id"] == a["account_id"] and r["scope"] == "EXTERNAL"]
        ts_cls = next(r["na_class"] for r in ext if r["year"] == "2026" and r["metric"] == "TS")
        missing = sum(r["na_class"] == "INSUFFICIENT_EVIDENCE" for r in ext)
        ts = a["m"]["2026"]["TS"]["value"]
        size = ts
        if size is None:
            for f in a["facts"]:
                if f["metric"] in ("revenue", "operating_revenue", "sga", "korea_revenue") and f.get("unit") in ("원", "억원", "백만원"):
                    v = to_eok(f["value"], f["unit"])
                    size = float(v) * (0.12 if f["metric"] == "sga" else 0.03) if v else None
                    break
        impact = min(1.0, math.log10(max(size or 300, 10)) / math.log10(30000))
        e = a["entity"]
        listed = bool(e.get("stock_code"))
        avail = 1.0 if listed else 0.8 if e.get("corp_code") and e.get("is_korean_entity", True) else 0.5 if e.get("corp_code") else 0.3
        if a["segment"] in ("GLOBAL_TECH", "HYPERSCALER", "GLOBAL_CARRIER") and not listed:
            avail = 0.5 if e.get("corp_code") else 0.3
        fam_w = FAMILY_W.get(a["family"], 0.5)
        score = 30 * fam_w + 25 * impact + 20 * avail + 15 * UNC.get(ts_cls, 0.5) + 10 * missing / 6
        plan = []
        if ts_cls == "INSUFFICIENT_EVIDENCE":
            plan.append("L1 KISA/IT예산 → L2 MyDART 감사보고서 IT비용 주석 → L4/L5 비교기업·인원 → L6 시나리오")
        elif ts_cls == "ESTIMATED_LOW":
            plan.append("L1 KISA 금액 확보로 집약도 추정 대체 → L2 IT비용 주석 교차검증")
        else:
            plan.append("교차검증·반박근거 탐색(과대/과소)")
        rows.append({"account_id": a["account_id"], "original_name": a["original_name"], "family": a["family"],
                     "ts_2026_class": ts_cls, "external_missing_fields": missing, "size_proxy_eok": round(size, 1) if size else "",
                     "strategic_w": fam_w, "impact": round(impact, 3), "availability": avail, "uncertainty": UNC.get(ts_cls, 0.5),
                     "priority_score": round(score, 1), "recovery_plan": plan[0],
                     "internal_only_fields": "CR, C-SOW, PCR, Upside, Target, Target SOW (사내 데이터)",
                     "formula": "30·strategic + 25·impact + 20·availability + 15·uncertainty + 10·missing/6"})
    rows.sort(key=lambda r: -r["priority_score"])
    for i, r in enumerate(rows, 1):
        r["rank"] = i
        r["batch"] = "P1-B1" if r["account_id"] in ("KA24", "KA35", "KA52", "KA38", "KA41") else \
            "P1-B2" if r["account_id"] in ("KA36", "KA34", "KA31", "KA15", "KA49", "KA10") else \
            "P1-B3a" if r["account_id"] in ("KA06", "KA07", "KA46") else \
            "P1-B3b" if r["account_id"] in ("KA45", "KA44", "KA42", "KA43") else \
            "P1-B4" if r["account_id"] in ("KA50", "KA28", "KA32", "KA08") else \
            "P1-B5" if r["account_id"] in ("KA04", "KA20", "KA21", "KA22", "KA23", "KA25", "KA03", "KA18", "KA19") else \
            "P1-B6" if r["account_id"] in ("KA05", "KA12", "KA11", "KA13", "KA40", "KA17", "KA16") else \
            "P1-B7" if r["account_id"] in ("KA02", "KA30", "KA53", "KA48", "KA47", "KA01") else "VALIDATION_ONLY"
    out = ROOT / "data" / "phase1" / "NA_RECOVERY_PLAN.csv"
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["rank"] + [k for k in rows[0] if k != "rank"])
        w.writeheader(); w.writerows(rows)
    print(f"wrote {out} ({len(rows)} accounts); top5:", [(r["account_id"], r["priority_score"], r["batch"]) for r in rows[:5]])


if __name__ == "__main__":
    main()
