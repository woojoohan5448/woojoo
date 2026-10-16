"""End-to-end model build.

python3 -m models.build            # writes SQLite, frontend JSON, CSV/XLSX exports
"""
from __future__ import annotations

import copy
import hashlib
import json
import sqlite3
import statistics
from datetime import datetime, timezone
from decimal import Decimal

from models.addressability.raw import addressability_rates, category_mix, raw as raw_calc, split
from models.capture.fpr import capture_ceilings, fpr as fpr_calc
from models.common import (CATEGORIES, CONFIG, D, D0, EXPORTS, INTERNAL, PROCESSED, RAW_RESEARCH, ROOT, SANDBOX,
                           SCENARIOS, cagr, load_csv, load_json, q2, safe_div, to_eok)
from models.forecasting.bridge import bridge
from models.spending.ts import select_anchor, ts_2026
from models.validation.checks import validate_account

FRONT_DATA = (PROCESSED.parent / "frontend_data") if SANDBOX else ROOT / "frontend" / "public" / "data"
DATA_VERSION = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


# --------------------------------------------------------------------------- loading
def load_inputs():
    params = load_json(CONFIG / "model_parameters.json")
    seed = load_csv(CONFIG / "accounts_seed.csv")
    overrides = load_json(CONFIG / "account_overrides.json", {}) or {}
    corrections = (load_json(CONFIG / "research_corrections.json", {}) or {}).get("corrections", [])
    overlap = load_json(CONFIG / "overlap_groups.json", {"groups": []})
    strategy = load_json(CONFIG / "strategy_capabilities.json", {"areas": {}})
    pev = load_json(CONFIG / "parameter_evidence.json", {})
    market = load_json(RAW_RESEARCH / "_MARKET_BENCHMARKS.json", {"items": [], "evidence": []})
    dcb = load_json(RAW_RESEARCH.parent / "research_p1" / "_DC_PRICE_BENCHMARKS.json", None)
    if dcb:  # Phase 1 DC price benchmarks (DCBxx) join the market evidence pool
        market["items"] = market["items"] + [dict(i, topic=i.get("topic") or i.get("metric")) for i in dcb.get("items", [])]
        market["evidence"] = market["evidence"] + dcb.get("evidence", [])
    mgmt = {r["account_id"]: r for r in load_csv(INTERNAL / "management_inputs.csv")}
    # Phase 3: approved internal Excel layers (data/internal_store) take precedence over the legacy CSV
    try:
        from models.internal.excel_io import management_rows_for_build
        for aid, r in management_rows_for_build().items():
            mgmt[aid] = {**mgmt.get(aid, {}), **{k: v for k, v in r.items() if v not in (None, "")}, "_from_internal_store": True}
    except Exception as e:  # store absent/corrupt → never silently mix; surface in meta
        mgmt.setdefault("_internal_store_error", {"error": str(e)})
    return params, seed, overrides, corrections, overlap, strategy, pev, market, mgmt


def load_research(aid: str, corrections: list[dict], issues: list[dict]) -> dict | None:
    p = RAW_RESEARCH / f"{aid}.json"
    if not p.exists():
        return None
    r = json.loads(p.read_text(encoding="utf-8"))
    r["_source_hash"] = hashlib.sha256(p.read_bytes()).hexdigest()[:16]
    for phase, sub in (("P1", "research_p1"), ("P2", "research_p2")):
        sp = RAW_RESEARCH.parent / sub / f"{aid}.json"
        if not sp.exists():  # supplements keep the raw file immutable
            continue
        sup = json.loads(sp.read_text(encoding="utf-8"))
        for k in ("facts", "evidence", "drivers", "competitive", "research_log", "open_questions"):
            r.setdefault(k, [])
            r[k] = r[k] + [dict(x, _phase=phase) if isinstance(x, dict) else x for x in sup.get(k, [])]
        for k in ("conflicts", "comparables", "estimation_inputs", "recovery_levels_tried"):
            r[k] = (r.get(k, []) if phase != "P1" else []) + sup.get(k, [])
        if sup.get("entity"):
            for ek, ev in sup["entity"].items():
                if ev not in (None, "", []) and not r["entity"].get(ek):
                    r["entity"][ek] = ev
        r[f"_supplement_hash{'' if phase == 'P1' else '_' + phase.lower()}"] = hashlib.sha256(sp.read_bytes()).hexdigest()[:16]
    for c in corrections:
        if c["account_id"] != aid:
            continue
        for f in r.get("facts", []):
            if all(f.get(k) == v for k, v in c["match"].items()):
                before = {k: f.get(k) for k in c["set"]}
                f.update(c["set"])
                f.setdefault("corrections", []).append(c["correction_id"])
                issues.append({"account_id": aid, "severity": "INFO", "code": "CORRECTION_APPLIED",
                               "message": f"{c['correction_id']}: {before} → {c['set']} ({c['reason']})",
                               "metric": None, "year": None, "scenario": None})
    return r


# --------------------------------------------------------------------------- helpers
def fx(params):
    return D(params.get("fx_usd_krw", 1400))


def latest_fact(research, metric):
    fs = [f for f in (research or {}).get("facts", []) if f.get("metric") == metric and f.get("value") not in (None, "")]
    return sorted(fs, key=lambda f: int(f.get("fiscal_year") or 0), reverse=True)


def security_ratio(research, anchor, fxr) -> Decimal | None:
    """정보보호/IT 비율: same-FY security investment ÷ IT investment (preferred) or reported ratio."""
    if not research:
        return None
    fy = anchor.get("fiscal_year")
    secs = {f.get("fiscal_year"): f for f in latest_fact(research, "kisa_security_investment")}
    its = {f.get("fiscal_year"): f for f in latest_fact(research, "kisa_it_investment")}
    for y in ([fy] if fy else []) + sorted(set(secs) & set(its), reverse=True):
        if y in secs and y in its:
            s, i = to_eok(secs[y]["value"], secs[y]["unit"], fxr), to_eok(its[y]["value"], its[y]["unit"], fxr)
            if s and i and i > 0:
                return s / i
    for f in latest_fact(research, "kisa_security_ratio"):
        v = D(f["value"])
        return v / 100 if f.get("unit") == "%" else v
    return None


def kisa_consistency(research, fxr) -> tuple[int, list[str]]:
    fs = latest_fact(research, "kisa_it_investment")
    vals = []
    for f in fs:
        v = to_eok(f["value"], f["unit"], fxr)
        if v:
            vals.append((int(f["fiscal_year"]), v))
    vals.sort()
    notes = []
    if len(vals) < 2:
        return (5 if vals else 0), notes
    swings = [abs(b[1] / a[1] - 1) for a, b in zip(vals, vals[1:])]
    if max(swings) > Decimal("0.30"):
        notes.append(f"KISA IT 투자액 연간 변동폭 최대 {max(swings) * 100:.0f}% — 정의·범위 변화 여부 확인 필요")
        return 4, notes
    return 10, notes


def calibrate_intensity(seed, researches, params, fxr):
    """Empirical IT intensity (KISA IT investment ÷ revenue or SG&A, same FY, separate scope) by segment family,
    plus empirical security/IT ratio medians. Uses only reported (not derived) KISA IT figures."""
    fam = params["segment_family"]
    basis = params.get("intensity_basis", {})
    obs, sec_obs = {}, {}
    for row in seed:
        r = researches.get(row["account_id"])
        if not r:
            continue
        family = fam[row["segment"]]
        for f in latest_fact(r, "kisa_security_ratio"):
            v = D(f["value"]) / 100 if f.get("unit") == "%" else D(f["value"])
            sec_obs.setdefault(family, []).append(float(v))
            break
        its = [f for f in latest_fact(r, "kisa_it_investment") if f.get("verification_status") != "DERIVED"]
        metrics = ["sga"] if basis.get(family) == "sga" else ["revenue", "operating_revenue"]
        for it in its:
            dens = [f for m in metrics for f in latest_fact(r, m)
                    if f.get("fiscal_year") == it.get("fiscal_year") and "별도" in (f.get("scope") or "")]
            if not dens:
                continue
            iv, rv = to_eok(it["value"], it["unit"], fxr), to_eok(dens[0]["value"], dens[0]["unit"], fxr)
            if iv and rv and rv > 0:
                obs.setdefault(family, []).append({"account_id": row["account_id"], "ratio": float(iv / rv),
                                                   "fy": it.get("fiscal_year"), "basis": metrics[0]})
                break
    table = {}
    newp = copy.deepcopy(params)
    for family, prior in params["it_intensity_fallback"].items():
        if family.startswith("_"):
            continue
        o = obs.get(family, [])
        if len(o) >= 2:
            ratios = sorted(x["ratio"] for x in o)
            med = statistics.median(ratios)
            newp["it_intensity_fallback"][family] = [min(ratios), med, max(ratios)]
            table[family] = {"basis": "EMPIRICAL", "n": len(o), "low": min(ratios), "base": med, "high": max(ratios),
                             "prior": prior, "observations": o, "denominator": basis.get(family, "revenue")}
        else:
            table[family] = {"basis": "PRIOR", "n": len(o), "low": prior[0], "base": prior[1], "high": prior[2],
                             "prior": prior, "observations": o, "denominator": basis.get(family, "revenue")}
    # L5: IT spend per employee (KISA IT ÷ employees, same FY ±1) by family, n≥3
    emp_obs = {}
    for row in seed:
        r = researches.get(row["account_id"])
        if not r:
            continue
        its = [f for f in latest_fact(r, "kisa_it_investment") if f.get("verification_status") != "DERIVED"]
        emps = latest_fact(r, "employees")
        for it in its:
            e = next((x for x in emps if abs(int(x.get("fiscal_year") or 0) - int(it.get("fiscal_year") or 0)) <= 1), None)
            if e:
                iv = to_eok(it["value"], it["unit"], fxr)
                n = D(str(e["value"]).replace(",", ""))
                if iv and n > 0:
                    emp_obs.setdefault(fam[row["segment"]], []).append({"account_id": row["account_id"], "per_emp": float(iv / n)})
                break
    newp["_it_per_employee"] = {}
    for family, o in emp_obs.items():
        if len(o) >= 3:
            v = sorted(x["per_emp"] for x in o)
            newp["_it_per_employee"][family] = {"low": v[0], "base": statistics.median(v), "high": v[-1], "n": len(v),
                                                "peers": [x["account_id"] for x in o]}
    table["_it_per_employee"] = {k: {"n": len(v), "obs": v} for k, v in emp_obs.items()}
    newp["_security_ratio_fallback"] = {}
    for family, vals in sec_obs.items():
        if len(vals) >= 3:
            med = statistics.median(vals)
            newp["_security_ratio_fallback"][family] = {
                "value": med, "basis": f"산업군({family}) 공시 정보보호/IT 비율 실측 중앙값 {med * 100:.1f}% (n={len(vals)})", "evidence_ids": []}
    table["_security_ratio"] = {k: {"n": len(v), "median": statistics.median(v)} for k, v in sec_obs.items()}
    return newp, table


