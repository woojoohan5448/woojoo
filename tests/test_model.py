"""Model integrity tests. Run: cd project && python3 -m pytest -q"""
import csv
import json
from decimal import Decimal

import pytest

from models.build import load_inputs, load_research, model_account, calibrate_intensity, fx
from models.common import CONFIG, PROCESSED, ROOT, to_eok, cagr
from models.validation.checks import validate_account

DASH = json.loads((PROCESSED / "dashboard.json").read_text(encoding="utf-8"))
ACC = {a["account_id"]: a for a in DASH["accounts"]}
TOL = 1e-6


def test_all_53_accounts_present_and_names_unchanged():
    seed = list(csv.DictReader(open(CONFIG / "accounts_seed.csv", encoding="utf-8")))
    assert len(seed) == 53 and len(DASH["accounts"]) == 53
    for r in seed:
        assert ACC[r["account_id"]]["original_name"] == r["original_name"]


def test_hierarchy_invariants_all_years_scenarios_cases():
    for a in DASH["accounts"]:
        m = a["m"]["2026"]
        ts, raw, fpr = m["TS"]["value"], m["RAW"]["value"], m["FPR"]["value"]
        if ts is not None and raw is not None:
            assert raw <= ts + TOL, a["account_id"]
        if raw is not None and fpr is not None:
            assert 0 <= fpr <= raw + TOL, a["account_id"]
        for s, b in a["m"]["2031"].items():
            for case in ("base", "expansion"):
                t, r, f = b["TS"]["value"], b[f"RAW_{case}"]["value"], b[f"FPR_{case}"]["value"]
                if t is not None and r is not None:
                    assert r <= t + TOL, (a["account_id"], s, case)
                if r is not None and f is not None:
                    assert 0 <= f <= r + TOL, (a["account_id"], s, case)
        tgt = a["m"]["target"]["TARGET"]["value"]
        if tgt is not None:
            assert 0 <= tgt <= a["m"]["2031"]["base"]["FPR_base"]["value"] + TOL


def test_current_revenue_null_is_not_zero():
    for a in DASH["accounts"]:
        m = a["m"]["2026"]
        if m["CR"]["value"] is None:
            assert m["CR"]["status"] == "UNKNOWN"
            assert m["CSOW"]["value"] is None and m["PCR"]["value"] is None and m["UPSIDE"]["value"] is None
            assert a["m"]["target"]["UPSIDE_2031"]["value"] is None


def test_unknown_ts_never_filled_with_zero():
    for a in DASH["accounts"]:
        ts = a["m"]["2026"]["TS"]
        assert ts["value"] is None or ts["value"] > 0
        if ts["value"] is None:
            assert ts["status"] == "UNKNOWN" and ts["confidence"] == 0


def test_cagr_matches_definition():
    for a in DASH["accounts"]:
        t0 = a["m"]["2026"]["TS"]["value"]
        for s, b in a["m"]["2031"].items():
            t1, c = b["TS"]["value"], b["TS_CAGR"]["value"]
            if t0 and t1:
                assert abs((t1 / t0) ** 0.2 - 1 - c) < 1e-4


def test_lineage_every_estimate_has_formula_and_source_or_assumption():
    for a in DASH["accounts"]:
        for k, r in a["m"]["2026"].items():
            if r["value"] is not None:
                assert r["formula"], (a["account_id"], k)
                assert r["evidence_ids"] or r["assumption_ids"] or r["inputs"], (a["account_id"], k)


def test_evidence_ids_resolve():
    for a in DASH["accounts"]:
        ev = {e["evidence_id"] for e in a["evidence"]}
        for e in a["m"]["2026"]["TS"]["evidence_ids"]:
            assert e in ev, (a["account_id"], e)


def test_no_test_data_in_production_dataset():
    assert DASH["meta"]["is_test_data"] is False
    assert not any(a["account_id"].startswith("TEST") for a in DASH["accounts"])


def test_no_errors_in_validation():
    assert DASH["issues_summary"]["ERROR"] == 0


