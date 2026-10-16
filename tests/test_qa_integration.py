"""QA re-verification of internal Excel integration — SYNTHETIC data, isolated sandbox (see qa_integration_scenario.py)."""
import json
import os
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def r(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("kai_qa_sandbox")
    env = dict(os.environ, INTERNAL_STORE_DIR=str(tmp / "store"), KAI_DATA_OUT=str(tmp))
    p = subprocess.run([sys.executable, str(ROOT / "tests" / "qa_integration_scenario.py")], cwd=ROOT, env=env,
                       capture_output=True, text=True, timeout=900)
    line = [l for l in p.stdout.splitlines() if l.startswith("RESULT_JSON=")]
    assert line, p.stdout[-2000:] + p.stderr[-3000:]
    return json.loads(line[0][len("RESULT_JSON="):])


def test_pending_rejected_and_empty_selection_do_not_touch_store(r):
    assert r["baseline_internal"] is False
    assert r["pending_status"] == "PENDING_REVIEW"
    empty = {"INTERNAL_ACTUAL": 0, "SALES_ESTIMATE": 0, "MANAGEMENT_TARGET": 0, "APPROVED_ACCOUNT_PLAN": 0}
    assert r["layers_after_preview"] == empty
    assert r["empty_selection_applied"] == 0 and r["layers_after_empty"] == empty
    assert r["layers_after_reject"] == empty
    assert r["reject_approved_blocked"] is True


def test_layers_are_stored_separately(r):
    assert r["layers_after_approve"] == {"INTERNAL_ACTUAL": 2, "SALES_ESTIMATE": 3, "MANAGEMENT_TARGET": 2, "APPROVED_ACCOUNT_PLAN": 1}
    assert r["actual_has_metric_field"] is False and r["sales_has_period_type"] is False
    assert r["target_layer_accounts"] == ["KA03", "KA18"]
    assert r["plan_layer_stored"] == 1


def test_external_estimates_never_overwritten(r):
    assert r["external_unchanged"], r["external_diff"]


def test_conflicts_flagged_for_review_not_overwritten(r):
    assert Decimal(r["kb_cr"]) == 100
    assert r["kb_flags"]["2026|TS"] == "REVIEW_SALES_LOWER"
    assert r["kb_flags"]["2026|RAW"] == "ALIGNED"
    assert r["kb_flags"]["2026|FPR"] == "REVIEW_SALES_HIGHER"
    assert r["kb_flags"]["2031|TS"] == "NO_SALES_INPUT"
    assert r["kb_target_error"] is True  # target > FPR_2031 → ERROR, value kept as entered (not capped)
    assert Decimal(r["kb_target_kept"]) > 0
    assert r["sh_cr_gt_fpr_warn"] is True and any("CR > 외부 FPR" in n for n in r["sh_recon_note"])
    assert r["ka09_no_recon"] and r["ka09_cr_null"]  # untouched accounts keep NULL, never 0
    assert r["contains_internal"] is True


def test_actual_full_year_supersedes_forecast_without_double_count(r):
    assert Decimal(r["kb_cr_after_actual"]) == 120  # not 100 + 120