def conf_anchor(anchor, entity_status, consistency) -> tuple[int, dict]:
    m, st, tier, fy = anchor["method"], anchor.get("fact_status"), anchor.get("tier"), anchor.get("fiscal_year")
    if m == "UNKNOWN":
        return 0, {}
    inp = anchor.get("input_fact_status")
    offic = 30 if ((st == "VERIFIED" or inp == "VERIFIED") and tier == 1) else 18 if tier in (1, 2) else 8
    ent = {"CONFIRMED": 15, "PROBABLE": 10}.get(entity_status, 4)
    direct = {"DIRECT_IT_BUDGET": 20, "KISA_IT_INVESTMENT": 20, "KISA_DERIVED": 15, "KISA_SEC_SCALED": 10,
              "AUDIT_IT_COMPONENTS": 12, "EMPLOYEE_COMPARABLE": 6, "CAPACITY_MODEL": 8,
              "ACCOUNT_SPECIFIC": 8, "REVENUE_INTENSITY": 5}[m]
    rec = 15 if (fy or 0) >= 2025 else 10 if (fy or 0) == 2024 else 5
    cons = consistency if m.startswith("KISA") else 5
    parts = {"officiality": offic, "entity_match": ent, "directness": direct, "recency": rec, "consistency": cons}
    score = sum(parts.values())
    if m == "EMPLOYEE_COMPARABLE":
        score = min(score, 40)
    if m == "AUDIT_IT_COMPONENTS":
        score = min(score, 62)
    if m == "REVENUE_INTENSITY":
        score = min(score, 35)
    if st == "SECONDARY_UNCONFIRMED":
        score = min(score, 70)
    return score, parts


def rec(value, status, conf, formula, *, low=None, high=None, inputs=None, evidence_ids=None,
        assumption_ids=None, notes=None, unit="억원"):
    if value is None:
        status = "UNKNOWN" if status not in ("NULL_INPUT",) else status
    return {"value": value, "low": low, "high": high, "status": status, "confidence": conf if value is not None else 0,
            "formula": formula, "inputs": inputs or [], "evidence_ids": sorted(set(evidence_ids or [])),
            "assumption_ids": assumption_ids or [], "notes": notes or [], "unit": unit}


def scale(v, ratio):
    return None if v is None or ratio is None else v * ratio


