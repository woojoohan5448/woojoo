"""Total IT Spending (TS) anchor selection and FY2026 estimation.

Anchor priority (METHODOLOGY.md §3):
  1. DIRECT_IT_BUDGET      - company-stated FY2026 IT budget
  2. KISA_IT_INVESTMENT    - KISA 정보보호 공시 '정보기술부문 투자액' (latest FY), grown to FY2026
  3. KISA_DERIVED          - 정보보호 투자액 / (정보보호÷정보기술 비율)
  4. ACCOUNT_SPECIFIC      - analyst override with explicit formula (hyperscaler, fund, defense …)
  5. REVENUE_INTENSITY     - revenue × segment IT intensity (Tier 3; low confidence)
  6. UNKNOWN
"""
from __future__ import annotations

from decimal import Decimal

from models.common import D, to_eok

MONETARY_SECONDARY_OK = {"VERIFIED", "DERIVED", "SECONDARY_UNCONFIRMED"}


def _facts(research: dict, metric: str) -> list[dict]:
    out = [f for f in research.get("facts", []) if f.get("metric") == metric and f.get("value") not in (None, "")]
    return sorted(out, key=lambda f: int(f.get("fiscal_year") or 0), reverse=True)


def _evidence_tier(research: dict, ev_ids: list[str]) -> int:
    tiers = [e.get("tier", 3) for e in research.get("evidence", []) if e.get("evidence_id") in ev_ids]
    return min(tiers) if tiers else 3


def _fact_to_eok(f: dict, fx) -> Decimal | None:
    try:
        return to_eok(f["value"], f.get("unit", ""), fx)
    except Exception:
        return None


