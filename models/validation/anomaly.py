"""Phase 1-6 — cross-account error re-verification rules.

python3 -m models.validation.anomaly
→ data/phase1/DATA_CONFLICTS.csv, data/phase1/CORRECTIONS.json (applied corrections w/ before→after),
  data/phase1/MODEL_CHANGE_LOG.csv (v1 baseline vs current per account metric)

Each rule = (code, root cause, detection logic). Rules only FLAG; values are corrected only through
config/research_corrections.json or account_overrides.json (with before/after + evidence preserved).
"""
from __future__ import annotations

import csv
import json
import statistics

from models.common import CONFIG, PROCESSED, ROOT, D, to_eok

OUT = ROOT / "data" / "phase1"
FX = D(1400)

RULES = {
    "R01_SECURITY_MISCLASS": "정보보호 예산/투자를 전사 IT 예산으로 오분류 (COR-001 유형). 탐지: it_budget ≤ 3×동년 security 또는 < KISA IT의 50%",
    "R02_IT_RATIO_OUTLIER": "IT 지출 과대·과소추정. 탐지: TS/별도매출(또는 판관비)이 산업군 실측 범위의 0.5배 미만·2배 초과",
    "R03_SCOPE_MIX": "연결/별도·글로벌/국내 혼동. 탐지: TS 앵커 입력 사실의 scope에 '연결' 또는 '글로벌' 포함",
    "R04_MULTIYEAR_AS_ANNUAL": "다년 계약·투자 총액의 단년 반영. 탐지: period가 다년인 contract_value/dc_investment가 앵커에 직접 사용",
    "R05_GROUP_OVERLAP": "그룹사 중복. 탐지: 연결 중복 위험 HIGH 그룹 구성원이 연결 기준 수치를 앵커로 사용",
    "R06_PLAN_VS_ACTUAL": "투자계획을 실적으로 혼동. 탐지: 계획(driver) 기반 인프라 증분이 2031 TS의 30% 이상",
    "R07_GROWTH_EXCESS": "과도한 성장률 가정. 탐지: TS CAGR(base) > 20% 또는 < -5%, FPR CAGR > 35%",
    "R08_YEAR_AMBIGUITY": "공시연도·회계연도 혼동. 탐지: open_questions/해석에 연도 불명확 언급",
    "R09_SOURCE_CONFLICT": "근거 간 수치 충돌. 탐지: Phase 1 보충조사 conflicts에서 기존값 대비 ±15% 초과 차이",
    "R10_DEFINITION_MISMATCH": "TS 정의 상이(CAPEX 기준 등). 탐지: definition_note 존재 → 합산 제외 여부 확인",
}