def test_corrections_applied():
    codes = [i["message"] for i in ACC["KA03"]["issues"] if i["code"] == "CORRECTION_APPLIED"]
    assert any("COR-001" in m for m in codes)
    assert ACC["KA03"]["anchor"]["method"] == "KISA_IT_INVESTMENT"  # not the 860억 security budget


def test_definition_mismatch_excluded_from_aggregate():
    agg = DASH["portfolio"]["aggregate"]["2026_base"]
    assert "KA08" in agg["excluded"]
    s = sum(a["m"]["2026"]["TS"]["value"] for a in DASH["accounts"]
            if a["m"]["2026"]["TS"]["value"] is not None and a["aggregate_class"] != "DEFINITION_MISMATCH")
    assert abs(s - agg["TS"]) < 1


def test_unit_conversion():
    assert to_eok("469826210000", "원") == Decimal("4698.2621")
    assert to_eok("100", "백만원") == Decimal("1")
    assert to_eok("1.5", "조원") == Decimal("15000")
    assert to_eok("1", "USD_mn", Decimal(1400)) == Decimal("14")
    assert cagr(Decimal(100), Decimal(200)) is not None


@pytest.fixture(scope="module")
def ctx():
    params, seed, overrides, corrections, overlap, strategy, pev, market, mgmt = load_inputs()
    issues = []
    researches = {r["account_id"]: load_research(r["account_id"], corrections, issues) for r in seed}
    params_cal, _ = calibrate_intensity(seed, researches, params, fx(params))
    return params_cal, seed, overrides, researches, pev


def _run(ctx, aid, mgmt_row):
    params, seed, overrides, researches, pev = ctx
    row = next(r for r in seed if r["account_id"] == aid)
    iss = []
    m = model_account(row, researches[aid], overrides.get(aid), params, pev, mgmt_row, fx(params), iss)
    acc = {"account_id": aid, **m}
    return m, validate_account(acc)


def test_synthetic_cr_derivations_TEST_ONLY(ctx):
    """Synthetic management input (clearly fake, never persisted) to exercise C-SOW/PCR/Upside formulas."""
    fake = {"cr_2026_forecast_eok": "50", "cr_basis": "TEST-ONLY synthetic", "target_revenue_2031_eok": ""}
    m, issues = _run(ctx, "KA03", fake)
    m26 = m["m"]["2026"]
    assert m26["CR"]["value"] == Decimal("50")
    assert abs(m26["CSOW"]["value"] - Decimal(50) / m26["RAW"]["value"]) < Decimal("1e-12")
    assert abs(m26["PCR"]["value"] - Decimal(50) / m26["FPR"]["value"]) < Decimal("1e-12")
    assert m26["UPSIDE"]["value"] == m26["FPR"]["value"] - Decimal(50)
    assert not [i for i in issues if i["severity"] == "ERROR"]


def test_cr_above_fpr_raises_warning_not_silent_change_TEST_ONLY(ctx):
    fake = {"cr_2026_forecast_eok": "999999", "cr_basis": "TEST-ONLY", "target_revenue_2031_eok": ""}
    m, issues = _run(ctx, "KA03", fake)
    assert m["m"]["2026"]["CR"]["value"] == Decimal("999999")  # value kept as entered
    assert any(i["code"] == "CR_GT_FPR" for i in issues)


def test_target_above_fpr_is_error_TEST_ONLY(ctx):
    fake = {"cr_2026_forecast_eok": "", "cr_basis": "", "target_revenue_2031_eok": "999999"}
    _, issues = _run(ctx, "KA03", fake)
    assert any(i["code"] == "TARGET_GT_FPR" and i["severity"] == "ERROR" for i in issues)


def test_target_sow_comparison(ctx):
    fake = {"cr_2026_forecast_eok": "10", "cr_basis": "TEST-ONLY", "target_revenue_2031_eok": "5"}
    m, issues = _run(ctx, "KA03", fake)
    tsow, csow = m["m"]["target"]["TARGET_SOW"]["value"], m["m"]["2026"]["CSOW"]["value"]
    if tsow <= csow:
        assert any(i["code"] == "TARGET_SOW_NOT_ABOVE" for i in issues)