def select_anchor(research: dict, override: dict, family: str, params: dict, fx: Decimal, aid: str = "") -> dict:
    """Return the FY anchor for TS with full lineage. Values in 억원."""
    ov = override.get("ts_anchor") if override else None
    if ov and ov.get("force"):
        return _override_anchor(ov)

    cands = []
    # 1. direct budget for FY2026 (a DERIVED budget yields to a reported KISA IT figure)
    has_kisa = bool(_facts(research, "kisa_it_investment"))
    for f in _facts(research, "it_budget"):
        if f.get("verification_status") == "DERIVED" and has_kisa:
            continue
        if int(f.get("fiscal_year") or 0) == 2026 and f.get("scope", "").find("그룹") < 0:
            v = _fact_to_eok(f, fx)
            if v is not None:
                return {"method": "DIRECT_IT_BUDGET", "fiscal_year": 2026, "value": v,
                        "fact_status": f.get("verification_status"), "evidence_ids": f.get("evidence_ids", []),
                        "tier": _evidence_tier(research, f.get("evidence_ids", [])),
                        "formula": "TS_2026 = 회사 발표(또는 정보보호 예산÷비율로 파생된) FY2026 IT 예산", "inputs": [_inp("FY2026 IT 예산", v, f)]}

    # 2. KISA IT investment (latest FY)
    for f in _facts(research, "kisa_it_investment"):
        if int(f.get("fiscal_year") or 0) >= 2022:
            v = _fact_to_eok(f, fx)
            if v is not None and v > 0:
                cands.append({"method": "KISA_IT_INVESTMENT", "fiscal_year": int(f["fiscal_year"]), "value": v,
                              "fact_status": f.get("verification_status"), "evidence_ids": f.get("evidence_ids", []),
                              "tier": _evidence_tier(research, f.get("evidence_ids", [])),
                              "formula": f"TS_FY{f['fiscal_year']} = KISA 정보보호 공시 정보기술부문 투자액",
                              "inputs": [_inp("정보기술부문 투자액", v, f)]})
                break

    # 3. KISA security investment scaled by security/IT ratio
    ratios = _facts(research, "kisa_security_ratio")
    for s in _facts(research, "kisa_security_investment"):
        sv = _fact_to_eok(s, fx)
        if not sv or sv <= 0:
            continue
        sy = int(s.get("fiscal_year") or 0)
        same = next((r for r in ratios if int(r.get("fiscal_year") or 0) == sy), None)
        near = sorted(ratios, key=lambda r: abs(int(r.get("fiscal_year") or 0) - sy))
        if same:
            r, basis, method = same, "동일 연도 공시 비율", "KISA_DERIVED"
        elif near:
            r, basis, method = near[0], f"인접 연도(FY{near[0].get('fiscal_year')}) 자사 공시 비율", "KISA_SEC_SCALED"
        else:
            r, basis, method = None, None, "KISA_SEC_SCALED"
        if r is not None:
            rv = D(r["value"]) / Decimal(100) if r.get("unit") == "%" else D(r["value"])
            r_ev, r_assump = r.get("evidence_ids", []), None
        else:
            fb = params.get("_security_ratio_fallback", {}).get(family) or params["security_ratio_fallback"]
            rv, basis, r_ev, r_assump = D(fb["value"]), fb["basis"], fb.get("evidence_ids", []), "B-SECR"
        if rv <= 0:
            continue
        cands.append({"method": method, "fiscal_year": sy, "value": sv / rv,
                      "fact_status": "DERIVED" if method == "KISA_DERIVED" else "ESTIMATED",
                      "evidence_ids": s.get("evidence_ids", []) + r_ev,
                      "tier": max(_evidence_tier(research, s.get("evidence_ids", [])), 2 if r_ev else 3),
                      "formula": f"정보기술부문 투자액 = 정보보호부문 투자액 ÷ 정보보호/IT 비율({basis})",
                      "inputs": [_inp("정보보호부문 투자액", sv, s),
                                 {"name": f"정보보호/IT 비율 — {basis}", "value": str(rv), "unit": "ratio",
                                  "evidence_ids": r_ev, **({"assumption_id": r_assump} if r_assump else {})}]})
        break

    comp = component_anchor(research, aid, family, params, fx) if aid else None
    if cands and comp:
        strong = [c for c in cands if c["method"] in ("KISA_IT_INVESTMENT", "KISA_DERIVED") or
                  (c["method"] == "KISA_SEC_SCALED" and "자사" in c["formula"])]
        if not strong:  # only an industry-ratio security scale-up → definition-consistent VERIFIED components win
            comp["alternatives"] = [{"method": c["method"], "fiscal_year": c["fiscal_year"], "value": str(c["value"])} for c in cands]
            return comp
    if cands:
        # prefer most recent FY; tie → direct KISA IT figure
        order = {"KISA_IT_INVESTMENT": 0, "KISA_DERIVED": 1, "KISA_SEC_SCALED": 2}
        cands.sort(key=lambda c: (-c["fiscal_year"], order[c["method"]]))
        best = cands[0]
        if len(cands) > 1:
            best["alternatives"] = [{"method": c["method"], "fiscal_year": c["fiscal_year"], "value": str(c["value"])} for c in cands[1:]]
        return best

    # 4. account-specific analyst model
    if ov:
        return _override_anchor(ov)

    # 4b. L2 — whitelisted IT cost components
    if comp:
        return comp

    # 4c. L5 — comparable-company estimate via employees × IT spend per employee (empirically calibrated)
    emp_par = params.get("_it_per_employee", {}).get(family)
    if emp_par:
        for f in _facts(research, "employees"):
            if int(f.get("fiscal_year") or 0) >= 2024 and "별도" in (f.get("scope") or "별도"):
                n = D(str(f["value"]).replace(",", ""))
                if n > 0:
                    per = D(str(emp_par["base"]))
                    return {"method": "EMPLOYEE_COMPARABLE", "fiscal_year": int(f["fiscal_year"]), "value": n * per,
                            "fact_status": "ESTIMATED", "evidence_ids": f.get("evidence_ids", []), "tier": 3,
                            "per_employee": [str(emp_par["low"]), str(emp_par["base"]), str(emp_par["high"])], "employees": str(n),
                            "formula": f"TS_FY{f['fiscal_year']} = 직원 수 {int(n):,}명 × 동종 비교기업 1인당 IT 지출 {float(per):.3f}억 (n={emp_par['n']}, B-EMP)",
                            "inputs": [{"name": "직원 수", "value": str(n), "unit": "명", "fiscal_year": f.get("fiscal_year"),
                                        "evidence_ids": f.get("evidence_ids", []), "fact_status": f.get("verification_status")},
                                       {"name": "1인당 IT 지출(비교기업 중앙값)", "value": str(per), "unit": "억원/명", "assumption_id": "B-EMP",
                                        "peers": emp_par.get("peers")}]}

    # 5. intensity fallback (revenue, or SG&A for financial firms whose 영업수익 includes gross trading/interest flows)
    inten = params["it_intensity_fallback"].get(family)
    basis_metric = params.get("intensity_basis", {}).get(family, "revenue")
    if inten:
        metrics = ["sga"] if basis_metric == "sga" else ["revenue", "operating_revenue"]
        for metric in metrics:
            revs = _facts(research, metric)
            revs = sorted(revs, key=lambda f: (int(f.get("fiscal_year") or 0), "별도" in (f.get("scope") or "")), reverse=True)
            for f in revs:
                v = _fact_to_eok(f, fx)
                if v and v > 0:
                    base = D(inten[1])
                    label = "판관비" if metric == "sga" else "매출"
                    return {"method": "REVENUE_INTENSITY", "fiscal_year": int(f["fiscal_year"]), "value": v * base,
                            "fact_status": "ESTIMATED", "evidence_ids": f.get("evidence_ids", []),
                            "tier": 3, "intensity": [str(x) for x in inten], "basis_metric": metric,
                            "formula": f"TS_FY{f['fiscal_year']} = {label}({metric}) × 산업 IT 집약도 {float(base):.4f} (B-INT, Tier 3)",
                            "inputs": [_inp(label, v, f), {"name": f"IT/{label} 집약도(base)", "value": str(base), "unit": "ratio",
                                                          "assumption_id": "B-INT"}]}
    return {"method": "UNKNOWN", "fiscal_year": None, "value": None, "fact_status": "UNKNOWN",
            "evidence_ids": [], "tier": None, "formula": "근거 부족 — 추정 불가", "inputs": []}


