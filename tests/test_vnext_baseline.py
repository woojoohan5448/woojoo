"""vNext regression guard: the 53-account metric values frozen before Phase 1 (tests/fixtures/vnext_baseline.json)
must not change unintentionally. Intended, approved changes are whitelisted explicitly below."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = json.loads((ROOT / "tests" / "fixtures" / "vnext_baseline.json").read_text(encoding="utf-8"))
DASH = json.loads((ROOT / "data" / "processed" / "dashboard.json").read_text(encoding="utf-8"))

# Approved intentional changes (vNext Phase 1, decision D1): official 2031 Target sum counts MANAGEMENT_APPROVED
# targets only; the FPR×attainment scenario sum moves to TARGET_scenario. Per-account scenario values are unchanged.
INTENDED = {"portfolio_aggregate.TARGET": "D1"}


def snap(a):
    m, r = a["m"], {}
    for k in ("TS", "RAW", "FPR", "CR", "CSOW", "PCR", "UPSIDE"):
        x = m["2026"][k]
        r[f"2026|{k}"] = [x["value"], x.get("low"), x.get("high"), x["status"], x.get("grade"), x["confidence"], x["formula"]]
    for s in ("low", "base", "high"):
        for k in ("TS", "RAW_base", "RAW_expansion", "FPR_base", "FPR_expansion"):
            x = m["2031"][s][k]
            r[f"2031|{s}|{k}"] = [x["value"], x.get("low"), x.get("high"), x["status"], x.get("grade"), x["confidence"], x["formula"]]
    for k in ("TARGET", "TARGET_SOW"):
        x = m["target"][k]
        r[f"target|{k}"] = [x["value"], x["status"], x["formula"]]
    return r


def test_account_metrics_unchanged():
    cur = {a["account_id"]: snap(a) for a in DASH["accounts"]}
    assert set(cur) == set(BASE["accounts"])
    diffs = [(aid, k) for aid, rows in BASE["accounts"].items() for k, v in rows.items() if cur[aid][k] != v]
    assert diffs == [], diffs[:10]


def test_portfolio_aggregate_unchanged_except_d1():
    for key, b in BASE["portfolio_aggregate"].items():
        c = DASH["portfolio"]["aggregate"][key]
        for k, v in b.items():
            if k == "TARGET":
                # D1: approved-only official sum; scenario sum preserved separately
                assert c["TARGET"] is None and c["n_target_approved"] == 0
                if key == "2031_base":
                    assert abs(c["TARGET_scenario"] - v) < 0.01
                continue
            assert c[k] == v, (key, k)


def test_strategy_engine_outputs_unchanged():
    cur = {s["area"]: s for s in DASH["strategy"]}
    for b in BASE["strategy"]:
        c = cur[b["area"]]
        for k, v in b.items():
            assert c[k] == v, (b["area"], k)


def test_target_source_is_explicit():
    srcs = {a["m"]["target"]["TARGET"].get("target_source") for a in DASH["accounts"] if a["m"]["target"]["TARGET"]["value"] is not None}
    assert srcs <= {"MANAGEMENT_APPROVED", "SCENARIO_FPR_ATTAINMENT"}
