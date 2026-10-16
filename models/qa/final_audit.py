"""Final independent QA audit (read-only over data/processed/dashboard.json).

Outputs (data/qa/):
  METRIC_LEDGER.csv          53 × (2026/2031 TS·RAW·FPR, grade, evidence basis, anchor evidence, formula)
  RATIO_AUDIT.csv            IT/denominator, RAW/TS, FPR/RAW per account + family stats + outlier flags
  FORECAST_DECOMPOSITION.csv 2031 bridge components, U+ capability effect, 2026-error propagation, combined range
  TRACEABILITY.csv           evidence/assumption id resolution per metric record
  qa_summary.json            aggregates used by reports/final_qa_reports.py

python3 -m models.qa.final_audit
"""
from __future__ import annotations

import csv
import json
import statistics as st
from collections import Counter, defaultdict
from pathlib import Path

from models.common import PROCESSED, ROOT

OUT = ROOT / "data" / "qa"
DIRECT = {"KISA_IT_INVESTMENT", "DIRECT_IT_BUDGET"}
RECON = {"KISA_DERIVED", "KISA_SEC_SCALED", "AUDIT_IT_COMPONENTS"}
INDUSTRY = {"REVENUE_INTENSITY", "EMPLOYEE_COMPARABLE"}
REV_METRICS = ("revenue", "operating_revenue")
UNIT = {"원": 1e-8, "천원": 1e-5, "백만원": 1e-2, "억원": 1.0, "조원": 1e4}
CATS = ["CONNECTIVITY", "DC_COLO", "CLOUD", "AI_INFRA", "SECURITY", "SI_BUILD", "IT_OPS", "SW_LICENSE", "HW_DEVICE", "INTERNAL_LABOR"]


def f(v):
    return None if v in (None, "") else float(v)


def evidence_basis(a: dict) -> tuple[str, str]:
    """(basis, source_level) for the 2026 TS anchor — what kind of evidence the number actually rests on."""
    an = a["anchor"]
    m, st_ = an["method"], an.get("fact_status")
    if m == "UNKNOWN":
        if a["m"]["2026"]["RAW"]["value"] is not None:
            return "CONTRACT_DIRECT_RAW", "SECONDARY"
        return "NONE", "-"
    if m in DIRECT and st_ != "DERIVED":
        return "DIRECT_IT_DISCLOSURE", "PRIMARY" if (st_ == "VERIFIED" and an.get("tier") == 1) else "SECONDARY_PRESS"
    if m in DIRECT or m in RECON:
        if m == "KISA_SEC_SCALED" and "업종" in (an.get("formula") or ""):
            return "INDUSTRY_AVERAGE", "SECONDARY_PRESS"
        lvl = "PRIMARY_INPUTS" if (an.get("input_fact_status") or st_) == "VERIFIED" else "SECONDARY_INPUTS"
        return "RECONSTRUCTED_FINANCIALS", lvl
    if m in INDUSTRY:
        return "INDUSTRY_AVERAGE", "BENCHMARK"
    if m == "ACCOUNT_SPECIFIC":
        if st_ == "SCENARIO" or "시나리오" in (an.get("formula") or ""):
            return "SCENARIO", "MIXED"
        return "RECONSTRUCTED_FINANCIALS", "PRIMARY_INPUTS" if an.get("tier") == 1 else "SECONDARY_INPUTS"
    return "OTHER", "-"


def latest_revenue(a: dict) -> tuple[float | None, int | None, str]:
    cands = []
    for fa in a["facts"]:
        if fa.get("metric") in REV_METRICS and fa.get("value") not in (None, "") and fa.get("unit") in UNIT:
            sc = fa.get("scope") or ""
            pref = 0 if ("별도" in sc or "법인" in sc) else 1
            cands.append((-(int(fa.get("fiscal_year") or 0)), pref, float(fa["value"]) * UNIT[fa["unit"]], fa))
    if not cands:
        return None, None, ""
    cands.sort(key=lambda x: (x[0], x[1]))
    _, _, v, fa = cands[0]
    return v, int(fa.get("fiscal_year") or 0), fa.get("fact_id", "")