def component_anchor(research: dict, aid: str, family: str, params: dict, fx: Decimal) -> dict | None:
    """L2 — IT cost components from audit/annual-report notes (MyDART). Analyst whitelist only
    (config: component_model.accounts) to avoid 연결/별도 duplicates and customer-delivery costs."""
    comp = params.get("component_model") or {}
    spec = comp.get("accounts", {}).get(aid)
    if not spec:
        return None
    facts = {f.get("fact_id"): f for f in research.get("facts", [])}
    lines = [(facts[i], _fact_to_eok(facts[i], fx)) for i in spec["fact_ids"] if i in facts]
    lines = [(f, v) for f, v in lines if v and v > 0]
    if not lines:
        return None
    total = sum(v for _, v in lines)
    cov_spec = comp["coverage"][spec["coverage"]]
    cov = [D(x) for x in cov_spec["values"]]
    fy = max(int(f.get("fiscal_year") or 0) for f, _ in lines)
    return {"method": "AUDIT_IT_COMPONENTS", "fiscal_year": fy, "value": total / cov[1],
            # QA-02: the anchor value itself is reconstructed (Σ items ÷ coverage) → DERIVED; only its inputs may be VERIFIED
            "fact_status": "DERIVED",
            "input_fact_status": "VERIFIED" if all(f.get("verification_status") == "VERIFIED" for f, _ in lines) else "SECONDARY_UNCONFIRMED",
            "evidence_ids": [e for f, _ in lines for e in f.get("evidence_ids", [])],
            "tier": min(_evidence_tier(research, f.get("evidence_ids", [])) for f, _ in lines),
            "component_total": total, "coverage": [str(c) for c in cov], "coverage_basis": cov_spec["basis"],
            "formula": f"TS_FY{fy} = 감사·사업보고서 IT 비용 항목 합계 {float(total):,.1f}억 ÷ 포괄률 {float(cov[1]):.3f} [{spec['coverage']}: {cov_spec['basis']}]",
            "inputs": [_inp(f"IT 비용 항목: {(f.get('analyst_interpretation') or f.get('metric'))[:50]}", v, f) for f, v in lines]
            + [{"name": f"IT 비용 포괄률(base) — {cov_spec['basis']}", "value": str(cov[1]), "unit": "ratio", "assumption_id": "B-COMP"}],
            "note": spec.get("note")}


