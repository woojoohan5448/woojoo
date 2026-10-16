"""Category decomposition of TS and Realistically Addressable Wallet (RAW)."""
from __future__ import annotations

from decimal import Decimal

from models.common import CATEGORIES, D, D0


def category_mix(family: str, params: dict, override: dict | None, security_ratio: Decimal | None) -> tuple[dict, list[str]]:
    """Return {category: share} summing to 1 and notes on overrides applied."""
    mix = {c: D(params["category_mix"][family].get(c, 0)) for c in CATEGORIES}
    notes = []
    if override and override.get("category_mix"):
        for c, v in override["category_mix"].items():
            mix[c] = D(v)
        notes.append("계정별 카테고리 구성 덮어쓰기(account_overrides)")
    if security_ratio is not None and D0 < security_ratio < Decimal("0.5"):
        rest = sum(v for c, v in mix.items() if c != "SECURITY")
        target_rest = 1 - security_ratio
        for c in mix:
            if c != "SECURITY" and rest > 0:
                mix[c] = mix[c] * target_rest / rest
        mix["SECURITY"] = security_ratio
        notes.append(f"SECURITY 비중을 KISA 공시 정보보호/IT 비율 {security_ratio:.4f}로 대체(나머지 비례 조정)")
    total = sum(mix.values())
    if total > 0:
        mix = {c: v / total for c, v in mix.items()}
    return mix, notes


def split(value: Decimal | None, mix: dict) -> dict | None:
    if value is None:
        return None
    return {c: value * s for c, s in mix.items()}


def addressability_rates(case: str, params: dict, override: dict | None) -> dict:
    rates = {c: D(params["addressability"][case].get(c, 0)) for c in CATEGORIES}
    mods = (override or {}).get("addressability_modifiers", {})
    for c, m in mods.items():
        rates[c] = min(Decimal(1), max(D0, rates[c] * D(m)))
    return rates


def raw(ts_by_cat: dict | None, rates: dict) -> tuple[Decimal | None, dict | None]:
    if ts_by_cat is None:
        return None, None
    by = {c: ts_by_cat[c] * rates[c] for c in ts_by_cat}
    return sum(by.values(), D0), by