def latest_fact(a, metric):
    fs = [x for x in a["facts"] if x.get("metric") == metric and x.get("value") not in (None, "") and x.get("unit") in UNIT]
    if not fs:
        return None
    x = max(fs, key=lambda x: int(x.get("fiscal_year") or 0))
    return float(x["value"]) * UNIT[x["unit"]]


def q(xs, p):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def run(dash_path: Path | None = None) -> dict:
    d = json.loads((dash_path or PROCESSED / "dashboard.json").read_text(encoding="utf-8"))
    pev = set(k for k in d.get("parameter_evidence", {}) if not k.startswith("_"))
    pev |= {k.split(".")[0] for k in pev}
    calib = d.get("intensity_calibration", {})
    OUT.mkdir(parents=True, exist_ok=True)
    ledger, ratios, fc, trace = [], [], [], []
    for a in d["accounts"]:
        aid, m26, m31 = a["account_id"], a["m"]["2026"], a["m"]["2031"]
        an = a["anchor"]
        basis, lvl = evidence_basis(a)
        mismatch = bool(an.get("definition_note"))
        ev_by_id = {e["evidence_id"]: e for e in a["evidence"]}
        anc_ev = [ev_by_id.get(i, {}) for i in an.get("evidence_ids") or []]
        b = m31["base"]
        row = {
            "account_id": aid, "name": a["original_name"], "segment": a["segment"], "family": a["family"],
            "anchor_method": an["method"], "anchor_fy": an.get("fiscal_year"), "anchor_value_eok": an.get("value"),
            "anchor_fact_status": an.get("fact_status"), "anchor_input_fact_status": an.get("input_fact_status", ""),
            "evidence_basis": basis, "source_level": lvl, "definition_mismatch": mismatch,
            "anchor_evidence_ids": ";".join(an.get("evidence_ids") or []),
            "anchor_source_types": ";".join(sorted({e.get("source_type", "?") for e in anc_ev})),
            "anchor_evidence_status": ";".join(sorted({e.get("verification_status", "?") for e in anc_ev})),
            "research_status": a["research_status"],
        }
        for k in ("TS", "RAW", "FPR"):
            r = m26[k]
            row[f"{k}_2026"], row[f"{k}_2026_low"], row[f"{k}_2026_high"] = r["value"], r.get("low"), r.get("high")
            row[f"{k}_2026_status"], row[f"{k}_2026_grade"] = r["status"], r.get("grade") or a["na_class"].get(f"2026|{k}", {}).get("class")
        for k, key in (("TS", "TS"), ("RAW", "RAW_base"), ("FPR", "FPR_base")):
            row[f"{k}_2031_base"] = b[key]["value"]
            row[f"{k}_2031_low"] = m31["low"][key]["value"]
            row[f"{k}_2031_high"] = m31["high"][key]["value"]
            row[f"{k}_2031_grade"] = b[key].get("grade") or a["na_class"].get(f"2031|{k}", {}).get("class")
        row["RAW_2031_expansion"] = b["RAW_expansion"]["value"]
        row["FPR_2031_expansion"] = b["FPR_expansion"]["value"]
        row["TS_2026_formula"] = m26["TS"]["formula"]
        ledger.append(row)

        # ---------- traceability: every id on a metric record must resolve
        recs = [("2026", k, m26[k]) for k in ("TS", "RAW", "FPR")] + \
               [("2031", k, b[key]) for k, key in (("TS", "TS"), ("RAW", "RAW_base"), ("FPR", "FPR_base"))]
        for y, k, r in recs:
            if r["value"] is None:
                continue
            missing_ev = [i for i in r.get("evidence_ids", []) if i not in ev_by_id]
            missing_as = [i for i in r.get("assumption_ids", []) if i not in pev and i.split(".")[0] not in pev]
            trace.append({"account_id": aid, "year": y, "metric": k, "n_evidence": len(r.get("evidence_ids", [])),
                          "n_assumptions": len(r.get("assumption_ids", [])), "has_formula": bool(r.get("formula")),
                          "missing_evidence_ids": ";".join(missing_ev), "unregistered_assumption_ids": ";".join(missing_as),
                          "ok": bool(r.get("formula")) and not missing_ev and (len(r.get("evidence_ids", [])) > 0 or basis == "INDUSTRY_AVERAGE")})

        # ---------- ratios (2026)
        ts, raw, fpr = f(m26["TS"]["value"]), f(m26["RAW"]["value"]), f(m26["FPR"]["value"])
        rev, rev_fy, rev_id = latest_revenue(a)
        cal = calib.get(a["family"], {})
        denom_kind = cal.get("denominator", "revenue")
        denom = latest_fact(a, "sga") if denom_kind == "sga" else rev
        ratios.append({
            "account_id": aid, "name": a["original_name"], "family": a["family"], "evidence_basis": basis,
            "definition_mismatch": mismatch, "TS_2026": ts, "revenue_eok": rev, "revenue_fy": rev_fy, "revenue_fact": rev_id,
            "denominator": denom_kind, "denominator_eok": denom,
            "it_ratio": (ts / denom) if (ts and denom) else None,
            "it_to_revenue": (ts / rev) if (ts and rev) else None,
            "bench_low": cal.get("low"), "bench_high": cal.get("high"),
            "raw_to_ts": (raw / ts) if (ts and raw is not None) else None,
            "fpr_to_raw": (fpr / raw) if (raw and fpr is not None) else None,
        })

        # ---------- 2031 forecast decomposition
        ts31 = f(b["TS"]["value"])
        if ts and ts31:
            comp = {k: f(v) or 0.0 for k, v in (b["bridge"] or {}).get("components", {}).items()}
            infra = comp.get("infra", 0.0) + comp.get("other", 0.0)
            ts31_by = b["TS"].get("by_cat") or {}
            rates, caps = a.get("rates_2026") or {}, a.get("caps_2026") or {}
            fpr31_at26 = sum(f(ts31_by.get(c)) * rates.get(c, 0) * caps.get(c, 0) for c in CATS if ts31_by.get(c) is not None)
            fpr31 = f(b["FPR_base"]["value"]) or 0.0
            fpr31x = f(b["FPR_expansion"]["value"]) or 0.0
            lo26, hi26 = f(m26["TS"].get("low")), f(m26["TS"].get("high"))
            lo31, hi31 = f(m31["low"]["TS"]["value"]), f(m31["high"]["TS"]["value"])
            comb_lo = lo31 * lo26 / ts if (lo31 and lo26) else None
            comb_hi = hi31 * hi26 / ts if (hi31 and hi26) else None
            fc.append({
                "account_id": aid, "family": a["family"], "evidence_basis": basis, "TS_2026": ts, "TS_2031": ts31,
                "multiplier": ts31 / ts, "ts_cagr": (ts31 / ts) ** 0.2 - 1,
                **{f"c_{k}": v for k, v in comp.items()},
                "share_organic": comp.get("organic", 0) / (ts31 - ts) if ts31 != ts else None,
                "share_ai": comp.get("ai", 0) / (ts31 - ts) if ts31 != ts else None,
                "account_specific_infra": infra,
                # error propagation: proportional part scales 1:1 with TS_2026, absolute infra does not
                "elasticity_ts31_to_ts26": (ts31 - infra) / ts31,
                "abs_error_per_10pct_ts26": 0.1 * (ts31 - infra),
                "FPR_2026": fpr, "FPR_2031_base": fpr31, "FPR_2031_expansion": fpr31x,
                "FPR_2031_at_2026_rates": fpr31_at26,
                "fpr_growth_from_ts": fpr31_at26 - (fpr or 0), "fpr_growth_from_uplus_capability": fpr31 - fpr31_at26,
                "fpr_growth_from_expansion_case": fpr31x - fpr31,
                "ts26_band_pct": ((hi26 - lo26) / ts) if (lo26 and hi26) else None,
                "ts31_scenario_band_pct": ((hi31 - lo31) / ts31) if (lo31 and hi31) else None,
                "ts31_combined_low": comb_lo, "ts31_combined_high": comb_hi,
                "ts31_combined_band_pct": ((comb_hi - comb_lo) / ts31) if (comb_lo and comb_hi) else None,
            })

    # ---------- family stats & outliers (definition-mismatch and scenario rows excluded from the peer set)
    fam = defaultdict(list)
    for r in ratios:
        if not r["definition_mismatch"]:
            fam[r["family"]].append(r)
    fam_stats = {}
    for k, rs in fam.items():
        s = {}
        for key in ("it_ratio", "raw_to_ts", "fpr_to_raw"):
            xs = [r[key] for r in rs if r[key] is not None]
            s[key] = {"n": len(xs), "median": st.median(xs) if xs else None, "q1": q(xs, .25), "q3": q(xs, .75),
                      "min": min(xs) if xs else None, "max": max(xs) if xs else None}
        fam_stats[k] = s
    allraw = [r["raw_to_ts"] for r in ratios if r["raw_to_ts"] is not None and not r["definition_mismatch"]]
    allfpr = [r["fpr_to_raw"] for r in ratios if r["fpr_to_raw"] is not None and not r["definition_mismatch"]]
    gq = {"raw_to_ts": (q(allraw, .25), q(allraw, .75)), "fpr_to_raw": (q(allfpr, .25), q(allfpr, .75))}
    for r in ratios:
        flags = []
        if r["definition_mismatch"]:
            flags.append("EXCLUDED_DEFINITION_MISMATCH")
        else:
            ir, lo, hi = r["it_ratio"], r["bench_low"], r["bench_high"]
            if ir is not None and hi and ir > 2 * hi:
                flags.append("IT_RATIO_GT_2X_BENCH_HIGH")
            if ir is not None and lo and ir < 0.5 * lo:
                flags.append("IT_RATIO_LT_HALF_BENCH_LOW")
            if r["it_to_revenue"] is not None and r["it_to_revenue"] > 0.30 and r["family"] not in ("CLOUD_DC", "HYPERSCALER", "DC_FUND", "GLOBAL_NET"):
                flags.append("IT_GT_30PCT_REVENUE")
            for key in ("raw_to_ts", "fpr_to_raw"):
                v = r[key]
                q1, q3 = gq[key]
                if v is not None and q1 is not None:
                    iqr = q3 - q1
                    if v > q3 + 1.5 * iqr:
                        flags.append(f"{key.upper()}_HIGH_OUTLIER")
                    if v < q1 - 1.5 * iqr:
                        flags.append(f"{key.upper()}_LOW_OUTLIER")
            if r["fpr_to_raw"] is not None and r["fpr_to_raw"] > 0.45 + 1e-9:
                flags.append("FPR_RAW_ABOVE_MAX_CAP")
        r["flags"] = ";".join(flags)

    def write(name, rows):
        if not rows:
            return
        keys = list(dict.fromkeys(k for r in rows for k in r))
        with (OUT / name).open("w", newline="", encoding="utf-8-sig") as fh:
            w = csv.DictWriter(fh, fieldnames=keys)
            w.writeheader()
            for r in rows:
                w.writerow({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()})

    write("METRIC_LEDGER.csv", ledger)
    write("RATIO_AUDIT.csv", ratios)
    write("FORECAST_DECOMPOSITION.csv", fc)
    write("TRACEABILITY.csv", trace)
    sens = sensitivity(d, ledger)
    write("SENSITIVITY.csv", sens)

    # ---------- aggregates
    comparable = [r for r in ledger if not r["definition_mismatch"]]
    tot = lambda rows, k: sum(f(r[k]) or 0 for r in rows)  # noqa: E731
    basis_ct = Counter(r["evidence_basis"] for r in ledger)
    ts_by_basis = defaultdict(float)
    for r in comparable:
        ts_by_basis[r["evidence_basis"]] += f(r["TS_2026"]) or 0
    status_any_verified = [(r["account_id"], k) for r in ledger for k in ("TS", "RAW", "FPR") if r[f"{k}_2026_status"] == "VERIFIED"]
    comp_rows = [r for r in ledger if not r["definition_mismatch"] and r["FPR_2026"] is not None]
    fpr_tot = sum(f(r["FPR_2026"]) for r in comp_rows) or 1
    top5 = sorted(comp_rows, key=lambda r: -f(r["FPR_2026"]))[:5]
    by_grade = defaultdict(float)
    for r in comp_rows:
        by_grade[r["FPR_2026_grade"]] += f(r["FPR_2026"])
    summary = {
        "sensitivity": sens,
        "concentration": {"fpr2026_comparable_total": round(fpr_tot, 1),
                          "top5": [(r["account_id"], r["name"], round(f(r["FPR_2026"]), 1)) for r in top5],
                          "top5_share": round(sum(f(r["FPR_2026"]) for r in top5) / fpr_tot, 3),
                          "fpr2026_by_grade": {k: round(v, 1) for k, v in by_grade.items()}},
        "data_version": d["meta"]["data_version"], "contains_internal_data": d["meta"].get("contains_internal_data"),
        "n_accounts": len(ledger), "evidence_basis": dict(basis_ct),
        "source_level": dict(Counter((r["evidence_basis"], r["source_level"]) for r in ledger).most_common()) and
        {f"{k[0]}|{k[1]}": v for k, v in Counter((r["evidence_basis"], r["source_level"]) for r in ledger).items()},
        "definition_mismatch_accounts": [r["account_id"] for r in ledger if r["definition_mismatch"]],
        "metric_records_with_status_VERIFIED": status_any_verified,
        "research_status": dict(Counter(r["research_status"] for r in ledger)),
        "comparable_totals": {k: round(tot(comparable, k), 1) for k in ("TS_2026", "RAW_2026", "FPR_2026", "TS_2031_base", "RAW_2031_base", "FPR_2031_base", "FPR_2031_expansion")},
        "mismatch_totals": {k: round(tot([r for r in ledger if r["definition_mismatch"]], k), 1) for k in ("TS_2026", "FPR_2026", "FPR_2031_base")},
        "comparable_ts2026_by_basis": {k: round(v, 1) for k, v in ts_by_basis.items()},
        "grades_2026_TS": dict(Counter(r["TS_2026_grade"] for r in ledger)),
        "family_stats": fam_stats, "global_quartiles": gq,
        "ratio_flags": {r["account_id"]: r["flags"] for r in ratios if r["flags"] and r["flags"] != "EXCLUDED_DEFINITION_MISMATCH"},
        "traceability": {"records": len(trace), "ok": sum(t["ok"] for t in trace),
                         "missing_evidence": [t for t in trace if t["missing_evidence_ids"]],
                         "unregistered_assumptions": sorted({i for t in trace for i in t["unregistered_assumption_ids"].split(";") if i}),
                         "no_evidence_records": [f"{t['account_id']}|{t['year']}|{t['metric']}" for t in trace if t["n_evidence"] == 0]},
        "forecast": {
            "n": len(fc),
            "multiplier_median": st.median([x["multiplier"] for x in fc]),
            "multiplier_max": max(fc, key=lambda x: x["multiplier"])["account_id"] if fc else None,
            "elasticity_min": min(x["elasticity_ts31_to_ts26"] for x in fc),
            "comparable_fpr31_from_ts": round(sum(x["fpr_growth_from_ts"] for x in fc if x["account_id"] not in {r["account_id"] for r in ledger if r["definition_mismatch"]}), 1),
            "comparable_fpr31_from_uplus": round(sum(x["fpr_growth_from_uplus_capability"] for x in fc if x["account_id"] not in {r["account_id"] for r in ledger if r["definition_mismatch"]}), 1),
            "comparable_fpr31_from_expansion": round(sum(x["fpr_growth_from_expansion_case"] for x in fc if x["account_id"] not in {r["account_id"] for r in ledger if r["definition_mismatch"]}), 1),
            "median_ts26_band": st.median([x["ts26_band_pct"] for x in fc if x["ts26_band_pct"] is not None]),
            "median_ts31_scenario_band": st.median([x["ts31_scenario_band_pct"] for x in fc if x["ts31_scenario_band_pct"] is not None]),
            "median_ts31_combined_band": st.median([x["ts31_combined_band_pct"] for x in fc if x["ts31_combined_band_pct"] is not None]),
        },
    }
    (OUT / "qa_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return summary


def sensitivity(d: dict, ledger: list[dict]) -> list[dict]:
    """Quantified over-estimation scenarios for assumptions that QA could not verify (no value is changed)."""
    A = {a["account_id"]: a for a in d["accounts"]}
    L = {r["account_id"]: r for r in ledger}
    p = json.loads((ROOT / "config" / "model_parameters.json").read_text(encoding="utf-8"))
    cm = p["component_model"]
    out = []
    bank_like = {"KA23"}
    for aid, spec in cm["accounts"].items():
        cov_key = spec["coverage"] if isinstance(spec, dict) else spec
        a = A.get(aid)
        if not a or a["anchor"]["method"] != "AUDIT_IT_COMPONENTS":
            continue
        base_cov = cm["coverage"][cov_key]["values"][1]
        ts, raw, fpr = (f(a["m"]["2026"][k]["value"]) for k in ("TS", "RAW", "FPR"))
        alts = [0.6, 0.7] if (cov_key.startswith("FIN") and aid not in bank_like) else [cm["coverage"][cov_key]["values"][0]]
        for c in alts:
            k = base_cov / c
            out.append({"risk_id": "S1_COVERAGE" if cov_key.startswith("FIN") else "S2_COVERAGE_ASSUMED", "account_id": aid,
                        "name": a["original_name"], "assumption": f"{cov_key} 포괄률 {base_cov} → {c}",
                        "why": "은행 2곳 실측 포괄률을 카드·증권·보험에 적용" if cov_key.startswith("FIN") else "실측 없는 분석가 가정",
                        "TS_base": ts, "TS_alt": ts * k, "FPR_base": fpr, "FPR_alt": fpr * k, "delta_pct": k - 1})
    for aid in ("KA09", "KA29"):
        a = A[aid]
        lab = a["mix"].get("INTERNAL_LABOR", 0.2)
        raw, fpr = f(a["m"]["2026"]["RAW"]["value"]), f(a["m"]["2026"]["FPR"]["value"])
        for alt in (0.35, 0.5):
            k = (1 - alt) / (1 - lab)
            out.append({"risk_id": "S3_PLATFORM_LABOR", "account_id": aid, "name": a["original_name"],
                        "assumption": f"IT 인건비 비중 {lab:.2f} → {alt}",
                        "why": "KISA 정보기술부문 투자액은 IT 인력 인건비 포함. 카카오 FY2025 급여총액 4,395억(3,922명, OpenDART) — 개발 인력 비중이 크면 비인건비(공략 가능) 몫이 과대",
                        "TS_base": f(a["m"]["2026"]["TS"]["value"]), "TS_alt": f(a["m"]["2026"]["TS"]["value"]),
                        "RAW_base": raw, "RAW_alt": raw * k, "FPR_base": fpr, "FPR_alt": fpr * k, "delta_pct": k - 1})
    for aid, why in (("KA44", "TS가 '외부 구매 상한'(매출원가 − 인건비·임차·상각)으로 정의된 상한값을 기준값으로 사용"),
                     ("KA32", "RAW = BOA 계약 '상한' 연환산. LG U+ BOA 누적 집행 $59,351(상한 대비 극히 낮음)")):
        a = A[aid]
        out.append({"risk_id": "S4_UPPER_BOUND_ANCHOR", "account_id": aid, "name": a["original_name"], "assumption": "상한값을 기준값으로 사용",
                    "why": why, "TS_base": f(a["m"]["2026"]["TS"]["value"]), "RAW_base": f(a["m"]["2026"]["RAW"]["value"]),
                    "FPR_base": f(a["m"]["2026"]["FPR"]["value"]), "delta_pct": None})
    return out


if __name__ == "__main__":
    s = run()
    print(json.dumps({k: s[k] for k in ("evidence_basis", "metric_records_with_status_VERIFIED", "research_status", "grades_2026_TS", "ratio_flags")}, ensure_ascii=False, indent=1))
    print(json.dumps(s["traceability"]["unregistered_assumptions"]), len(s["traceability"]["missing_evidence"]), s["traceability"]["ok"], "/", s["traceability"]["records"])
    print(json.dumps(s["forecast"], indent=1))