def _override_anchor(ov: dict) -> dict:
    v = D(ov["value_eok"]) if ov.get("value_eok") is not None else None
    return {"method": "ACCOUNT_SPECIFIC", "fiscal_year": ov.get("fiscal_year"), "value": v,
            "fact_status": ov.get("status", "ESTIMATED"), "evidence_ids": ov.get("evidence_ids", []),
            "tier": ov.get("tier", 3), "formula": ov.get("formula", ""), "inputs": ov.get("inputs", []),
            "definition_note": ov.get("definition_note"), "range_width": ov.get("range_width"),
            "already_fy2026": ov.get("fiscal_year") == 2026}


def _inp(name, v, f):
    return {"name": name, "value": str(v), "unit": "억원", "fiscal_year": f.get("fiscal_year"),
            "scope": f.get("scope"), "evidence_ids": f.get("evidence_ids", []),
            "fact_status": f.get("verification_status")}


def ts_2026(anchor: dict, family: str, params: dict) -> dict:
    """Grow the anchor to FY2026 and attach an uncertainty band."""
    if anchor["value"] is None:
        return {"value": None, "low": None, "high": None, "status": "UNKNOWN"}
    g = params["near_term_growth_2026"].get(family, [0.0, 0.03, 0.06])
    fy = anchor.get("fiscal_year") or 2026
    years = max(0, 2026 - int(fy))
    width = D(anchor.get("range_width") or params["range_width"].get(anchor["method"], 0.4))
    v = anchor["value"]
    base = v * (1 + D(g[1])) ** years
    low = v * (1 + D(g[0])) ** years * (1 - width)
    high = v * (1 + D(g[2])) ** years * (1 + width)
    if anchor["method"] == "AUDIT_IT_COMPONENTS":
        cov = [D(x) for x in anchor["coverage"]]
        low = anchor["component_total"] / cov[0] * (1 + D(g[0])) ** years
        high = anchor["component_total"] / cov[2] * (1 + D(g[2])) ** years
    if anchor["method"] == "EMPLOYEE_COMPARABLE":
        per = [D(x) for x in anchor["per_employee"]]
        n = D(anchor["employees"])
        low, high = n * per[0] * (1 + D(g[0])) ** years, n * per[2] * (1 + D(g[2])) ** years
    if anchor["method"] == "REVENUE_INTENSITY":
        it = [D(x) for x in anchor["intensity"]]
        rev = v / it[1]
        low = rev * it[0] * (1 + D(g[0])) ** years
        high = rev * it[2] * (1 + D(g[2])) ** years
    status = "VERIFIED" if (anchor["method"] == "DIRECT_IT_BUDGET" and anchor.get("fact_status") == "VERIFIED") else \
        "SCENARIO" if anchor.get("fact_status") == "SCENARIO" else "ESTIMATED"  # QA-03: scenario anchors stay SCENARIO
    formula = anchor["formula"] + (f" → × (1+{g[1]})^{years} (B-G26)" if years else "")
    return {"value": base, "low": low, "high": high, "status": status, "growth": g, "years": years, "formula": formula}