# --------------------------------------------------------------------------- per-account model
def model_account(row, research, override, params, pev, mgmt_row, fxr, issues):
    aid, family = row["account_id"], params["segment_family"][row["segment"]]
    ent = (research or {}).get("entity", {})
    anchor = select_anchor(research or {}, override, family, params, fxr, aid)

    # Cross-check a direct budget against the KISA anchor (pilot lesson COR-001)
    if anchor["method"] == "DIRECT_IT_BUDGET":
        kisa = latest_fact(research, "kisa_it_investment")
        if kisa:
            kv = to_eok(kisa[0]["value"], kisa[0]["unit"], fxr)
            if kv and anchor["value"] < kv * Decimal("0.5"):
                issues.append({"account_id": aid, "severity": "WARN", "code": "BUDGET_VS_KISA",
                               "message": f"FY2026 IT 예산 {anchor['value']:.0f}억 < KISA IT 투자액의 50% ({kv:.0f}억) → 예산 앵커 기각, KISA 사용",
                               "metric": "TS", "year": 2026, "scenario": None})
                r2 = copy.deepcopy(research)
                r2["facts"] = [f for f in r2["facts"] if f.get("metric") != "it_budget"]
                anchor = select_anchor(r2, override, family, params, fxr, aid)

    cons, cons_notes = kisa_consistency(research or {}, fxr)
    for n in cons_notes:
        issues.append({"account_id": aid, "severity": "WARN", "code": "KISA_SWING", "message": n,
                       "metric": "TS", "year": None, "scenario": None})
    base_conf, conf_parts = conf_anchor(anchor, ent.get("entity_status"), cons)
    if anchor.get("fact_status") == "SECONDARY_UNCONFIRMED":
        issues.append({"account_id": aid, "severity": "INFO", "code": "SOURCE_NOT_OPENED",
                       "message": "TS 앵커 수치는 검색 결과 인용(원문 페이지 미확인, WebFetch 차단). 원문 확인 시 VERIFIED 승격 가능.",
                       "metric": "TS", "year": None, "scenario": None})

    t26 = ts_2026(anchor, family, params) if anchor["method"] != "UNKNOWN" else {"value": None, "low": None, "high": None, "status": "UNKNOWN"}
    if anchor.get("already_fy2026"):
        t26["formula"] = anchor["formula"]
    sec_ratio = security_ratio(research, anchor, fxr)
    mix, mix_notes = category_mix(family, params, override, sec_ratio)
    ts_by = split(t26["value"], mix)
    a26 = addressability_rates("2026", params, override)
    raw26, raw26_by = raw_calc(ts_by, a26)
    c26 = capture_ceilings("2026", params, override)
    fpr26, fpr26_by = fpr_calc(raw26_by, c26)

    special = (override or {}).get("raw_direct")
    if t26["value"] is None and special:
        raw26 = D(special["value_eok"])
        raw26_by = {c: (raw26 if c == special.get("category", "CONNECTIVITY") else D0) for c in CATEGORIES}
        fpr26_by = {c: v * D(special.get("fpr_share", c26[c])) for c, v in raw26_by.items()}
        fpr26 = sum(fpr26_by.values(), D0)

    r_ratio = safe_div(raw26, t26["value"])
    f_ratio = safe_div(fpr26, t26["value"])
    ev_anchor = anchor.get("evidence_ids", [])
    ts_conf = max(5, base_conf - 5) if t26["value"] is not None else 0
    ts_inputs = anchor.get("inputs", [])
    m26 = {}
    m26["TS"] = rec(t26["value"], t26.get("status", "UNKNOWN"), ts_conf, t26.get("formula") or anchor["formula"],
                    low=t26.get("low"), high=t26.get("high"), inputs=ts_inputs, evidence_ids=ev_anchor,
                    assumption_ids=["B-G26", "B-RANGE"] + (["B-INT"] if anchor["method"] == "REVENUE_INTENSITY" else []),
                    notes=[f"앵커 방법: {anchor['method']}", f"앵커 회계연도: FY{anchor.get('fiscal_year')}"]
                    + ([anchor["definition_note"]] if anchor.get("definition_note") else []))
    raw_formula = "RAW_2026 = Σ(TS_i × Addressability_i)  [C-ADDR 2026, A-MIX]" if not (special and t26["value"] is None) else special["formula"]
    scen26 = t26.get("status") == "SCENARIO"
    m26["RAW"] = rec(raw26, ("SCENARIO" if scen26 else "ESTIMATED") if not (special and t26["value"] is None) else special.get("status", "SCENARIO"),
                     max(5, base_conf - 15) if raw26 is not None else 0, raw_formula,
                     low=scale(t26.get("low"), r_ratio), high=scale(t26.get("high"), r_ratio),
                     inputs=[{"name": "TS_2026", "value": str(t26["value"]) if t26["value"] is not None else None, "unit": "억원"}],
                     evidence_ids=ev_anchor + ((special or {}).get("evidence_ids", []) if t26["value"] is None else []),
                     assumption_ids=["A-MIX", "C-ADDR"], notes=mix_notes)
    m26["FPR"] = rec(fpr26, ("SCENARIO" if scen26 else "ESTIMATED") if not (special and t26["value"] is None) else "SCENARIO",
                     max(5, base_conf - 25) if fpr26 is not None else 0,
                     "FPR_2026 = Σ(RAW_i × Capture_Ceiling_i)  [C-CAP 2026]",
                     low=scale(t26.get("low"), f_ratio), high=scale(t26.get("high"), f_ratio),
                     inputs=[{"name": "RAW_2026", "value": str(raw26) if raw26 is not None else None, "unit": "억원"}],
                     evidence_ids=ev_anchor + ((special or {}).get("evidence_ids", []) if t26["value"] is None else []),
                     assumption_ids=["C-CAP"])

    # Current revenue (internal only)
    cr = None
    if mgmt_row and mgmt_row.get("cr_2026_forecast_eok", "").strip() != "":
        cr = D(mgmt_row["cr_2026_forecast_eok"])
    m26["CR"] = rec(cr, "VERIFIED" if cr is not None else "UNKNOWN", 90 if cr is not None else 0,
                    "CR_2026 = 사내 매출 데이터(관리자 입력, 연말 예상치)" if cr is not None else "미입력(NULL) — 0원 아님",
                    inputs=[{"name": "YTD 실적", "value": (mgmt_row or {}).get("cr_2026_ytd_eok") or None, "unit": "억원"},
                            {"name": "입력 근거", "value": (mgmt_row or {}).get("cr_basis") or None}],
                    notes=["관리자 입력 필요"] if cr is None else [])
    csow, pcr = safe_div(cr, raw26), safe_div(cr, fpr26)
    m26["CSOW"] = rec(csow, "DERIVED" if csow is not None else "UNKNOWN", min(m26["CR"]["confidence"], m26["RAW"]["confidence"]),
                      "C-SOW = CR_2026 / RAW_2026", unit="%",
                      inputs=[{"name": "CR", "value": str(cr) if cr is not None else None}, {"name": "RAW_2026", "value": str(raw26) if raw26 is not None else None}])
    m26["PCR"] = rec(pcr, "DERIVED" if pcr is not None else "UNKNOWN", min(m26["CR"]["confidence"], m26["FPR"]["confidence"]),
                     "Potential Capture Rate = CR_2026 / FPR_2026", unit="%",
                     inputs=[{"name": "CR", "value": str(cr) if cr is not None else None}, {"name": "FPR_2026", "value": str(fpr26) if fpr26 is not None else None}])
    ups = (fpr26 - cr) if (cr is not None and fpr26 is not None) else None
    m26["UPSIDE"] = rec(ups, "DERIVED" if ups is not None else "UNKNOWN", m26["PCR"]["confidence"],
                        "Upside_2026 = FPR_2026 − CR_2026 (CR 미확인 시 N/A)",
                        inputs=[{"name": "FPR_2026", "value": str(fpr26) if fpr26 is not None else None}, {"name": "CR", "value": str(cr) if cr is not None else None}])

    # 2031
    infra = {s: D0 for s in SCENARIOS}
    infra_inputs = []
    for drv in (override or {}).get("infra_drivers", []):
        for s in SCENARIOS:
            infra[s] += D(drv["annual_eok_2031"][s])
        infra_inputs.append(drv)
    m31 = {}
    target_ref = None
    ev31 = ev_anchor + ((special or {}).get("evidence_ids", []) if (special and t26["value"] is None) else [])  # QA-05
    for s in SCENARIOS:
        blk = {}
        if ts_by is not None:
            br = bridge(ts_by, family, s, params, infra[s], bridge_override=(override or {}).get("bridge_override"))
            ts31, ts31_by = br["total"], br["by_cat"]
        elif special:
            g = D(params["forecast_bridge"][family]["organic_cagr"][["low", "base", "high"].index(s)])
            br = {"components": {"organic": raw26 * ((1 + g) ** 5 - 1)}, "params": {"organic_cagr": str(g)}, "clamped": []}
            ts31, ts31_by = None, None
        else:
            br, ts31, ts31_by = None, None, None
        c31 = capture_ceilings("2031", params, override)
        for case in ("base", "expansion"):
            a31 = addressability_rates("2031_base" if case == "base" else "2031_expansion", params, override)
            if ts31_by is not None:
                r31, r31_by = raw_calc(ts31_by, a31)
                f31, f31_by = fpr_calc(r31_by, c31)
            elif special:
                r31 = raw26 + br["components"]["organic"]
                r31_by = {c: (r31 if c == special.get("category", "CONNECTIVITY") else D0) for c in CATEGORIES}
                f31_by = {c: v * D(special.get("fpr_share", c31[c])) for c, v in r31_by.items()}
                f31 = sum(f31_by.values(), D0)
            else:
                r31 = r31_by = f31 = f31_by = None
            conf31 = max(5, base_conf - 30) if r31 is not None else 0
            blk[f"RAW_{case}"] = rec(r31, "SCENARIO" if case == "expansion" or s != "base" else "ESTIMATED", conf31,
                                     f"RAW_2031 = Σ(TS_2031_i × Addressability_i) [C-ADDR 2031_{case}]",
                                     evidence_ids=ev31, assumption_ids=["C-ADDR", "B-BRIDGE", "B-ALLOC"])
            blk[f"RAW_{case}"]["by_cat"] = r31_by
            blk[f"FPR_{case}"] = rec(f31, "SCENARIO" if case == "expansion" or s != "base" else "ESTIMATED",
                                     max(5, base_conf - 40) if f31 is not None else 0,
                                     "FPR_2031 = Σ(RAW_2031_i × Capture_Ceiling_i) [C-CAP 2031]",
                                     evidence_ids=ev31, assumption_ids=["C-CAP", "C-ADDR", "B-BRIDGE"])
            blk[f"FPR_{case}"]["by_cat"] = f31_by
        blk["TS"] = rec(ts31, "ESTIMATED" if s == "base" else "SCENARIO", max(5, base_conf - 20) if ts31 is not None else 0,
                        "TS_2031 = TS_2026 + Organic + Cloud + AI + Infra + Regulatory − Efficiency − Substitution [B-BRIDGE]",
                        evidence_ids=ev_anchor + [e for d in infra_inputs for e in d.get("evidence_ids", [])],
                        assumption_ids=["B-BRIDGE", "B-ALLOC"], inputs=[{"name": "TS_2026", "value": str(t26["value"]) if t26["value"] is not None else None}])
        blk["TS"]["by_cat"] = ts31_by
        # QA-07: separate customer-spend growth from the assumed U+ capability uplift (2031 addressability/capture):
        # FPR_2031 recomputed with the 2026 addressability and capture ceilings
        if ts31_by is not None:
            _, r_cc_by = raw_calc(ts31_by, a26)
            f_cc, _ = fpr_calc(r_cc_by, c26)
        else:
            f_cc = None
        blk["FPR_const_capability"] = rec(f_cc, "SCENARIO", max(5, base_conf - 40) if f_cc is not None else 0,
                                          "FPR_2031(현 역량 고정) = Σ(TS_2031_i × Addressability_2026_i × Capture_2026_i) — U+ 역량 확대 가정 제외",
                                          evidence_ids=ev31, assumption_ids=["C-ADDR", "C-CAP", "B-BRIDGE"],
                                          notes=["FPR_2031(base) − 이 값 = 2031 접근률·포획상한 상향(U+ 경쟁력 확대 가정) 효과"])
        blk["bridge"] = br
        blk["TS_CAGR"] = rec(cagr(t26["value"], ts31), "DERIVED", blk["TS"]["confidence"], "(TS_2031/TS_2026)^(1/5) − 1", unit="%")
        blk["RAW_CAGR"] = rec(cagr(raw26, blk["RAW_base"]["value"]), "DERIVED", blk["RAW_base"]["confidence"], "(RAW_2031/RAW_2026)^(1/5) − 1", unit="%")
        blk["FPR_CAGR"] = rec(cagr(fpr26, blk["FPR_base"]["value"]), "DERIVED", blk["FPR_base"]["confidence"], "(FPR_2031/FPR_2026)^(1/5) − 1", unit="%")
        m31[s] = blk
        if s == "base":
            target_ref = blk

    # QA-06: 2031 low/high scenarios start from the 2026 BASE TS, so they omit 2026 anchor uncertainty.
    # Attach a combined band to the base records: scenario(low/high) × (TS_2026 low/high ÷ TS_2026 base).
    if t26["value"] and t26.get("low") is not None and t26.get("high") is not None:
        lo_r, hi_r = t26["low"] / t26["value"], t26["high"] / t26["value"]
        for k in ("TS", "RAW_base", "FPR_base"):
            lo_s, hi_s = m31["low"][k]["value"], m31["high"][k]["value"]
            if m31["base"][k]["value"] is not None and lo_s is not None and hi_s is not None:
                m31["base"][k]["low"], m31["base"][k]["high"] = lo_s * lo_r, hi_s * hi_r
                m31["base"][k]["notes"] = m31["base"][k]["notes"] + [
                    f"범위 = 2031 시나리오(low/high) × 2026 TS 불확실성({float(lo_r):.2f}~{float(hi_r):.2f}) 결합 — 2026 추정 오차가 2031로 전파됨"]

    # Target (Layer D)
    tgt_in = (mgmt_row or {}).get("target_revenue_2031_eok", "").strip() if mgmt_row else ""
    if tgt_in:
        tgt = D(tgt_in)
        tstatus, tconf, tformula = "SCENARIO", 60, "Target_2031 = 경영진 입력 목표 (Layer D, 전략 목표)"
    elif target_ref and target_ref["FPR_base"]["value"] is not None:
        att = D(params["target_rule"]["attainment_of_fpr_2031"])
        tgt = target_ref["FPR_base"]["value"] * att
        tstatus, tconf, tformula = "SCENARIO", min(25, target_ref["FPR_base"]["confidence"]), f"Target_2031(시나리오) = FPR_2031(base) × {att} [D-TGT] — 경영진 의사결정 필요"
    else:
        tgt, tstatus, tconf, tformula = None, "UNKNOWN", 0, "FPR_2031 미산출 → Target 산출 불가"
    raw31b = target_ref["RAW_base"]["value"] if target_ref else None
    tsow = safe_div(tgt, raw31b)
    tsource = "MANAGEMENT_APPROVED" if tgt_in else ("SCENARIO_FPR_ATTAINMENT" if tgt is not None else None)
    tg = {"TARGET": rec(tgt, tstatus, tconf, tformula, assumption_ids=["D-TGT"] if not tgt_in else [],
                        inputs=[{"name": "FPR_2031(base)", "value": str(target_ref["FPR_base"]["value"]) if target_ref and target_ref["FPR_base"]["value"] is not None else None}],
                        notes=["경영진 입력 목표" if tgt_in else "경영진 의사결정 필요(시나리오 목표)"]),
          "TARGET_SOW": rec(tsow, ("SCENARIO" if tstatus == "SCENARIO" else "DERIVED") if tsow is not None else "UNKNOWN", tconf,
                            "Target_SOW = Target_2031 / RAW_2031(base)", unit="%",
                            inputs=[{"name": "Target_2031", "value": str(tgt) if tgt is not None else None}, {"name": "RAW_2031(base)", "value": str(raw31b) if raw31b is not None else None}]),
          "UPSIDE_2031": rec((target_ref["FPR_base"]["value"] - cr) if (cr is not None and target_ref and target_ref["FPR_base"]["value"] is not None) else None,
                             "DERIVED", tconf, "Estimated_Upside_2031 = FPR_2031(base) − CR_2026 (CR 미확인 시 N/A)"),
          "TARGET_INCREMENT": rec((tgt - cr) if (cr is not None and tgt is not None) else None, "DERIVED", tconf,
                                  "Target 증분 = Target_2031 − CR_2026 (CR 미확인 시 N/A)")}

    # vNext D1: a target's origin is explicit. Only MANAGEMENT_APPROVED targets are official (KPI/aggregate);
    # the FPR×attainment scenario stays computed but is shown only on explicit user request.
    for k in ("TARGET", "TARGET_SOW", "TARGET_INCREMENT"):
        tg[k]["target_source"] = tsource
    m26["TS"]["by_cat"], m26["RAW"]["by_cat"], m26["FPR"]["by_cat"] = ts_by, raw26_by, fpr26_by
    return {"anchor": anchor, "conf_parts": conf_parts, "mix": mix, "rates_2026": a26, "caps_2026": c26,
            "sec_ratio": sec_ratio, "m": {"2026": m26, "2031": m31, "target": tg}, "family": family,
            "infra_drivers": infra_inputs}


