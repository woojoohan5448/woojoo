"""Driver-based FY2026 → FY2031 TS bridge.

TS_2031 = TS_2026 + Organic + Digital/Cloud + AI + Infra + Regulatory − Efficiency − Substitution (± Other)
Bridge ratios (B-BRIDGE) are 5-year cumulative shares of TS_2026, except organic (annual CAGR).
Account-specific infra drivers (announced DC/AI builds) are passed in as annualised 억원 amounts.
"""
from __future__ import annotations

from decimal import Decimal

from models.common import CATEGORIES, D, D0

IDX = {"low": 0, "base": 1, "high": 2}


def bridge(ts26_by_cat: dict, family: str, scenario: str, params: dict, infra_eok: Decimal = D0,
           other_eok: Decimal = D0, bridge_override: dict | None = None) -> dict:
    p = dict(params["forecast_bridge"][family])
    if bridge_override:
        p.update(bridge_override)
    i = IDX[scenario]
    ts26 = sum(ts26_by_cat.values(), D0)
    g = D(p["organic_cagr"][i])
    comp = {
        "organic": ts26 * ((1 + g) ** 5 - 1),
        "cloud": ts26 * D(p["cloud"][i]),
        "ai": ts26 * D(p["ai"][i]),
        "infra": D(infra_eok),
        "regulatory": ts26 * D(p["regulatory"][i]),
        "efficiency": -ts26 * D(p["efficiency"][i]),
        "substitution": -ts26 * D(p["substitution"][i]),
        "other": D(other_eok),
    }
    alloc = params["increment_allocation"]
    by = {c: ts26_by_cat[c] * (1 + g) ** 5 for c in CATEGORIES}
    for key in ("cloud", "ai", "infra", "regulatory", "efficiency", "substitution"):
        amt = comp[key]
        for c, share in alloc[key].items():
            by[c] += amt * D(share)
    # 'other' is spread pro rata to the 2026 mix
    if comp["other"] and ts26 > 0:
        for c in CATEGORIES:
            by[c] += comp["other"] * ts26_by_cat[c] / ts26
    # floor at zero per category (efficiency could overshoot a tiny category); record the clamp
    clamped = [c for c in CATEGORIES if by[c] < 0]
    for c in clamped:
        by[c] = D0
    total = sum(by.values(), D0)
    return {"total": total, "by_cat": by, "components": comp, "organic_cagr": g, "clamped": clamped,
            "params": {k: p[k][i] for k in ("organic_cagr", "cloud", "ai", "regulatory", "efficiency", "substitution")}}
