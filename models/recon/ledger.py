"""Phase 3A — metric ledger and official-source selection (additive; engine values unchanged).

Ledger  : every value the dashboard can show, with source, base year, scenario/case, data status, approval status
          and evidence IDs. External values are read from the built account (engine output) — never recomputed.
Internal: canonical contract records from INTERNAL_STORE_DIR/recon/records.json (JSON only; no Excel import here).
          Raw records are immutable; the validator quarantines anything that breaks the contract.
Official: per account × slot × year × case. Default source per config/official_source_policy.json. A slot switches
          to an internal value ONLY when an approved selection decision (INTERNAL_STORE_DIR/recon/selections.json,
          stored separately from raw records) satisfies every switch requirement. No automatic switching.
"""
from __future__ import annotations

import json
import os
from decimal import Decimal
from pathlib import Path

from models.recon import contract as C

ROOT = Path(__file__).resolve().parents[2]
POLICY_PATH = ROOT / "config" / "official_source_policy.json"
EXT_CASES = [f"{s}|{c}" for s in ("LOW", "BASE", "HIGH") for c in ("BASE_CASE", "STRATEGIC_EXPANSION")]
SLOT_KEY = {"TS": ("TS", "TS"), "RAW": ("RAW", "RAW_base", "RAW_expansion"), "FPR": ("FPR", "FPR_base", "FPR_expansion")}


def store_dir() -> Path:
    return Path(os.environ.get("INTERNAL_STORE_DIR", ROOT / "data" / "internal_store")) / "recon"


def load_policy() -> dict:
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))


def load_internal() -> tuple[list[dict], list[dict], dict]:
    """(records, selections, definitions_extra). Missing store → empty (normal state before Phase 3B)."""
    d = store_dir()
    rec = json.loads((d / "records.json").read_text(encoding="utf-8")) if (d / "records.json").exists() else {}
    sel = json.loads((d / "selections.json").read_text(encoding="utf-8")) if (d / "selections.json").exists() else {}
    return rec.get("records", []), sel.get("selections", []), rec.get("definitions_extra") or {}


def _ev(rec: dict) -> list[str]:
    ids = list(rec.get("evidence_ids") or [])
    for i in rec.get("inputs") or []:
        for e in i.get("evidence_ids") or []:
            if e not in ids:
                ids.append(e)
    return ids


def _metric(acc: dict, slot: str, fy: int, case: str | None) -> dict:
    if fy == 2026:
        return acc["m"]["2026"][slot]
    scen, c = case.split("|")
    b = acc["m"]["2031"][scen.lower()]
    if slot == "TS":
        return b["TS"]
    return b[f"{slot}_{'base' if c == 'BASE_CASE' else 'expansion'}"]


def external_ledger(acc: dict, data_version: str) -> list[dict]:
    """Ledger entries for the external model + the engine's CR/Target slots of one account."""
    base_year = (acc.get("anchor") or {}).get("fiscal_year")
    out = []
    for slot in ("TS", "RAW", "FPR"):
        for fy, cases in ((2026, ["BASE|BASE_CASE"]), (2031, EXT_CASES)):
            for case in cases:
                r = _metric(acc, slot, fy, case)
                out.append({"key": f"{slot}|{fy}|{case}", "slot": slot, "fiscal_year": fy, "case_id": case,
                            "value_eok": r.get("value"), "source": "EXTERNAL_MODEL", "source_ref": f"ENGINE:{data_version}:{acc['account_id']}",
                            "source_hash": acc.get("source_hash"), "base_year": base_year, "data_status": r.get("status"),
                            "approval_status": "MODEL_DEFAULT" if r.get("value") is not None else "RESEARCH_GAP",
                            "evidence_ids": _ev(r), "assumption_ids": list(r.get("assumption_ids") or []), "formula": r.get("formula")})
    cr = acc["m"]["2026"]["CR"]
    out.append({"key": "CR|2026|ACTUAL", "slot": "CR", "fiscal_year": 2026, "case_id": "ACTUAL", "value_eok": cr.get("value"),
                "source": "INTERNAL_APPROVED" if cr.get("value") is not None else None, "source_ref": cr.get("formula"),
                "base_year": 2026, "data_status": cr.get("status"),
                "approval_status": "APPROVED" if cr.get("value") is not None else "NOT_PROVIDED", "evidence_ids": _ev(cr), "assumption_ids": [], "formula": cr.get("formula")})
    t = acc["m"]["target"]["TARGET"]
    approved = t.get("target_source") == "MANAGEMENT_APPROVED"
    out.append({"key": "TARGET|2031|APPROVED", "slot": "TARGET", "fiscal_year": 2031, "case_id": "APPROVED",
                "value_eok": t.get("value") if approved else None, "source": "INTERNAL_APPROVED" if approved else None,
                "source_ref": t.get("formula") if approved else None, "base_year": 2031, "data_status": t.get("status") if approved else None,
                "approval_status": "APPROVED" if approved else "NOT_PROVIDED", "evidence_ids": _ev(t) if approved else [],
                "assumption_ids": [], "formula": t.get("formula") if approved else None,
                "scenario_reference": None if approved else {"value_eok": t.get("value"), "status": t.get("status"), "note": "시나리오 목표(참고값) — 공식 아님(D1)"}})
    return out


