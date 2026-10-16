"""U+ Full Potential Revenue (FPR) = Σ RAW_i × Realistic_Capture_Ceiling_i."""
from __future__ import annotations

from decimal import Decimal

from models.common import CATEGORIES, D, D0


def capture_ceilings(year: str, params: dict, override: dict | None) -> dict:
    caps = {c: D(params["capture_ceiling"][year].get(c, 0)) for c in CATEGORIES}
    mods = (override or {}).get("capture_modifiers", {})
    for c, m in mods.items():
        caps[c] = min(Decimal(1), max(D0, caps[c] * D(m)))
    return caps


def fpr(raw_by_cat: dict | None, caps: dict) -> tuple[Decimal | None, dict | None]:
    if raw_by_cat is None:
        return None, None
    by = {c: raw_by_cat[c] * caps[c] for c in raw_by_cat}
    return sum(by.values(), D0), by
