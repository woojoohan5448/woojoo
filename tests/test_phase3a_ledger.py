"""Phase 3A-1 — ledger / official-source selection (synthetic only, sandboxed store; engine values unchanged)."""
import copy
import hashlib
import json
from pathlib import Path

import pytest

from models.recon import ledger as L
from tests.phase3a_synthetic import H_APPROVED, rec, valid_payload

ROOT = Path(__file__).resolve().parents[1]
DASH = json.loads((ROOT / "data" / "processed" / "dashboard.json").read_text(encoding="utf-8"))
REQ = ("key", "value_eok", "official_source", "base_year", "data_status", "approval_status", "evidence_ids")


def _sel(sid, slot, fy, case, record_id, status="APPROVED", decided="synth.decider", approved="synth.cfo", acc="KA03"):
    return {"selection_id": sid, "account_id": acc, "slot": slot, "fiscal_year": fy, "case_id": case, "record_id": record_id,
            "status": status, "decided_by": decided, "approved_by": approved, "reason": "SYNTH", "synthetic": True}


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.setenv("INTERNAL_STORE_DIR", str(tmp_path))
    (tmp_path / "recon").mkdir()
    return tmp_path / "recon"


def _write(store, records, selections, extra):
    (store / "records.json").write_text(json.dumps({"records": records, "definitions_extra": extra}, ensure_ascii=False), encoding="utf-8")
    (store / "selections.json").write_text(json.dumps({"selections": selections}, ensure_ascii=False), encoding="utf-8")


def test_empty_store_keeps_external_defaults_and_full_provenance(store):
    blk = L.build_block(DASH["accounts"], "TEST", mode="production")
    assert blk["n_internal_records"] == 0 and blk["n_switched"] == 0 and not blk["contains_synthetic"]
    n = 0
    for a in DASH["accounts"]:
        led = {e["key"]: e for e in blk["accounts"][a["account_id"]]["ledger"]}
        assert len(led) == 3 * 7 + 2
        for slot in ("TS", "RAW", "FPR"):
            for fy, cases in ((2026, ["BASE|BASE_CASE"]), (2031, L.EXT_CASES)):
                for case in cases:
                    e = led[f"{slot}|{fy}|{case}"]
                    assert all(k in e for k in REQ)
                    assert e["value_eok"] == L._metric(a, slot, fy, case)["value"]   # exact engine value
                    assert e["official_source"] == "EXTERNAL_MODEL"
                    assert e["approval_status"] in ("MODEL_DEFAULT", "RESEARCH_GAP")
                    n += 1
        assert led["TARGET|2031|APPROVED"]["approval_status"] == "NOT_PROVIDED" and led["TARGET|2031|APPROVED"]["value_eok"] is None
        assert led["CR|2026|ACTUAL"]["value_eok"] is None   # never 0
    assert n == 53 * 21


def test_no_approved_target_is_generated():
    assert all(a["m"]["target"]["TARGET"].get("target_source") != "MANAGEMENT_APPROVED" for a in DASH["accounts"])
    assert DASH["portfolio"]["aggregate"]["2031_base"]["TARGET"] is None
    assert DASH["recon"]["n_switched"] == 0 and DASH["recon"]["n_internal_records"] == 0


def _payload_with_direct_account_raw():
    p = valid_payload()
    r = rec("S-KA03-006", "KA03", "INT_RAW_ADJUSTED", 2026, "1,010", "억원", "1010", definition="DEF_SYNTH_RAW_DIRECT", version=2, history=H_APPROVED)
    return p, p["records"] + [r]