def _switch_check(sel: dict, rec: dict | None, defs: dict, policy: dict, mode: str, quarantined: set) -> list[str]:
    """Return the list of unmet switch requirements (empty → switch allowed)."""
    unmet = []
    slot = policy["slots"].get(sel.get("slot"), {})
    if rec is None or rec["record_id"] in quarantined:
        return ["RECORD_MISSING_OR_QUARANTINED"]
    if rec["status"] != "APPROVED":
        unmet.append("RECORD_APPROVED")
    if rec["measure_id"] not in slot.get("internal_candidates", []):
        unmet.append("MEASURE_NOT_CANDIDATE")
    d = defs.get(rec["definition_ref"], {})
    if d.get("comparability") != "DIRECT" or d.get("compare_to") != slot.get("external_measure"):
        unmet.append("DEFINITION_DIRECT")
    if sel.get("status") != "APPROVED" or not sel.get("approved_by"):
        unmet.append("SELECTION_APPROVED")
    if sel.get("approved_by") in (sel.get("decided_by"), rec["source"].get("uploaded_by")):
        unmet.append("SELECTION_SOD")
    if (rec["account_id"], rec["fiscal_year"], rec["area_level"]) != (sel.get("account_id"), sel.get("fiscal_year"), "ACCOUNT"):
        unmet.append("SCOPE_MATCH")
    if mode == "production" and (rec.get("synthetic") or sel.get("synthetic")):
        unmet.append("NOT_SYNTHETIC_IN_PRODUCTION")
    return unmet


def resolve_official(ledger: list[dict], records: list[dict], selections: list[dict], defs: dict, policy: dict,
                     mode: str, quarantined: set) -> tuple[list[dict], list[dict]]:
    """Official view = ledger with default sources, except slots whose approved selection passes every check.
    Returns (official_entries, selection_audit). Ledger entries are not mutated."""
    by_id = {r["record_id"]: r for r in records}
    official = [dict(e, official_source=e["source"], selection_id=None) for e in ledger]
    idx = {e["key"]: e for e in official}
    audit = []
    for s in selections:
        rec = by_id.get(s.get("record_id"))
        unmet = _switch_check(s, rec, defs, policy, mode, quarantined)
        key = f"{s.get('slot')}|{s.get('fiscal_year')}|{s.get('case_id')}"
        target = idx.get(key) if s.get("account_id") == (rec or {}).get("account_id") else None
        if target is None:
            unmet = unmet + ["SLOT_NOT_FOUND"]
        audit.append({"selection_id": s.get("selection_id"), "account_id": s.get("account_id"), "slot_key": key,
                      "record_id": s.get("record_id"), "applied": not unmet, "unmet": unmet, "synthetic": bool(s.get("synthetic"))})
        if unmet:
            continue
        target.update({"value_eok": float(Decimal(rec["value_eok"])), "official_source": "INTERNAL_APPROVED", "selection_id": s["selection_id"],
                       "source_ref": rec["source"]["source_id"], "base_year": rec["fiscal_year"], "data_status": "INTERNAL",
                       "approval_status": "APPROVED", "evidence_ids": [rec["record_id"]], "replaced_external_value": target["value_eok"],
                       "synthetic": bool(rec.get("synthetic"))})
    return official, audit


