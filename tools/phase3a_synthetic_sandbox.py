"""Write a TEST-ONLY synthetic reconciliation store (records + selections) into a sandbox directory.

Never touches data/internal_store. Use with KAI_DATA_OUT / INTERNAL_STORE_DIR / KAI_RECON_MODE=test:
  python3 tools/phase3a_synthetic_sandbox.py <store_dir>
  INTERNAL_STORE_DIR=<store_dir> KAI_DATA_OUT=<out_dir> KAI_RECON_MODE=test python3 -m models.build
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tests.phase3a_synthetic import H_APPROVED, rec, valid_payload  # noqa: E402


def main(store: str):
    d = Path(store).resolve()
    if d == (ROOT / "data" / "internal_store").resolve() or (ROOT / "data" / "internal_store").resolve() in d.parents:
        raise SystemExit("refusing to write synthetic data into the real internal store")
    (d / "recon").mkdir(parents=True, exist_ok=True)
    p = valid_payload()
    records = p["records"] + [
        rec("S-KA03-006", "KA03", "INT_RAW_ADJUSTED", 2026, "1,010", "억원", "1010", definition="DEF_SYNTH_RAW_DIRECT", version=2, history=H_APPROVED),
        rec("N-Q01", "KA03", "ACTUAL_REVENUE", 2026, "123.456", "억원", "123.46", period="FORECAST", case="ACTUAL", version=9),  # quarantined (rounded)
    ]
    sels = [{"selection_id": "SEL-SYNTH-001", "account_id": "KA03", "slot": "RAW", "fiscal_year": 2026, "case_id": "BASE|BASE_CASE",
             "record_id": "S-KA03-006", "status": "APPROVED", "decided_by": "synth.decider", "approved_by": "synth.cfo", "reason": "SYNTH", "synthetic": True},
            {"selection_id": "SEL-SYNTH-002", "account_id": "KA03", "slot": "RAW", "fiscal_year": 2031, "case_id": "BASE|BASE_CASE",
             "record_id": "S-KA03-004", "status": "APPROVED", "decided_by": "synth.decider", "approved_by": "synth.cfo", "reason": "SYNTH (PROXY → blocked)", "synthetic": True}]
    (d / "recon" / "records.json").write_text(json.dumps({"synthetic": True, "records": records, "definitions_extra": p["definitions_extra"]}, ensure_ascii=False, indent=1), encoding="utf-8")
    (d / "recon" / "selections.json").write_text(json.dumps({"synthetic": True, "selections": sels}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(d, len(records), "records,", len(sels), "selections (synthetic)")


if __name__ == "__main__":
    main(sys.argv[1])