# --------------------------------------------------------------------------- Phase 4 reconciliation
def reconcile(acc, model, mrow):
    """External estimate vs sales-rep estimate (SALES_ESTIMATE layer) + internal CR/target. Never overwrites."""
    if not mrow or not (mrow.get("sales_estimates") or mrow.get("cr_2026_forecast_eok") or mrow.get("target_revenue_2031_eok")):
        return None
    rows = []
    ext = {("2026", "TS"): model["m"]["2026"]["TS"]["value"], ("2026", "RAW"): model["m"]["2026"]["RAW"]["value"],
           ("2026", "FPR"): model["m"]["2026"]["FPR"]["value"], ("2031", "TS"): model["m"]["2031"]["base"]["TS"]["value"],
           ("2031", "RAW"): model["m"]["2031"]["base"]["RAW_base"]["value"], ("2031", "FPR"): model["m"]["2031"]["base"]["FPR_base"]["value"]}
    for (y, m), ev in ext.items():
        se = (mrow.get("sales_estimates") or {}).get(f"{y}|{m}")
        sv = D(se["value_eok"]) if se else None
        diff = (sv - ev) / ev if (sv is not None and ev not in (None, 0)) else None
        flag = "NO_SALES_INPUT" if sv is None else "NO_EXTERNAL" if ev is None else \
            "ALIGNED" if abs(diff) <= Decimal("0.2") else "REVIEW_SALES_HIGHER" if diff > 0 else "REVIEW_SALES_LOWER"
        rows.append({"year": int(y), "metric": m, "external": ev, "sales": sv, "diff_pct": diff, "flag": flag,
                     "sales_rep": (se or {}).get("sales_rep"), "rationale": (se or {}).get("rationale")})
    cr = model["m"]["2026"]["CR"]["value"]
    fpr = model["m"]["2026"]["FPR"]["value"]
    tgt = D(mrow["target_revenue_2031_eok"]) if mrow.get("target_revenue_2031_eok") else None
    notes = []
    if cr is not None and fpr is not None and cr > fpr:
        notes.append("CR > 외부 FPR: 접근률·포획 상한 가정 과소 가능 — 영업 추정 RAW/FPR과 대조 필요")
    if any(r["flag"].startswith("REVIEW") for r in rows):
        notes.append("영업 추정과 외부 추정 차이 ±20% 초과 항목 존재 — 정의(비용 vs 예산, 법인 범위) 확인 후 승인된 Account Plan 값 결정")
    return {"rows": rows, "internal_cr": cr, "management_target": tgt,
            "opportunity_gap": (fpr - cr) if (cr is not None and fpr is not None) else None, "notes": notes}


# --------------------------------------------------------------------------- grading (Phase 1 taxonomy)
GRADES = ["ESTIMATED_LOW", "ESTIMATED_MEDIUM", "ESTIMATED_HIGH"]


def _down(g, n=1):
    if g not in GRADES:
        return g
    return GRADES[max(0, GRADES.index(g) - n)]


def ts_grade(acc, ov) -> str:
    a = acc["anchor"]
    m = a["method"]
    conf = acc["m"]["2026"]["TS"]["confidence"]
    if m in ("KISA_IT_INVESTMENT", "DIRECT_IT_BUDGET", "KISA_DERIVED"):
        # HIGH only for a directly reported (not back-solved) figure for FY2024+; stale or derived → MEDIUM
        direct = a.get("fact_status") not in ("DERIVED",) and m != "KISA_DERIVED"
        return "ESTIMATED_HIGH" if (conf >= 55 and direct and (a.get("fiscal_year") or 0) >= 2024) else "ESTIMATED_MEDIUM"
    if m == "KISA_SEC_SCALED":
        return "ESTIMATED_MEDIUM" if "자사" in a.get("formula", "") else "ESTIMATED_LOW"
    if m == "AUDIT_IT_COMPONENTS":
        return "ESTIMATED_MEDIUM"
    if m in ("ACCOUNT_SPECIFIC", "CAPACITY_MODEL"):
        return ((ov or {}).get("ts_anchor") or {}).get("grade", "ESTIMATED_LOW")
    return "ESTIMATED_LOW"


def assign_grades(acc, ov):
    """Explicit grade per metric: TS from anchor quality; RAW/FPR one notch lower (Layer C assumptions);
    2031 one further notch (forecast). VERIFIED/DERIVED records keep their status."""
    m26 = acc["m"]["2026"]
    base = ts_grade(acc, ov) if m26["TS"]["value"] is not None else None
    if base:
        m26["TS"]["grade"] = base
        m26["RAW"]["grade"] = _down(base)
        m26["FPR"]["grade"] = _down(base)
    elif m26["RAW"]["value"] is not None:  # contract-vehicle / special RAW without TS
        m26["RAW"]["grade"] = m26["FPR"]["grade"] = "ESTIMATED_LOW"
    for s_, blk in acc["m"]["2031"].items():
        for k in ("TS", "RAW_base", "RAW_expansion", "FPR_base", "FPR_expansion", "FPR_const_capability"):
            if blk[k]["value"] is not None:
                g = m26["TS" if k == "TS" else k.split("_")[0]].get("grade") or "ESTIMATED_LOW"
                blk[k]["grade"] = _down(g) if (s_ == "base" and k in ("TS", "RAW_base", "FPR_base")) else "ESTIMATED_LOW"


# --------------------------------------------------------------------------- status & narrative
def research_status(research, model, issues_acc, override):
    if research is None:
        return "NOT_STARTED"
    if any(i["severity"] == "ERROR" for i in issues_acc):
        return "NEEDS_REVIEW"
    if (override or {}).get("quality_approved"):
        return "QUALITY_APPROVED"
    if research.get("entity", {}).get("entity_status") == "UNCERTAIN":
        return "NEEDS_REVIEW"
    a = model["anchor"]
    # QA-01: EVIDENCE_VERIFIED = the IT-spending figure itself was read in a primary source;
    # INPUTS_VERIFIED = only the financial line items used to reconstruct it were (TS remains an estimate)
    if a["method"] in ("DIRECT_IT_BUDGET", "KISA_IT_INVESTMENT") and a.get("fact_status") == "VERIFIED" and a.get("tier") == 1:
        return "EVIDENCE_VERIFIED"
    if a["method"] != "UNKNOWN" and a.get("input_fact_status") == "VERIFIED" and a.get("tier") == 1:
        return "INPUTS_VERIFIED"
    if a["method"] != "UNKNOWN" or model["m"]["2026"]["RAW"]["value"] is not None:
        return "MODEL_ESTIMATED"
    if research.get("facts"):
        return "SOURCES_COLLECTED"
    return "ENTITY_RESOLVED"


def fmt(v):
    return "N/A" if v is None else f"{v:,.0f}억"


