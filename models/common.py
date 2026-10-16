"""Shared utilities: Decimal money handling, unit normalisation, loaders."""
from __future__ import annotations

import csv
import json
from decimal import Decimal, ROUND_HALF_UP, getcontext
from pathlib import Path

getcontext().prec = 28

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config"
RAW_RESEARCH = ROOT / "data" / "raw" / "research"
INTERNAL = ROOT / "data" / "internal_inputs"
PROCESSED = ROOT / "data" / "processed"
EXPORTS = ROOT / "data" / "exports"

STATUSES = ("VERIFIED", "DERIVED", "ESTIMATED", "SCENARIO", "UNKNOWN")
SCENARIOS = ("low", "base", "high")
CATEGORIES = ("CONNECTIVITY", "DC_COLO", "CLOUD", "AI_INFRA", "SECURITY", "SI_BUILD",
              "IT_OPS", "SW_LICENSE", "HW_DEVICE", "INTERNAL_LABOR")

D0 = Decimal("0")


def D(x) -> Decimal:
    if isinstance(x, Decimal):
        return x
    if x is None:
        raise ValueError("None is not a number")
    return Decimal(str(x).replace(",", "").strip())


def q2(x: Decimal) -> Decimal:
    return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# Conversion factors into 억원 (KRW 1e8).
UNIT_TO_EOK = {
    "원": Decimal("1e-8"), "KRW": Decimal("1e-8"),
    "천원": Decimal("1e-5"),
    "백만원": Decimal("0.01"),
    "십억원": Decimal("10"),
    "억원": Decimal("1"),
    "조원": Decimal("10000"),
}


def to_eok(value, unit: str, fx_usd_krw: Decimal | None = None) -> Decimal | None:
    """Normalise a monetary value to 억원. Returns None for non-monetary units."""
    unit = (unit or "").strip()
    v = D(value)
    if unit in UNIT_TO_EOK:
        return v * UNIT_TO_EOK[unit]
    if unit in ("USD_mn", "USD mn", "백만달러"):
        if fx_usd_krw is None:
            raise ValueError("FX required for USD")
        return v * Decimal("1e6") * fx_usd_krw / Decimal("1e8")
    if unit in ("USD", "달러"):
        if fx_usd_krw is None:
            raise ValueError("FX required for USD")
        return v * fx_usd_krw / Decimal("1e8")
    if unit in ("USD_bn", "십억달러"):
        if fx_usd_krw is None:
            raise ValueError("FX required for USD")
        return v * Decimal("1e9") * fx_usd_krw / Decimal("1e8")
    return None


def load_json(path: Path, default=None):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def cagr(v0: Decimal | None, v1: Decimal | None, years: int = 5) -> Decimal | None:
    if v0 is None or v1 is None or v0 <= 0 or v1 <= 0:
        return None
    return D(float(v1 / v0) ** (1.0 / years) - 1.0)


def safe_div(a: Decimal | None, b: Decimal | None) -> Decimal | None:
    if a is None or b is None or b == 0:
        return None
    return a / b
