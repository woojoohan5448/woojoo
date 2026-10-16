"""Phase 3/4 import → approval → recalculation tests on SYNTHETIC data in an isolated sandbox."""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def scenario(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("kai_sandbox")
    env = dict(os.environ, INTERNAL_STORE_DIR=str(tmp / "store"), KAI_DATA_OUT=str(tmp))
    p = subprocess.run([sys.executable, str(ROOT / "tests" / "internal_import_scenario.py")], cwd=ROOT, env=env,
                       capture_output=True, text=True, timeout=600)
    line = [l for l in p.stdout.splitlines() if l.startswith("RESULT_JSON=")]
    assert line, p.stdout[-2000:] + p.stderr[-3000:]
    return json.loads(line[0][len("RESULT_JSON="):]), tmp


def test_mapping_units_and_validation(scenario):
    r, _ = scenario
    assert r["kb_mapped"]["status"] == "MAPPED" and r["kb_mapped"]["account_id"] == "KA03"
    assert r["kb_value_eok"] == "200.00"  # 20,000 백만원 → 200억
    assert r["bad_unit_err"] is True
    assert r["toss_status"] in ("AMBIGUOUS", "UNMAPPED")  # '토스' matches several Toss entities → never auto-mapped
    assert r["b1_summary"]["invalid"] >= 2


def test_versioning_and_diff(scenario):
    r, _ = scenario
    assert r["b2_diff"]["type"] == "CHANGED" and r["b2_diff"]["old_value_eok"] == "200.00"
    assert r["history_len"] >= 1


def test_recalculation_and_reconciliation(scenario):
    r, _ = scenario
    assert r["kb_cr"] == "250.00" or r["kb_cr"].startswith("250")
    assert r["kb_csow_ok"] and r["kb_upside_ok"]
    assert r["kb_target"].startswith("300")
    assert r["kb_recon_flags"]["2026|TS"] == "REVIEW_SALES_HIGHER"
    assert r["ka09_target_error"] is True  # target > FPR is flagged, not silently capped
    assert r["contains_internal"] is True
    assert r["kb_na_cr"] in ("VERIFIED", "DERIVED")


def test_api_import_flow(scenario):
    r, _ = scenario
    assert r["api_reupload_diff"] == "UNCHANGED"
    assert r["api_preview_diff"] == "CHANGED"
    assert abs(r["api_dash_kb_cr"] - 270) < 0.01  # dashboard refreshed after approval
    assert r["api_approve_status"] == 200
    assert r["api_dash_internal"] is True
    assert r["api_reject_unknown"] == 422


def test_production_outputs_untouched():
    d = json.loads((ROOT / "data" / "processed" / "dashboard.json").read_text(encoding="utf-8"))
    assert d["meta"]["contains_internal_data"] is False
    assert not (ROOT / "data" / "internal_store" / "INTERNAL_ACTUAL.json").exists()