def narrative(row, research, model, params):
    m26, m31 = model["m"]["2026"], model["m"]["2031"]["base"]
    a = model["anchor"]
    cats = params["categories"]
    out = {}
    out["ts_2026"] = (f"TS_2026 {fmt(m26['TS']['value'])} (범위 {fmt(m26['TS']['low'])}~{fmt(m26['TS']['high'])}), 상태 {m26['TS']['status']}"
                      if m26["TS"]["value"] is not None else "TS_2026 산출 불가(UNKNOWN): 직접 IT 지출 근거와 신뢰 가능한 추정 기준 부족")
    out["ts_basis"] = f"{a['method']}: {a['formula']}"
    if m26["RAW"]["value"] is not None:
        top = sorted((m26["RAW"]["by_cat"] or {}).items(), key=lambda x: x[1], reverse=True)[:3]
        out["raw_logic"] = ("RAW = TS × 카테고리별 접근 가능률. 상위 접근 영역: "
                            + ", ".join(f"{cats[c]['label']} {fmt(v)}" for c, v in top if v > 0)
                            + ". 내부 IT 인건비(접근률 0)와 SW 라이선스·HW(낮은 접근률)는 제외 비중이 큼.")
        topf = sorted((m26["FPR"]["by_cat"] or {}).items(), key=lambda x: x[1], reverse=True)[:3]
        out["fpr_logic"] = ("FPR = RAW × 현실적 포획 상한(이중망·멀티벤더·경쟁 고려). 상위: "
                            + ", ".join(f"{cats[c]['label']} {fmt(v)}" for c, v in topf if v > 0))
    else:
        out["raw_logic"] = out["fpr_logic"] = "TS 미산출로 RAW·FPR 산출 불가"
    br = m31.get("bridge")
    if br and m31["TS"]["value"] is not None:
        comp = sorted(br["components"].items(), key=lambda x: abs(x[1]), reverse=True)
        names = {"organic": "자연 성장", "cloud": "클라우드 전환", "ai": "AI 투자", "infra": "인프라 증설(계정별)",
                 "regulatory": "규제·보안 강화", "efficiency": "효율화 절감", "substitution": "기술 대체", "other": "기타"}
        out["ts_2031_drivers"] = "TS_2031(base) " + fmt(m31["TS"]["value"]) + " — 주요 동인: " + ", ".join(
            f"{names[k]} {'+' if v >= 0 else ''}{v:,.0f}억" for k, v in comp[:4] if v != 0)
        r_low, r_high = model["m"]["2031"]["low"]["TS"]["value"], model["m"]["2031"]["high"]["TS"]["value"]
        out["uncertainty"] = f"2031 TS 시나리오 범위 {fmt(r_low)} (Low) ~ {fmt(r_high)} (High)"
        topo = sorted((m31["FPR_base"]["by_cat"] or {}).items(), key=lambda x: x[1], reverse=True)[:2]
        out["key_opportunity"] = "2031 FPR 상위 영역: " + ", ".join(f"{cats[c]['label']} {fmt(v)}" for c, v in topo if v > 0)
        r26, r31 = m26["RAW"]["by_cat"] or {}, m31["RAW_base"]["by_cat"] or {}
        if r26 and r31:
            dif = sorted(((c, r31[c] - r26[c]) for c in CATEGORIES), key=lambda x: x[1], reverse=True)[:2]
            out["raw_2031_drivers"] = "RAW 증가 기여 상위: " + ", ".join(f"{cats[c]['label']} +{v:,.0f}억" for c, v in dif if v > 0)
    elif br:
        out["ts_2031_drivers"] = "TS 미산출. 관측 가능한 계약 규모(RAW 하한 시나리오)만 자연 성장률로 전망."
    out["open_questions"] = (research or {}).get("open_questions", [])[:8]
    return out


# --------------------------------------------------------------------------- portfolio & strategy
def aggregate(accounts):
    out = {}
    for yr in ("2026", "2031"):
        for scen in (["base"] if yr == "2026" else list(SCENARIOS)):
            key = f"{yr}_{scen}"
            agg = {"TS": D0, "RAW": D0, "FPR": D0, "TARGET": D0, "n_ts": 0, "n_raw": 0, "n_fpr": 0,
                   "n_mismatch": 0, "excluded": [], "TARGET_scenario": D0, "n_target_approved": 0, "n_target_scenario": 0}
            for a in accounts:
                if yr == "2026":
                    blk = a["m"]["2026"]
                    ts, raw, fpr = blk["TS"]["value"], blk["RAW"]["value"], blk["FPR"]["value"]
                else:
                    blk = a["m"]["2031"][scen]
                    ts, raw, fpr = blk["TS"]["value"], blk["RAW_base"]["value"], blk["FPR_base"]["value"]
                if a["aggregate_class"] == "DEFINITION_MISMATCH":
                    agg["n_mismatch"] += 1
                    agg["excluded"].append(a["account_id"])
                    continue
                if ts is not None:
                    agg["TS"] += ts; agg["n_ts"] += 1
                if raw is not None:
                    agg["RAW"] += raw; agg["n_raw"] += 1
                if fpr is not None:
                    agg["FPR"] += fpr; agg["n_fpr"] += 1
                t_ = a["m"]["target"]["TARGET"]
                if yr == "2031" and t_["value"] is not None and scen == "base":
                    if t_.get("target_source") == "MANAGEMENT_APPROVED":  # vNext D1: official sum = approved targets only
                        agg["TARGET"] += t_["value"]; agg["n_target_approved"] += 1
                    else:
                        agg["TARGET_scenario"] += t_["value"]; agg["n_target_scenario"] += 1
            if agg["n_target_approved"] == 0:
                agg["TARGET"] = None  # no approved target → not 0 (INTERNAL INPUT REQUIRED)
            out[key] = agg
    return out


def by_dimension(accounts, dim_fn, cats=False):
    res = {}
    for a in accounts:
        if a["aggregate_class"] == "DEFINITION_MISMATCH":
            continue
        k = dim_fn(a)
        r = res.setdefault(k, {"TS_2026": D0, "RAW_2026": D0, "FPR_2026": D0, "TS_2031": D0, "RAW_2031": D0,
                               "FPR_2031": D0, "n": 0, "n_est": 0, "conf_sum": 0})
        r["n"] += 1
        m26, m31 = a["m"]["2026"], a["m"]["2031"]["base"]
        if m26["TS"]["value"] is None:
            continue
        r["n_est"] += 1
        r["conf_sum"] += m26["TS"]["confidence"]
        for k2, v in (("TS_2026", m26["TS"]["value"]), ("RAW_2026", m26["RAW"]["value"]), ("FPR_2026", m26["FPR"]["value"]),
                      ("TS_2031", m31["TS"]["value"]), ("RAW_2031", m31["RAW_base"]["value"]), ("FPR_2031", m31["FPR_base"]["value"])):
            if v is not None:
                r[k2] += v
    return res


def strategy_engine(accounts, params, strategy):
    areas = {}
    for c, meta in params["categories"].items():
        area = meta["biz_area"]
        if area == "접근 불가":
            continue
        a = areas.setdefault(area, {"categories": [], "RAW_2026": D0, "FPR_2026": D0, "RAW_2031": D0, "FPR_2031": D0,
                                    "FPR_2031_exp": D0, "FPR_2031_high": D0, "accounts": set(), "conf_w": D0, "top_accounts": {},
                                    "FPR_2031_mismatch": D0, "mismatch_accounts": set()})
        a["categories"].append(c)
    for acc in accounts:
        m26, m31, m31h = acc["m"]["2026"], acc["m"]["2031"]["base"], acc["m"]["2031"]["high"]
        for c, meta in params["categories"].items():
            area = meta["biz_area"]
            if area not in areas or not m26["RAW"].get("by_cat"):
                continue
            ar = areas[area]
            r26, f26 = m26["RAW"]["by_cat"][c], m26["FPR"]["by_cat"][c]
            r31 = (m31["RAW_base"]["by_cat"] or {}).get(c, D0)
            f31 = (m31["FPR_base"]["by_cat"] or {}).get(c, D0)
            if acc["aggregate_class"] == "DEFINITION_MISMATCH":
                # different TS definition (e.g. hyperscaler domestic capex) → reported separately, not summed
                ar["FPR_2031_mismatch"] += f31
                if f31 >= D("1"):
                    ar["mismatch_accounts"].add(acc["account_id"])
                continue
            f31e = (m31["FPR_expansion"]["by_cat"] or {}).get(c, D0)
            f31h = (m31h["FPR_base"]["by_cat"] or {}).get(c, D0)
            ar["RAW_2026"] += r26; ar["FPR_2026"] += f26; ar["RAW_2031"] += r31; ar["FPR_2031"] += f31
            ar["FPR_2031_exp"] += f31e; ar["FPR_2031_high"] += f31h
            if f31 >= D("1"):
                ar["accounts"].add(acc["account_id"])
                ar["top_accounts"][acc["account_id"]] = ar["top_accounts"].get(acc["account_id"], D0) + f31
            ar["conf_w"] += f31 * D(m31["FPR_base"]["confidence"])
    out = []
    for area, a in areas.items():
        q = strategy.get("areas", {}).get(area, {})
        growth = cagr(a["FPR_2026"], a["FPR_2031"])
        conf = float(a["conf_w"] / a["FPR_2031"]) if a["FPR_2031"] > 0 else 0
        top = sorted(a["top_accounts"].items(), key=lambda x: x[1], reverse=True)[:5]
        out.append({"area": area, "categories": a["categories"], "RAW_2026": a["RAW_2026"], "FPR_2026": a["FPR_2026"],
                    "RAW_2031": a["RAW_2031"], "FPR_2031": a["FPR_2031"], "FPR_2031_expansion": a["FPR_2031_exp"],
                    "FPR_2031_high": a["FPR_2031_high"], "FPR_CAGR": growth, "n_accounts": len(a["accounts"]),
                    "FPR_2031_definition_mismatch": a["FPR_2031_mismatch"], "mismatch_accounts": sorted(a["mismatch_accounts"]),
                    "demand_confidence": round(conf), "top_accounts": [{"account_id": k, "FPR_2031": v} for k, v in top],
                    **{k: q.get(k) for k in ("lgu_position", "entry_feasibility", "competition", "required_capabilities",
                                             "capability_gap", "investment_need", "difficulty", "recommendation",
                                             "recommendation_type", "evidence_refs", "caveats")}})
    # Priority score (0-100): size 35, growth 20, breadth 15, feasibility 15, confidence 15, minus difficulty
    if out:
        mx = max(float(o["FPR_2031"]) for o in out) or 1
        mg = max((float(o["FPR_CAGR"] or 0) for o in out), default=0) or 1
        nb = max(o["n_accounts"] for o in out) or 1
        for o in out:
            feas = {"HIGH": 1.0, "MEDIUM": 0.6, "LOW": 0.25}.get(o.get("entry_feasibility") or "MEDIUM", 0.6)
            diff = {"HIGH": 8, "MEDIUM": 4, "LOW": 0}.get(o.get("difficulty") or "MEDIUM", 4)
            s = (35 * float(o["FPR_2031"]) / mx + 20 * max(0.0, float(o["FPR_CAGR"] or 0)) / mg + 15 * o["n_accounts"] / nb
                 + 15 * feas + 15 * o["demand_confidence"] / 100 - diff)
            o["priority_score"] = round(max(0, s), 1)
            o["score_formula"] = "35×규모(FPR_2031 상대) + 20×성장률(상대) + 15×수요 고객 수(상대) + 15×진입 가능성 + 15×수요 신뢰도 − 실행 난이도"
        out.sort(key=lambda o: o["priority_score"], reverse=True)
    return out