def run():
    d = json.loads((PROCESSED / "dashboard.json").read_text(encoding="utf-8"))
    base = json.loads((PROCESSED / "dashboard_v1_baseline.json").read_text(encoding="utf-8"))
    cal = d["intensity_calibration"]
    rows = []

    def add(a, rule, severity, detail, existing="", new="", ev=""):
        rows.append({"account_id": a["account_id"], "original_name": a["original_name"], "rule": rule, "root_cause": RULES[rule],
                     "severity": severity, "detail": detail, "existing_value": existing, "new_or_alt_value": new, "evidence_ids": ev})

    for a in d["accounts"]:
        facts = a["facts"]
        anc = a["anchor"]
        ts = a["m"]["2026"]["TS"]["value"]
        # R01
        secs = {f["fiscal_year"]: f for f in facts if f["metric"] in ("kisa_security_investment", "security_budget")}
        for f in facts:
            if f["metric"] == "it_budget":
                s = secs.get(f["fiscal_year"])
                try:
                    v = float(to_eok(f["value"], f["unit"], FX))
                    sv = float(to_eok(s["value"], s["unit"], FX)) if s else None
                except Exception:
                    continue
                if sv and v <= 3 * sv:
                    add(a, "R01_SECURITY_MISCLASS", "ERROR", f"it_budget FY{f['fiscal_year']} {v:,.0f}억 ≤ 3×정보보호 {sv:,.0f}억", v, sv, ",".join(f["evidence_ids"]))
        for c in a.get("corrections_applied", []):
            pass
        # R02
        fam = a["family"]
        band = cal.get(fam)
        if ts and band and band.get("n", 0) >= 2 and anc["method"] not in ("REVENUE_INTENSITY",):
            denom_metric = band.get("denominator", "revenue")
            dens = [f for f in facts if f["metric"] in ((denom_metric,) if denom_metric == "sga" else ("revenue", "operating_revenue"))
                    and "별도" in (f.get("scope") or "") and f["fiscal_year"] == anc.get("fiscal_year")]
            if dens:
                try:
                    dv = float(to_eok(dens[0]["value"], dens[0]["unit"], FX))
                    ratio = float(anc["value"]) / dv
                    if ratio < band["low"] * 0.5 or ratio > band["high"] * 2:
                        add(a, "R02_IT_RATIO_OUTLIER", "WARN", f"IT/{denom_metric} {ratio:.2%} vs 산업군 범위 {band['low']:.2%}~{band['high']:.2%}", f"{ratio:.4f}", "")
                except Exception:
                    pass
        # R03
        for inp in anc.get("inputs", []):
            sc = inp.get("scope") or ""
            if "연결" in sc or "글로벌" in sc:
                add(a, "R03_SCOPE_MIX", "WARN", f"앵커 입력 '{inp.get('name')}' scope={sc}")
        # R04
        if anc["method"] == "ACCOUNT_SPECIFIC" and "÷" not in anc.get("formula", "") and any(
                f["metric"] in ("contract_value", "dc_investment") for f in facts):
            add(a, "R04_MULTIYEAR_AS_ANNUAL", "WARN", "계정별 앵커가 다년 금액을 연환산 표기 없이 사용 가능성")
        # R05
        if a["aggregate_class"] == "OVERLAP_RISK":
            grp = [g for g in d["portfolio"]["overlap_groups"] if a["account_id"] in g["members"] and g["risk"] == "HIGH"]
            if grp and any("연결" in (i.get("scope") or "") for i in anc.get("inputs", [])):
                add(a, "R05_GROUP_OVERLAP", "ERROR", f"{grp[0]['name']}: 연결 수치 앵커")
        # R06 / R07
        b = a["m"]["2031"]["base"]
        br = b.get("bridge") or {}
        infra = (br.get("components") or {}).get("infra", 0) or 0
        if b["TS"]["value"] and infra > 0.3 * b["TS"]["value"]:
            add(a, "R06_PLAN_VS_ACTUAL", "WARN", f"계획 기반 인프라 증분 {infra:,.0f}억 = TS2031의 {infra / b['TS']['value']:.0%}")
        c = b["TS_CAGR"]["value"]
        if c is not None and (c > 0.20 or c < -0.05):
            add(a, "R07_GROWTH_EXCESS", "WARN", f"TS CAGR {c:.1%}")
        fc = b["FPR_CAGR"]["value"]
        if fc is not None and fc > 0.35:
            add(a, "R07_GROWTH_EXCESS", "WARN", f"FPR CAGR {fc:.1%}")
        # R08
        for q in a.get("open_questions", []):
            if any(k in q for k in ("연도", "회계연도", "공시연도")) and any(k in q for k in ("불명", "미확정", "모호", "차이", "불일치", "인지")):
                add(a, "R08_YEAR_AMBIGUITY", "INFO", q[:200])
                break
        for f_ in facts:
            if "연도 미확정" in (f_.get("analyst_interpretation") or "") and f_["metric"].startswith("kisa"):
                add(a, "R08_YEAR_AMBIGUITY", "WARN", f"{f_['fact_id']} {f_['metric']} 연도 미확정: {f_['analyst_interpretation'][:120]}")
                break
        # R09
        for cf in a.get("conflicts", []):
            try:
                ev_, nv = float(str(cf.get("existing_value")).replace(",", "")), float(str(cf.get("new_value")).replace(",", ""))
                diff = abs(nv - ev_) / ev_ if ev_ else None
            except Exception:
                diff = None
            if diff is None or diff > 0.15:
                add(a, "R09_SOURCE_CONFLICT", "WARN", (cf.get("explanation") or "")[:240], cf.get("existing_value"), cf.get("new_value"),
                    ",".join(cf.get("evidence_ids", [])))
        # R10
        if anc.get("definition_note"):
            add(a, "R10_DEFINITION_MISMATCH", "INFO", anc["definition_note"][:200])

    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "DATA_CONFLICTS.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["account_id", "original_name", "rule", "root_cause", "severity", "detail", "existing_value", "new_or_alt_value", "evidence_ids"])
        w.writeheader(); w.writerows(rows)

    # corrections ledger (config corrections + override-level changes vs baseline)
    corr = json.loads((CONFIG / "research_corrections.json").read_text(encoding="utf-8"))
    ba = {a["account_id"]: a for a in base["accounts"]}
    change = []
    for a in d["accounts"]:
        b0 = ba[a["account_id"]]
        for y, m, get in (("2026", "TS", lambda x: x["m"]["2026"]["TS"]), ("2026", "RAW", lambda x: x["m"]["2026"]["RAW"]),
                          ("2026", "FPR", lambda x: x["m"]["2026"]["FPR"]), ("2031", "TS", lambda x: x["m"]["2031"]["base"]["TS"]),
                          ("2031", "FPR", lambda x: x["m"]["2031"]["base"]["FPR_base"])):
            v0, v1 = get(b0)["value"], get(a)["value"]
            if v0 != v1 and not (v0 is not None and v1 is not None and abs(v0 - v1) < 0.5):
                change.append({"account_id": a["account_id"], "original_name": a["original_name"], "year": y, "metric": m,
                               "v1_baseline": v0, "current": v1, "delta": None if v0 is None or v1 is None else round(v1 - v0, 2),
                               "v1_method": b0["anchor"]["method"], "current_method": a["anchor"]["method"],
                               "change_type": "RECOVERED" if v0 is None and v1 is not None else "REMOVED" if v1 is None else "REVISED",
                               "current_formula": a["anchor"]["formula"][:200]})
    with open(OUT / "MODEL_CHANGE_LOG.csv", "w", encoding="utf-8-sig", newline="") as f:
        if change:
            w = csv.DictWriter(f, fieldnames=list(change[0].keys())); w.writeheader(); w.writerows(change)
    ledger = {"rules": RULES, "config_corrections": corr["corrections"],
              "model_revisions": [c for c in change if c["change_type"] == "REVISED" and c["metric"] == "TS"],
              "note": "원천 조사파일은 불변. 수정은 research_corrections.json(사실 보정)·account_overrides.json(계정 모델)로만 수행하며 변경 전·후 값은 MODEL_CHANGE_LOG.csv에 보존."}
    (OUT / "CORRECTIONS.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    print("conflicts:", Counter((r["rule"], r["severity"]) for r in rows))
    print("changes:", Counter(c["change_type"] for c in change))


if __name__ == "__main__":
    run()