def build_block(accounts: list[dict], data_version: str, mode: str | None = None) -> dict:
    """Additive dashboard block. With an empty internal store every slot keeps its default source."""
    mode = mode or os.environ.get("KAI_RECON_MODE", "production")
    policy, contract = load_policy(), C.load_contract()
    store_error = None
    try:
        records, selections, extra = load_internal()
    except Exception as e:  # corrupt store → never silently mix; defaults stay, error surfaced
        records, selections, extra, store_error = [], [], {}, f"{type(e).__name__}: {e}"
    defs = {**contract["definitions"], **extra}
    # the validator needs the external model for reconciliation rows — pass a minimal dashboard view
    dash = {"accounts": [{"account_id": a["account_id"], "m": a["m"], "area_evidence": a.get("area_evidence")} for a in accounts]}
    res = C.validate(records, contract, dash, mode, extra if extra else None) if records else \
        {"issues": [], "quarantined": [], "official": {}, "reconciliation": [], "errors": 0, "warnings": 0}
    quarantined = set(res.get("quarantined", []))
    accs = {}
    audit_all = []
    for a in accounts:
        aid = a["account_id"]
        led = external_ledger(a, data_version)
        mine_rec = [r for r in records if r.get("account_id") == aid]
        mine_sel = [s for s in selections if s.get("account_id") == aid]
        official, audit = resolve_official(led, mine_rec, mine_sel, defs, policy, mode, quarantined)
        audit_all += audit
        accs[aid] = {
            # compact ledger: one row per slot×year×case (values already in m.* — kept here with full provenance)
            "engine_ref": f"ENGINE:{data_version}:{aid}", "source_hash": a.get("source_hash"),
            "ledger": [{k: e[k] for k in ("key", "value_eok", "official_source", "base_year", "data_status", "approval_status",
                                          "evidence_ids", "selection_id") if k in e}
                       | ({"source_ref": e["source_ref"]} if e.get("source_ref") and e["official_source"] != "EXTERNAL_MODEL" else {})
                       | ({"replaced_external_value": e["replaced_external_value"]} if e.get("replaced_external_value") is not None else {})
                       | ({"scenario_reference": e["scenario_reference"]} if e.get("scenario_reference") else {}) for e in official],
            "internal": [{k: r.get(k) for k in ("record_id", "measure_id", "area_level", "area_id", "fiscal_year", "period_type", "case_id",
                                                 "value_eok", "raw", "status", "definition_ref", "synthetic")} | {"source_id": r["source"].get("source_id"),
                          "as_of": r["source"].get("as_of"), "version": r["source"].get("version"), "quarantined": r["record_id"] in quarantined}
                         for r in mine_rec],
            "recon_rows": [x for x in res.get("reconciliation", []) if x["account_id"] == aid],
        }
    return {
        "contract_version": contract["version"], "policy_version": policy["version"], "mode": mode,
        "policy": {k: {kk: v.get(kk) for kk in ("default_source", "internal_candidates", "fallback", "pending")} for k, v in policy["slots"].items()},
        "switch_requirements": policy["switch_requirements"],
        "store_error": store_error, "n_internal_records": len(records), "n_selections": len(selections),
        "n_switched": sum(1 for x in audit_all if x["applied"]), "selection_audit": audit_all,
        "contains_synthetic": any(r.get("synthetic") for r in records) or any(s.get("synthetic") for s in selections),
        "issues": res.get("issues", []), "quarantined": sorted(quarantined),
        "official_internal": res.get("official", {}),
        "accounts": accs,
    }