def opportunity_evidence(accounts, params, strat, sigmap):
    """vNext (additive, values unchanged): separate the EVIDENCE STATUS of each account×area opportunity from its AMOUNT.

    Amount: always the model value (by_cat). value_basis says how the category share was set
      ACCOUNT_SPECIFIC_SHARE (KISA security ratio, contract category) | MODEL_ALLOCATED (industry mix A-MIX).
    Evidence tier (first matching rule wins):
      EVIDENCE_BASED  — the account has ≥1 sourced observation for this area: DEMAND_SIGNAL (research driver),
                        ACCOUNT_SPECIFIC_SHARE, or INCUMBENT_OBSERVED (competitive observation = spend observed)
      MODEL_ESTIMATED — no area observation, but the account's TS rests on its own evidence (disclosure/financials)
      UNVERIFIED      — neither (TS from industry average, scenario or contract-only)
    Also per area: model vs observed demand-account counts, evidence level, assumption dependency of growth."""
    cats = params["categories"]
    alloc = params["increment_allocation"]
    tmap = sigmap.get("types", {})
    rule = sigmap.get("evidence_level_rule", {})
    by_area = {s["area"]: s for s in strat}
    agg = {a: {"tiers": {"EVIDENCE_BASED": D0, "MODEL_ESTIMATED": D0, "UNVERIFIED": D0},
               "tier_accounts": {"EVIDENCE_BASED": set(), "MODEL_ESTIMATED": set(), "UNVERIFIED": set()},
               "signal_accounts": set(), "incumbent_accounts": set(), "specific_accounts": set(), "signals": [],
               "inc_total": D0, "inc_assumed": D0} for a in by_area}
    for acc in accounts:
        m26, m31 = acc["m"]["2026"], acc["m"]["2031"]["base"]
        f31_by = (m31["FPR_base"] or {}).get("by_cat") or {}
        basis = (acc.get("evidence_basis") or {}).get("basis")
        ov_raw = {}
        obs = {}  # area -> {type: [ids]}
        for d in acc.get("_drivers", []) or []:
            for c in tmap.get(d.get("type"), []):
                ar = cats[c]["biz_area"]
                obs.setdefault(ar, {}).setdefault("DEMAND_SIGNAL", []).append(d.get("driver_id"))
                if ar in agg and acc["aggregate_class"] != "DEFINITION_MISMATCH":
                    agg[ar]["signals"].append({"account_id": acc["account_id"], "signal_id": d.get("driver_id"), "type": d.get("type"),
                                               "description": (d.get("description") or "")[:160], "period": d.get("period"),
                                               "evidence_ids": d.get("evidence_ids", [])})
        for i, cobs in enumerate(acc.get("_competitive", []) or []):
            c = cobs.get("category")
            if c in cats:
                obs.setdefault(cats[c]["biz_area"], {}).setdefault("INCUMBENT_OBSERVED", []).append(f"{acc['account_id']}-C{i + 1:02d}")
        if acc.get("sec_ratio") is not None:
            obs.setdefault(cats["SECURITY"]["biz_area"], {}).setdefault("ACCOUNT_SPECIFIC_SHARE", []).append("KISA_SECURITY_RATIO")
        if acc["m"]["2026"]["TS"]["value"] is None and m26["RAW"]["value"] is not None:  # contract-category RAW (raw_direct)
            for c, v in (m26["RAW"].get("by_cat") or {}).items():
                if v:
                    obs.setdefault(cats[c]["biz_area"], {}).setdefault("ACCOUNT_SPECIFIC_SHARE", []).append("CONTRACT_CATEGORY")
                    ov_raw[cats[c]["biz_area"]] = True
        for d in acc.get("infra_drivers", []) or []:
            for c in alloc.get("infra", {}):
                obs.setdefault(cats[c]["biz_area"], {}).setdefault("ACCOUNT_SPECIFIC_SHARE", []).append(d.get("driver_id"))
        area_ev = {}
        for ar in by_area:
            ccs = [c for c in cats if cats[c]["biz_area"] == ar]
            f31 = sum((f31_by.get(c) or D0) for c in ccs)
            o = obs.get(ar, {})
            tier = "EVIDENCE_BASED" if o else ("MODEL_ESTIMATED" if basis in ("DIRECT_IT_DISCLOSURE", "RECONSTRUCTED_FINANCIALS") else "UNVERIFIED")
            vb = "ACCOUNT_SPECIFIC_SHARE" if "ACCOUNT_SPECIFIC_SHARE" in o else "MODEL_ALLOCATED"
            area_ev[ar] = {"tier": tier, "value_basis": vb, "evidence_types": sorted(o), "observation_ids": {k: v[:12] for k, v in o.items()},
                           "FPR_2031": f31 if f31_by else None}
            if acc["aggregate_class"] == "DEFINITION_MISMATCH" or not f31_by or f31 <= 0:
                continue
            A_ = agg[ar]
            A_["tiers"][tier] += f31
            A_["tier_accounts"][tier].add(acc["account_id"])
            if "DEMAND_SIGNAL" in o: A_["signal_accounts"].add(acc["account_id"])
            if "INCUMBENT_OBSERVED" in o: A_["incumbent_accounts"].add(acc["account_id"])
            if "ACCOUNT_SPECIFIC_SHARE" in o: A_["specific_accounts"].add(acc["account_id"])
            # assumption dependency of TS growth in this area: increments allocated by B-ALLOC (excl. account infra drivers)
            t26, t31 = m26["TS"].get("by_cat") or {}, (m31["TS"] or {}).get("by_cat") or {}
            br = m31.get("bridge") or {}
            if t26 and t31:
                g = D(str(br.get("organic_cagr", 0)))
                infra = D(str((br.get("components") or {}).get("infra", 0)))
                for c in ccs:
                    org = t26[c] * (1 + g) ** 5
                    inc_total = t31[c] - t26[c]
                    inc_assumed = t31[c] - org - infra * D(str(alloc.get("infra", {}).get(c, 0)))
                    A_["inc_total"] += inc_total
                    A_["inc_assumed"] += inc_assumed
        acc["area_evidence"] = area_ev
    for ar, s in by_area.items():
        A_ = agg[ar]
        tot = sum(A_["tiers"].values(), D0)
        share = (A_["tiers"]["EVIDENCE_BASED"] / tot) if tot > 0 else None
        n_ev = len(A_["tier_accounts"]["EVIDENCE_BASED"])
        suf, par = rule.get("SUFFICIENT", {}), rule.get("PARTIAL", {})
        level = ("SUFFICIENT" if share is not None and share >= D(str(suf.get("min_evidence_share", .5))) and n_ev >= suf.get("min_evidence_accounts", 5)
                 else "PARTIAL" if share is not None and share >= D(str(par.get("min_evidence_share", .25))) else "INSUFFICIENT")
        dep = (A_["inc_assumed"] / A_["inc_total"]) if A_["inc_total"] > 0 else None
        s["evidence"] = {
            "n_accounts_model": s["n_accounts"], "n_accounts_signal": len(A_["signal_accounts"]),
            "n_accounts_incumbent_obs": len(A_["incumbent_accounts"]), "n_accounts_specific_share": len(A_["specific_accounts"]),
            "fpr2031_by_tier": A_["tiers"], "accounts_by_tier": {k: sorted(v) for k, v in A_["tier_accounts"].items()},
            "evidence_share": share, "evidence_level": level, "signals": A_["signals"][:40],
            "assumption_dependency": dep,
            "assumption_dependency_note": "2026→2031 TS 증가분 중 브리지 배분 가정(B-ALLOC: 클라우드·AI·규제·효율·대체 증분)에서 생긴 비중. 자연 성장·계정별 인프라 동인 제외",
            "recommendation_mode": "RECOMMENDATION" if level == "SUFFICIENT" else "HYPOTHESIS",
        }


# --------------------------------------------------------------------------- serialisation
def jsonable(o):
    if isinstance(o, Decimal):
        return float(q2(o)) if abs(o) >= 1 else float(o.quantize(Decimal("0.000001")))
    if isinstance(o, dict):
        return {k: jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, set):
        return sorted(o)
    return o