def test_switch_only_when_every_requirement_met(store):
    p, records = _payload_with_direct_account_raw()
    sels = [
        _sel("SEL-OK", "RAW", 2026, "BASE|BASE_CASE", "S-KA03-006"),
        _sel("SEL-UNAPPROVED", "RAW", 2031, "BASE|BASE_CASE", "S-KA03-006", status="VERIFIED", approved=None),
        _sel("SEL-SOD", "RAW", 2031, "HIGH|BASE_CASE", "S-KA03-006", decided="synth.cfo"),
        _sel("SEL-PROXY", "RAW", 2031, "LOW|BASE_CASE", "S-KA03-004"),          # PROXY definition, VERIFIED only
        _sel("SEL-FPR", "FPR", 2026, "BASE|BASE_CASE", "S-KA03-006"),           # FPR has no internal candidate
    ]
    raw_before = copy.deepcopy(records)
    _write(store, records, sels, p["definitions_extra"])
    h = hashlib.sha256((store / "records.json").read_bytes()).hexdigest()
    blk = L.build_block(DASH["accounts"], "TEST", mode="test")
    audit = {x["selection_id"]: x for x in blk["selection_audit"]}
    assert audit["SEL-OK"]["applied"] and blk["n_switched"] == 1
    assert "SELECTION_APPROVED" in audit["SEL-UNAPPROVED"]["unmet"]
    assert "SELECTION_SOD" in audit["SEL-SOD"]["unmet"]
    assert {"RECORD_APPROVED", "DEFINITION_DIRECT"} <= set(audit["SEL-PROXY"]["unmet"])
    assert "MEASURE_NOT_CANDIDATE" in audit["SEL-FPR"]["unmet"]
    led = {e["key"]: e for e in blk["accounts"]["KA03"]["ledger"]}
    ka03 = next(a for a in DASH["accounts"] if a["account_id"] == "KA03")
    sw = led["RAW|2026|BASE|BASE_CASE"]
    assert sw["official_source"] == "INTERNAL_APPROVED" and sw["value_eok"] == 1010.0 and sw["selection_id"] == "SEL-OK"
    assert sw["replaced_external_value"] == ka03["m"]["2026"]["RAW"]["value"]
    assert led["RAW|2031|BASE|BASE_CASE"]["official_source"] == "EXTERNAL_MODEL"
    assert all(e["official_source"] == "EXTERNAL_MODEL" for k, e in led.items() if k.startswith(("TS|", "FPR|")))
    # raw store untouched, engine values untouched
    assert hashlib.sha256((store / "records.json").read_bytes()).hexdigest() == h and records == raw_before


def test_production_mode_never_switches_on_synthetic(store):
    p, records = _payload_with_direct_account_raw()
    _write(store, records, [_sel("SEL-OK", "RAW", 2026, "BASE|BASE_CASE", "S-KA03-006")], {})
    blk = L.build_block(DASH["accounts"], "TEST", mode="production")
    assert blk["n_switched"] == 0
    assert "C10_SYNTHETIC_IN_PRODUCTION" in {i["code"] for i in blk["issues"]}
    assert not blk["selection_audit"][0]["applied"] and "RECORD_MISSING_OR_QUARANTINED" in blk["selection_audit"][0]["unmet"]


def test_internal_records_visible_with_status_and_quarantine(store):
    p, records = _payload_with_direct_account_raw()
    bad = rec("N-XX", "KA03", "ACTUAL_REVENUE", 2026, "123.456", "억원", "123.46", period="FORECAST", case="ACTUAL", version=9)
    _write(store, records + [bad], [], p["definitions_extra"])
    blk = L.build_block(DASH["accounts"], "TEST", mode="test")
    rows = {r["record_id"]: r for r in blk["accounts"]["KA03"]["internal"]}
    assert rows["N-XX"]["quarantined"] and not rows["S-KA03-011"]["quarantined"]
    assert rows["S-KA03-010"]["raw"] == {"value": "12,000", "unit": "백만원", "formula": None}
    assert blk["contains_synthetic"]
    assert {r["judgement"] for r in blk["accounts"]["KA03"]["recon_rows"]} >= {"NOT_COMPARABLE", "REFERENCE_ONLY", "ALIGNED", "WITHIN_FPR"}


def test_corrupt_store_keeps_defaults_and_reports(store):
    (store / "records.json").write_text("{not json", encoding="utf-8")
    blk = L.build_block(DASH["accounts"], "TEST", mode="production")
    assert blk["store_error"] and blk["n_switched"] == 0 and blk["n_internal_records"] == 0
    assert all(e["official_source"] == "EXTERNAL_MODEL" for e in blk["accounts"]["KA03"]["ledger"] if e["key"].startswith(("TS|", "RAW|", "FPR|")))
