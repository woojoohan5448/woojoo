"""Phase 3A reconciliation contract — synthetic-only validation (no internal data, no model change)."""
import copy
import hashlib
import json
from decimal import Decimal
from pathlib import Path

import pytest

from tests.phase3a_synthetic import negative_records, valid_payload
from tools import contract_validate as cv

ROOT = Path(__file__).resolve().parents[1]
DASH = ROOT / "data" / "processed" / "dashboard.json"


@pytest.fixture(scope="module")
def ctx():
    c = cv.load_contract()
    dash = json.loads(DASH.read_text(encoding="utf-8"))
    p = valid_payload()
    return c, dash, p


def test_valid_payload_has_no_errors_and_only_expected_warnings(ctx):
    c, dash, p = ctx
    res = cv.validate(p["records"], c, dash, "test", p["definitions_extra"])
    assert res["errors"] == 0, res["issues"]
    assert sorted(i["code"] for i in res["issues"]) == ["C05_RAW_ADJ_UNBALANCED", "C07_TARGET_ABOVE_FPR"]


@pytest.mark.parametrize("bad", negative_records(), ids=lambda r: r["expect"])
def test_each_negative_record_is_caught(ctx, bad):
    c, dash, p = ctx
    res = cv.validate(p["records"] + [bad], c, dash, "test", p["definitions_extra"])
    assert bad["expect"] in [i["code"] for i in res["issues"]], res["issues"]
    # a record with an ERROR never reaches an official slot
    off = res["official"]
    used = {x["record"] for x in off["TARGET"].values()} | {i for x in off["CR"].values() for i in x["records"]}
    assert bad["record_id"] not in used
    assert off["TARGET"]["KA03"]["value_eok"] == "260"


def test_only_approved_values_feed_official_slots(ctx):
    c, dash, p = ctx
    off = cv.validate(p["records"], c, dash, "test", p["definitions_extra"])["official"]
    assert off["CR"]["KA03"] == {"value_eok": "118.5", "period_type": "ACTUAL_FULL_YEAR", "records": ["S-KA03-011"], "synthetic": True}  # never FORECAST+ACTUAL
    assert off["CR"]["KA14"]["value_eok"] == "55"           # category rows summed only when no account row
    assert "KA29" not in off["CR"]                           # VERIFIED but not approved → excluded, never 0
    assert off["TARGET"]["KA03"]["value_eok"] == "260" and off["TARGET"]["KA03"]["derived_from_case_id"] == "TARGET_CASE_B"
    assert "KA14" not in off["TARGET"]                       # rejected
    excluded = {e["record_id"] for e in off["excluded"]}
    assert {"S-KA03-020", "S-KA03-021", "S-KA03-023", "S-KA29-003"} <= excluded  # target cases / stretch / unapproved


def test_raw_values_preserved_exactly(ctx):
    c, dash, p = ctx
    recs = copy.deepcopy(p["records"])
    before = hashlib.sha256(json.dumps(recs, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    cv.validate(recs, c, dash, "test", p["definitions_extra"])
    assert hashlib.sha256(json.dumps(recs, sort_keys=True, ensure_ascii=False).encode()).hexdigest() == before
    r = next(x for x in recs if x["record_id"] == "S-KA03-010")
    assert r["raw"] == {"value": "12,000", "unit": "백만원", "formula": None} and Decimal(r["value_eok"]) == Decimal("120")
    # RAW reverse-calculation adjustment stays three separate records — unbalanced KA14 is flagged, not repaired
    ka14 = {x["measure_id"]: x["value_eok"] for x in recs if x["account_id"] == "KA14" and x["measure_id"].startswith("INT_RAW")}
    assert ka14 == {"INT_RAW_SOURCE": "1000", "INT_RAW_ADJ": "200", "INT_RAW_ADJUSTED": "1250"}


def test_reconciliation_respects_definition_comparability(ctx):
    c, dash, p = ctx
    rows = {r["record_id"]: r for r in cv.validate(p["records"], c, dash, "test", p["definitions_extra"])["reconciliation"]}
    assert rows["S-KA03-001"]["judgement"] == "NOT_COMPARABLE" and "diff_pct" not in rows["S-KA03-001"]   # SAM definition unknown
    assert rows["S-KA03-004"]["judgement"] == "REFERENCE_ONLY"                                            # internal RAW = proxy until B3
    assert rows["S-KA03-005"]["judgement"] == "ALIGNED"
    assert rows["S-KA29-001"]["judgement"] == "REVIEW_INTERNAL_HIGHER"
    assert rows["S-KA29-002"]["judgement"] == "TARGET_ABOVE_FPR"
    # external side equals the engine value (read-only lookup)
    ka03 = next(a for a in dash["accounts"] if a["account_id"] == "KA03")
    assert Decimal(rows["S-KA03-005"]["external_eok"]) == Decimal(str(ka03["m"]["2026"]["RAW"]["by_cat"]["CONNECTIVITY"])).quantize(Decimal("0.01"))


def test_production_mode_rejects_synthetic(ctx):
    c, dash, p = ctx
    res = cv.validate(p["records"], c, dash, "production", None)
    assert res["errors"] >= len(p["records"]) and "C10_SYNTHETIC_IN_PRODUCTION" in [i["code"] for i in res["issues"]]


def test_evidence_links(ctx):
    c, dash, p = ctx
    ev = copy.deepcopy(p["evidence"])
    assert cv.check_evidence_links(ev["links"], ev["opportunities"], ev["internal_evidence"], dash, c) == []
    ev["opportunities"].append({"opportunity_id": "OPP-X", "account_id": "KA03", "area_id": "Cloud", "fiscal_year": 2031, "case_id": "BASE|BASE_CASE", "presented_as": "CONFIRMED"})
    ev["links"] += [{"link_id": "L9", "opportunity_id": "OPP-X", "evidence_id": "KA01-D02", "role": "CONTEXT"},
                    {"link_id": "L10", "opportunity_id": "OPP-X", "evidence_id": "NOPE", "role": "SUPPORTS"}]
    codes = {i["code"] for i in cv.check_evidence_links(ev["links"], ev["opportunities"], ev["internal_evidence"], dash, c)}
    assert {"C11_SCOPE_MISMATCH", "C11_EVIDENCE_MISSING"} <= codes
    ev["links"] = [l for l in ev["links"] if l["link_id"] != "L10"]
    codes = {i["code"] for i in cv.check_evidence_links(ev["links"], ev["opportunities"], ev["internal_evidence"], dash, c)}
    assert "C11_CONFIRMED_WITHOUT_EVIDENCE" in codes


def test_fixture_file_matches_builder_and_is_synthetic():
    f = json.loads((ROOT / "tests" / "fixtures" / "phase3a_synthetic.json").read_text(encoding="utf-8"))
    assert f["synthetic"] is True and all(r["synthetic"] for r in f["records"])
    assert f["records"] == valid_payload()["records"]