def collect_evidence(research, aid, market=None, referenced=()):
    out = []
    mk = {e["evidence_id"]: e for e in (market or {}).get("evidence", [])}
    for eid in sorted(set(referenced)):
        if eid in mk:  # market-level benchmark evidence referenced by this account's metrics
            e = dict(mk[eid]); e["account_id"] = aid; e["notes"] = (e.get("notes") or "") + " [시장 벤치마크 근거]"
            e["source_hash"] = hashlib.sha256(json.dumps(e, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
            out.append(e)
    for e in (research or {}).get("evidence", []):
        e = dict(e)
        e["account_id"] = aid
        e["source_hash"] = hashlib.sha256(json.dumps(e, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
        out.append(e)
    return out


def write_sqlite(accounts, evidence, issues, params, market, strategy_rows, mgmt):
    PROCESSED.mkdir(parents=True, exist_ok=True)
    db = PROCESSED / "intel.db"
    if db.exists():
        db.unlink()
    con = sqlite3.connect(db)
    cur = con.cursor()
    cur.executescript(open(ROOT / "backend" / "schema.sql", encoding="utf-8").read())
    for a in accounts:
        e = a["entity"]
        cur.execute("INSERT INTO accounts VALUES (?,?,?,?,?,?,?,?)",
                    (a["account_id"], a["original_name"], a["segment"], a["family"], a["research_status"],
                     a["aggregate_class"], json.dumps(a["overlap_groups"], ensure_ascii=False), DATA_VERSION))
        cur.execute("INSERT INTO account_entities VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (a["account_id"], e.get("legal_name_ko"), e.get("legal_name_en"), e.get("corp_code"), e.get("stock_code"),
                     e.get("business_reg_no"), e.get("parent_group"), e.get("industry_detail"), int(bool(e.get("is_korean_entity"))),
                     int(bool(e.get("dart_available"))), e.get("economic_scope"), e.get("exclusions"), e.get("entity_status"),
                     e.get("entity_notes")))
        for f in a.get("_facts", []):
            cur.execute("INSERT INTO financial_facts VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (f.get("fact_id"), a["account_id"], f.get("metric"), f.get("fiscal_year"), str(f.get("value")), f.get("unit"),
                         f.get("scope"), f.get("verification_status"), json.dumps(f.get("evidence_ids", [])), f.get("analyst_interpretation")))
        for d in a.get("_drivers", []):
            cur.execute("INSERT INTO forecast_assumptions VALUES (?,?,?,?,?,?,?,?)",
                        (d.get("driver_id"), a["account_id"], d.get("type"), d.get("description"), str(d.get("amount")),
                         d.get("unit"), d.get("period"), json.dumps(d.get("evidence_ids", []))))
        for c in a.get("_competitive", []):
            cur.execute("INSERT INTO competitive_assumptions VALUES (?,?,?,?,?,?)",
                        (a["account_id"], c.get("category"), c.get("observation"), c.get("incumbent"), c.get("lgu_relationship"),
                         json.dumps(c.get("evidence_ids", []))))
        def put(metric, year, scen, case, r):
            cur.execute("INSERT INTO account_metrics VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (a["account_id"], metric, year, scen, case,
                         None if r["value"] is None else str(r["value"]), None if r.get("low") is None else str(r["low"]),
                         None if r.get("high") is None else str(r["high"]), r["unit"], r["status"], r["confidence"],
                         r["formula"], json.dumps(r["evidence_ids"]), json.dumps(r["assumption_ids"]), DATA_VERSION))
            for eid in r["evidence_ids"]:
                cur.execute("INSERT INTO metric_evidence_links VALUES (?,?,?,?,?,?)", (a["account_id"], metric, year, scen, eid, DATA_VERSION))
        for k, r in a["m"]["2026"].items():
            put(k, 2026, "base", "base", r)
        for s, blk in a["m"]["2031"].items():
            for k, r in blk.items():
                if isinstance(r, dict) and "status" in r:
                    metric, case = (k.split("_")[0], k.split("_")[1]) if k.startswith(("RAW_b", "RAW_e", "FPR_b", "FPR_e")) else (k, "base")
                    put(metric, 2031, s, case, r)
        for k, r in a["m"]["target"].items():
            put(k, 2031, "base", "base", r)
        for c in CATEGORIES:
            bc = a["m"]["2026"]["TS"].get("by_cat")
            if bc:
                cur.execute("INSERT INTO it_spending_components VALUES (?,?,?,?,?,?,?)",
                            (a["account_id"], 2026, "base", c, str(bc[c]), str(a["m"]["2026"]["RAW"]["by_cat"][c]), str(a["m"]["2026"]["FPR"]["by_cat"][c])))
            for s in SCENARIOS:
                b = a["m"]["2031"][s]
                if b["TS"].get("by_cat"):
                    cur.execute("INSERT INTO it_spending_components VALUES (?,?,?,?,?,?,?)",
                                (a["account_id"], 2031, s, c, str(b["TS"]["by_cat"][c]), str(b["RAW_base"]["by_cat"][c]), str(b["FPR_base"]["by_cat"][c])))
    for e in evidence:
        cur.execute("INSERT INTO evidence_sources VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (e.get("evidence_id"), e.get("account_id"), e.get("tier"), e.get("source_type"), e.get("source_title"),
                     e.get("publisher"), e.get("source_url"), e.get("document_id"), e.get("publication_date"), e.get("accessed_at"),
                     e.get("fiscal_period"), e.get("page_or_section"), e.get("quoted_statement"), str(e.get("reported_value")),
                     e.get("reported_unit"), e.get("verification_status"), e.get("notes"), e.get("source_hash"), DATA_VERSION))
    for i in issues:
        cur.execute("INSERT INTO data_quality_issues VALUES (?,?,?,?,?,?,?,?)",
                    (i["account_id"], i["severity"], i["code"], i["message"], i.get("metric"), i.get("year"), i.get("scenario"), DATA_VERSION))
    for aid, r in mgmt.items():
        if aid.startswith("_"):
            continue
        cur.execute("INSERT INTO management_inputs VALUES (?,?,?,?,?,?,?)",
                    (aid, r.get("cr_2026_ytd_eok"), r.get("cr_2026_forecast_eok"), r.get("cr_basis"), r.get("target_revenue_2031_eok"),
                     r.get("target_basis"), r.get("updated_at")))
    for s in strategy_rows:
        cur.execute("INSERT INTO strategic_opportunities VALUES (?,?,?,?,?,?,?,?,?)",
                    (s["area"], str(s["FPR_2026"]), str(s["FPR_2031"]), None if s["FPR_CAGR"] is None else str(s["FPR_CAGR"]),
                     s["n_accounts"], s["priority_score"], s.get("recommendation_type"), s.get("recommendation"), DATA_VERSION))
    cur.execute("INSERT INTO research_runs VALUES (?,?,?)", (DATA_VERSION, datetime.now(timezone.utc).isoformat(),
                                                             json.dumps({"accounts": len(accounts), "evidence": len(evidence), "issues": len(issues)})))
    # metric version history (append-only across builds)
    con.commit()
    con.close()
    hist = PROCESSED / "metric_history.csv"
    new = not hist.exists()
    with open(hist, "a", encoding="utf-8") as f:
        if new:
            f.write("data_version,account_id,metric,year,scenario,value,status,confidence\n")
        for a in accounts:
            for k in ("TS", "RAW", "FPR"):
                r = a["m"]["2026"][k]
                f.write(f"{DATA_VERSION},{a['account_id']},{k},2026,base,{'' if r['value'] is None else q2(r['value'])},{r['status']},{r['confidence']}\n")
                r = a["m"]["2031"]["base"]["TS" if k == "TS" else f"{k}_base"]
                f.write(f"{DATA_VERSION},{a['account_id']},{k},2031,base,{'' if r['value'] is None else q2(r['value'])},{r['status']},{r['confidence']}\n")
    return db


