"""Phase 3A-5 — Opportunity-to-Action: 3 evidence lenses, initiatives, weight sensitivity (engine scores unchanged)."""
import json
from pathlib import Path

from models.strategy_actions import W0, priority_components, score

ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / "data" / "processed" / "dashboard.json").read_text(encoding="utf-8"))
INIT = {i["area"]: i for i in D["initiatives"]}
STRAT = {s["area"]: s for s in D["strategy"]}
BASELINE_SCORES = {"Connectivity": 73.3, "AI Infrastructure": 63.4, "Data Center / IDC": 63.3, "Cloud": 47.2, "Security": 39.6,
                   "AI Transformation / SI": 24.9, "SI / Managed Services": 22.2, "기타": 20.3}


def test_existing_priority_scores_unchanged_and_replica_exact():
    assert {a: s["priority_score"] for a, s in STRAT.items()} == BASELINE_SCORES
    comps = priority_components(D["strategy"])
    assert all(score(comps[a], W0) == BASELINE_SCORES[a] for a in BASELINE_SCORES)
    base = D["priority_sensitivity"]["scenarios"][0]
    assert base["id"] == "BASELINE" and base["scores"] == BASELINE_SCORES
    assert len(D["priority_sensitivity"]["scenarios"]) == 12  # baseline + 5 weights × ±50% + equal


def test_no_auto_approval_and_status_gating():
    assert len(D["initiatives"]) == len(D["strategy"]) == 8
    assert all(i["approval_status"] == "PROPOSED" for i in D["initiatives"])
    assert D["opportunity_flow"]["n_approved"] == 0
    for i in D["initiatives"]:
        L = i["lenses"]
        if L["demand"]["level"] == "INSUFFICIENT":
            assert i["status"] == "ANALYSIS_HYPOTHESIS"
        if i["status"] == "CANDIDATE":
            assert all(l["level"] == "SUFFICIENT" for l in L.values())
        if i["status"] != "CANDIDATE":
            assert "권고" not in i["option"]["label"]
        assert i["why"] and i["gap"] and i["actions"] and i["option"]["label"]
        assert all(a["status"] == "PROPOSED" for a in i["actions"])
        assert set(i["priority"]) >= {"baseline_score", "baseline_rank", "rank_min", "rank_max", "stability"}
        assert i["priority"]["baseline_score"] == STRAT[i["area"]]["priority_score"]


def test_incumbent_observation_and_down_signals_are_not_demand():
    acc = {a["account_id"]: a for a in D["accounts"]}
    for i in D["initiatives"]:
        dem = i["lenses"]["demand"]
        for aid in dem["accounts"]:
            ups = [d for d in acc[aid].get("drivers") or [] if (d.get("direction") or "").upper() not in ("DOWN", "DECREASE")]
            assert ups or acc[aid].get("infra_drivers"), (i["area"], aid)
        for s in dem["signals"]:
            assert s["direction"] not in ("DOWN", "DECREASE")
        assert all(c["direction"] in ("DOWN", "DECREASE") for c in dem["contradicting"])
    sims = INIT["SI / Managed Services"]["lenses"]["demand"]
    assert STRAT["SI / Managed Services"]["evidence"]["n_accounts_incumbent_obs"] == 16 and len(sims["accounts"]) < 5
    assert sims["level"] != "SUFFICIENT"


def test_verification_cases():
    sec, sims = INIT["Security"], INIT["SI / Managed Services"]
    assert sec["verification_case"] and "60%" in sec["verification_case"]["finding"]
    assert any("성장 가정 의존도" in f for f in sec["lenses"]["market"]["flags"])
    assert sec["status"] == "NEEDS_VALIDATION" and sec["lenses"]["demand"]["n_contradicting_accounts"] >= 1
    assert sims["verification_case"] and sims["status"] != "CANDIDATE"
    assert STRAT["Security"]["evidence"]["evidence_level"] == "SUFFICIENT"   # legacy field unchanged (kept for traceability)