def write_exports(accounts):
    EXPORTS.mkdir(parents=True, exist_ok=True)
    rows = []
    for a in accounts:
        m26, m31, t = a["m"]["2026"], a["m"]["2031"], a["m"]["target"]
        v = lambda r: None if r["value"] is None else float(q2(r["value"])) if r["unit"] == "억원" else float(r["value"])
        rows.append({
            "account_id": a["account_id"], "original_name": a["original_name"], "legal_name": a["entity"].get("legal_name_ko"),
            "segment": a["segment"], "research_status": a["research_status"], "aggregate_class": a["aggregate_class"],
            "ts_method": a["anchor"]["method"], "anchor_fy": a["anchor"].get("fiscal_year"),
            "TS_2026": v(m26["TS"]), "TS_2026_low": None if m26["TS"]["low"] is None else float(q2(m26["TS"]["low"])),
            "TS_2026_high": None if m26["TS"]["high"] is None else float(q2(m26["TS"]["high"])), "TS_2026_status": m26["TS"]["status"],
            "TS_2026_conf": m26["TS"]["confidence"], "RAW_2026": v(m26["RAW"]), "FPR_2026": v(m26["FPR"]), "CR_2026": v(m26["CR"]),
            "CSOW_2026": v(m26["CSOW"]), "UPSIDE_2026": v(m26["UPSIDE"]),
            "TS_2031_low": v(m31["low"]["TS"]), "TS_2031_base": v(m31["base"]["TS"]), "TS_2031_high": v(m31["high"]["TS"]),
            "RAW_2031_base": v(m31["base"]["RAW_base"]), "RAW_2031_expansion": v(m31["base"]["RAW_expansion"]),
            "FPR_2031_base": v(m31["base"]["FPR_base"]), "FPR_2031_expansion": v(m31["base"]["FPR_expansion"]),
            "TARGET_2031": v(t["TARGET"]), "TARGET_2031_status": t["TARGET"]["status"],
            "TARGET_2031_source": t["TARGET"].get("target_source"), "TARGET_SOW": v(t["TARGET_SOW"]),
            "TS_CAGR": v(m31["base"]["TS_CAGR"]), "RAW_CAGR": v(m31["base"]["RAW_CAGR"]), "FPR_CAGR": v(m31["base"]["FPR_CAGR"]),
        })
    import csv
    with open(EXPORTS / "account_metrics.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    return rows


def main():
    params, seed, overrides, corrections, overlap, strategy, pev, market, mgmt = load_inputs()
    fxr = fx(params)
    issues: list[dict] = []
    researches = {r["account_id"]: load_research(r["account_id"], corrections, issues) for r in seed}
    load_issues = {}
    for i in issues:
        load_issues.setdefault(i["account_id"], []).append(i)
    issues = []
    params_cal, calib = calibrate_intensity(seed, researches, params, fxr)

    group_of = {}
    for g in overlap.get("groups", []):
        for aid in g["members"]:
            group_of.setdefault(aid, []).append(g["group_id"])

    accounts, evidence = [], []
    for row in seed:
        aid = row["account_id"]
        research, ov = researches[aid], overrides.get(aid)
        acc_issues: list[dict] = list(load_issues.get(aid, []))
        model = model_account(row, research, ov, params_cal, pev, mgmt.get(aid), fxr, acc_issues)
        ent = (research or {}).get("entity", {})
        definition_mismatch = bool(model["anchor"].get("definition_note"))
        acc = {"account_id": aid, "original_name": row["original_name"], "segment": row["segment"], "pilot": row["pilot"] == "Y",
               "entity": ent, "overlap_groups": group_of.get(aid, []), **model,
               "aggregate_class": ("EXCLUDED_UNKNOWN" if model["m"]["2026"]["TS"]["value"] is None and model["m"]["2026"]["RAW"]["value"] is None
                                   else "DEFINITION_MISMATCH" if definition_mismatch
                                   else "OVERLAP_RISK" if group_of.get(aid) else "COMPARABLE"),
               "_facts": (research or {}).get("facts", []), "_drivers": (research or {}).get("drivers", []),
               "_competitive": (research or {}).get("competitive", []),
               "research_log": (research or {}).get("research_log", []), "source_hash": (research or {}).get("_source_hash")}
        acc_issues += validate_account(acc)
        _mr = mgmt.get(aid) or {}
        if (_mr.get("cr_2026_forecast_eok") or _mr.get("target_revenue_2031_eok")) and not _mr.get("_from_internal_store"):
            acc_issues.append({"account_id": aid, "severity": "WARN", "code": "LEGACY_DIRECT_INPUT",
                               "message": "CR/Target이 레거시 CSV(management_inputs.csv, Git 추적 파일)에서 입력됨 — 미리보기·승인 이력 없음. Excel 승인 절차로 재입력 권장",
                               "metric": "CR", "year": 2026, "scenario": None})
        if ent.get("entity_status") in ("PROBABLE", "UNCERTAIN"):
            acc_issues.append({"account_id": aid, "severity": "WARN", "code": "ENTITY_MAPPING",
                               "message": f"법인 매핑 {ent.get('entity_status')}: {ent.get('entity_notes', '')[:200]}",
                               "metric": None, "year": None, "scenario": None})
        if research is None:
            acc_issues.append({"account_id": aid, "severity": "WARN", "code": "NOT_RESEARCHED", "message": "조사 파일 없음",
                               "metric": None, "year": None, "scenario": None})
        acc["research_status"] = research_status(research, model, acc_issues, ov)
        from models.qa.final_audit import evidence_basis
        b_, lvl_ = evidence_basis(acc)
        acc["evidence_basis"] = {"basis": b_, "source_level": lvl_, "definition_mismatch": definition_mismatch}
        acc["narrative"] = narrative(row, research, model, params)
        acc["issues"] = acc_issues
        refs = set(model["anchor"].get("evidence_ids", []))
        for i in model["anchor"].get("inputs", []):
            refs.update(i.get("evidence_ids", []) or [])
        acc["evidence"] = collect_evidence(research, aid, market, refs)
        acc["facts"] = acc["_facts"]
        acc["drivers"] = acc["_drivers"]
        acc["competitive"] = acc["_competitive"]
        acc["open_questions"] = (research or {}).get("open_questions", [])
        acc["override_notes"] = (ov or {}).get("notes", [])
        acc["reconciliation"] = reconcile(acc, model, mgmt.get(aid))
        assign_grades(acc, ov)
        acc["conflicts"] = (research or {}).get("conflicts", [])
        acc["comparables"] = (research or {}).get("comparables", [])
        acc["estimation_inputs"] = (research or {}).get("estimation_inputs", [])
        acc["recovery_levels_tried"] = (research or {}).get("recovery_levels_tried", [])
        from models.audit import EXTERNAL_FIELDS, INTERNAL_FIELDS, classify, load_na_cfg
        acc["na_class"] = {f"{y}|{mt}": dict(zip(("class", "reason"), classify(jsonable(acc), y, mt, load_na_cfg())))
                           for (y, mt) in EXTERNAL_FIELDS + INTERNAL_FIELDS}
        issues += acc_issues
        evidence += acc["evidence"]
        accounts.append(acc)

    portfolio = {
        "aggregate": aggregate(accounts),
        "by_segment": by_dimension(accounts, lambda a: a["segment"]),
        "by_family": by_dimension(accounts, lambda a: a["family"]),
        "overlap_groups": overlap.get("groups", []),
    }
    strat = strategy_engine(accounts, params, strategy)
    sigmap = load_json(CONFIG / "demand_signal_map.json", {"types": {}})
    opportunity_evidence(accounts, params, strat, sigmap)
    # Phase 3A: Opportunity-to-Action (3 evidence lenses, initiatives, weight sensitivity) — additive, scores unchanged
    from models.strategy_actions import build as _actions
    initiatives, prio_sens, opp_flow = _actions(accounts, strat, params, market, sigmap)
    db = write_sqlite(accounts, evidence, issues, params, market, strat, mgmt)
    write_exports(accounts)

    status_counts = {}
    for a in accounts:
        status_counts[a["research_status"]] = status_counts.get(a["research_status"], 0) + 1
    metric_status = {}
    for a in accounts:
        for k in ("TS", "RAW", "FPR", "CR"):
            s = a["m"]["2026"][k]["status"]
            metric_status.setdefault(k, {}).setdefault(s, 0)
            metric_status[k][s] += 1
    fact_status = {}
    for a in accounts:
        for f in a["facts"]:
            fact_status[f.get("verification_status")] = fact_status.get(f.get("verification_status"), 0) + 1

    out = {
        "meta": {"data_version": DATA_VERSION, "generated_at": datetime.now(timezone.utc).isoformat(), "unit": "억원",
                 "currency": "KRW", "n_accounts": len(accounts), "status_counts": status_counts,
                 "metric_status_2026": metric_status, "fact_status": fact_status, "fx_usd_krw": float(fxr),
                 "is_test_data": False,
                 "contains_internal_data": any(isinstance(v, dict) and v.get("_from_internal_store") for v in mgmt.values()) or
                 any(isinstance(v, dict) and (v.get("cr_2026_forecast_eok") or v.get("target_revenue_2031_eok")) for v in mgmt.values()),
                 "internal_store_error": (mgmt.get("_internal_store_error") or {}).get("error")},
        "params": params, "parameter_evidence": pev, "intensity_calibration": calib,
        "market_benchmarks": market,
        "accounts": [{k: v for k, v in a.items() if not k.startswith("_")} for a in accounts],
        "portfolio": portfolio, "strategy": strat,
        "initiatives": initiatives, "priority_sensitivity": prio_sens, "opportunity_flow": opp_flow,
        "issues_summary": {sev: sum(1 for i in issues if i["severity"] == sev) for sev in ("ERROR", "WARN", "INFO")},
    }
    # Phase 3A: metric ledger + official-source selection (additive; engine values unchanged, empty internal store → defaults)
    from models.recon.ledger import build_block as _recon_block
    out["recon"] = _recon_block(accounts, DATA_VERSION)
    if any(not r.get("synthetic") for a in out["recon"]["accounts"].values() for r in a["internal"]):
        out["meta"]["contains_internal_data"] = True
    # Phase 1/2: coverage & N/A taxonomy summary for the dashboard
    from models.audit import audit as _audit, coverage as _coverage
    _cov = _coverage(_audit(jsonable(out), "current"))
    _base = load_json(ROOT / "data" / "phase1" / "baseline_coverage.json", None)
    out["meta"]["coverage"] = {"current": _cov, "baseline": _base}
    FRONT_DATA.mkdir(parents=True, exist_ok=True)
    (FRONT_DATA / "dashboard.json").write_text(json.dumps(jsonable(out), ensure_ascii=False), encoding="utf-8")
    if not SANDBOX:
        (ROOT / "frontend" / "src" / "data" / "dashboard.json").write_text(json.dumps(jsonable(out), ensure_ascii=False), encoding="utf-8")
    (PROCESSED / "dashboard.json").write_text(json.dumps(jsonable(out), ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"data_version={DATA_VERSION} accounts={len(accounts)} evidence={len(evidence)} "
          f"issues={out['issues_summary']} status={status_counts}")
    print("metric_status_2026:", metric_status)
    return out


if __name__ == "__main__":
    main()
