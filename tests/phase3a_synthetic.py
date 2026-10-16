"""TEST-ONLY synthetic records for the Phase 3A reconciliation contract.

Every value here is FABRICATED (synthetic=true) to exercise contract rules — it is not internal data and
must never be imported into the internal store. Account IDs are real KA codes only so that the
reconciliation path against the external model (read-only) can be exercised.

python3 -m tests.phase3a_synthetic  → writes tests/fixtures/phase3a_synthetic.json
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tests" / "fixtures" / "phase3a_synthetic.json"
UP, VER, APR = "synth.uploader", "synth.verifier", "synth.approver"
H_SOURCE: list = []
H_VERIFIED = [{"to": "VALIDATED", "by": "contract_validate"}, {"to": "VERIFIED", "by": VER}]
H_APPROVED = H_VERIFIED + [{"to": "APPROVED", "by": APR}]


def rec(rid, acc, measure, fy, raw, unit, value_eok, *, level="ACCOUNT", area="ALL", period="FY", case="PLAN",
        definition="DEF_INT_REVENUE_TBD", history=H_APPROVED, status=None, version=1, **extra):
    st = status or (history[-1]["to"] if history else "SOURCE")
    r = {"record_id": rid, "synthetic": True, "account_id": acc, "account_name_src": f"SYNTH-{acc}",
         "area_level": level, "area_id": area, "fiscal_year": fy, "period_type": period,
         "case_family": "INTERNAL_CASE", "case_id": case, "measure_id": measure,
         "source": {"source_id": f"SYNTH-{rid}", "layer": "INTERNAL_EXCEL", "file_sha256": "0" * 64, "sheet": "SYNTH",
                    "cell_ref": f"R{rid[-3:]}", "as_of": "2026-10-16", "version": version, "uploaded_by": UP},
         "raw": {"value": raw, "unit": unit, "formula": None}, "value_eok": value_eok,
         "definition_ref": definition, "entity_scope": "UNKNOWN", "vat_basis": "UNKNOWN", "status": st, "history": history}
    r.update(extra)
    return r


def valid_payload() -> dict:
    R = []
    # KA03 — internal SAM/RAW with RAW reverse-calculation adjustment kept as three separate records (balanced)
    R += [rec("S-KA03-001", "KA03", "INT_SAM", 2026, "1,400", "억원", "1400", definition="DEF_INT_SAM_TBD", history=H_VERIFIED),
          rec("S-KA03-002", "KA03", "INT_RAW_SOURCE", 2026, "900", "억원", "900", definition="DEF_INT_RAW_TBD", history=H_VERIFIED),
          rec("S-KA03-003", "KA03", "INT_RAW_ADJ", 2026, "150", "억원", "150", definition="DEF_INT_RAW_TBD", history=H_VERIFIED,
              adjustment_method="SYNTH: 계획매출 ÷ 목표 SOW 역산", adjustment_reason="SYNTH: 신규 회선 계약 반영"),
          rec("S-KA03-004", "KA03", "INT_RAW_ADJUSTED", 2026, "1050", "억원", "1050", definition="DEF_INT_RAW_TBD", history=H_VERIFIED),
          # category-level RAW under a test-only DIRECT definition → exercises the ALIGNED path
          rec("S-KA03-005", "KA03", "INT_RAW_ADJUSTED", 2026, "280", "억원", "280", level="CATEGORY", area="CONNECTIVITY",
              definition="DEF_SYNTH_RAW_DIRECT", history=H_VERIFIED),
          # actuals: FORECAST and ACTUAL_FULL_YEAR both approved → ACTUAL_FULL_YEAR wins (never summed)
          rec("S-KA03-010", "KA03", "ACTUAL_REVENUE", 2026, "12,000", "백만원", "120.00", period="FORECAST", case="ACTUAL"),
          rec("S-KA03-011", "KA03", "ACTUAL_REVENUE", 2026, "118.5", "억원", "118.5", period="ACTUAL_FULL_YEAR", case="ACTUAL"),
          # 2031 target cases preserved as-is; the approved target is linked to case B and must equal it exactly
          rec("S-KA03-020", "KA03", "TARGET_CASE", 2031, "200", "억원", "200", case="TARGET_CASE_A", history=H_VERIFIED),
          rec("S-KA03-021", "KA03", "TARGET_CASE", 2031, "260", "억원", "260", case="TARGET_CASE_B", history=H_VERIFIED),
          rec("S-KA03-022", "KA03", "APPROVED_TARGET", 2031, "260", "억원", "260", case="APPROVED", derived_from_case_id="TARGET_CASE_B"),
          rec("S-KA03-023", "KA03", "STRETCH", 2031, "300", "억원", "300", case="STRETCH", history=H_VERIFIED)]
    R += [rec(f"S-KA03-03{i}", "KA03", "SALES_PLAN", y, v, "억원", v) for i, (y, v) in enumerate([(2027, "140"), (2028, "160"), (2029, "185"), (2030, "220"), (2031, "255")])]
    # KA29 — category RAW 1.5× external (REVIEW_INTERNAL_HIGHER), approved target in 조원 above external FPR (flag, value kept),
    #        actual revenue only VERIFIED → not official
    R += [rec("S-KA29-001", "KA29", "INT_RAW_ADJUSTED", 2031, "5,000", "억원", "5000", level="CATEGORY", area="CLOUD",
              definition="DEF_SYNTH_RAW_DIRECT", history=H_VERIFIED),
          rec("S-KA29-002", "KA29", "APPROVED_TARGET", 2031, "0.6", "조원", "6000.0", case="APPROVED"),
          rec("S-KA29-003", "KA29", "ACTUAL_REVENUE", 2026, "900", "억원", "900", period="FORECAST", case="ACTUAL", history=H_VERIFIED)]
    # KA14 — unbalanced RAW adjustment (reported, not fixed); CR from category rows only (no account row)
    R += [rec("S-KA14-001", "KA14", "INT_RAW_SOURCE", 2026, "1000", "억원", "1000", definition="DEF_INT_RAW_TBD", history=H_VERIFIED),
          rec("S-KA14-002", "KA14", "INT_RAW_ADJ", 2026, "200", "억원", "200", definition="DEF_INT_RAW_TBD", history=H_VERIFIED,
              adjustment_method="SYNTH", adjustment_reason="SYNTH"),
          rec("S-KA14-003", "KA14", "INT_RAW_ADJUSTED", 2026, "1250", "억원", "1250", definition="DEF_INT_RAW_TBD", history=H_VERIFIED),
          rec("S-KA14-010", "KA14", "ACTUAL_REVENUE", 2026, "40", "억원", "40", level="CATEGORY", area="CONNECTIVITY", period="ACTUAL_FULL_YEAR", case="ACTUAL"),
          rec("S-KA14-011", "KA14", "ACTUAL_REVENUE", 2026, "15", "억원", "15", level="CATEGORY", area="DC_COLO", period="ACTUAL_FULL_YEAR", case="ACTUAL"),
          # rejected record never reaches official output
          rec("S-KA14-020", "KA14", "APPROVED_TARGET", 2031, "999", "억원", "999", case="APPROVED",
              history=[{"to": "VALIDATED", "by": "contract_validate"}, {"to": "REJECTED", "by": VER, "reason": "SYNTH: 근거 미첨부"}])]
    evidence = {
        "opportunities": [
            {"opportunity_id": "OPP-KA03-CONN-2031", "account_id": "KA03", "area_id": "Connectivity", "fiscal_year": 2031, "case_id": "BASE|BASE_CASE", "presented_as": "CANDIDATE"},
            {"opportunity_id": "OPP-KA03-SEC-2031", "account_id": "KA03", "area_id": "Security", "fiscal_year": 2031, "case_id": "BASE|BASE_CASE", "presented_as": "CONFIRMED"},
        ],
        "internal_evidence": [{"evidence_id": "SYNTH-PIPE-001", "type": "INTERNAL_PIPELINE", "account_id": "KA03", "area_id": "Connectivity", "synthetic": True}],
        "links": [
            {"link_id": "L1", "opportunity_id": "OPP-KA03-CONN-2031", "evidence_id": "KA03-C04", "role": "CONTEXT"},
            {"link_id": "L2", "opportunity_id": "OPP-KA03-CONN-2031", "evidence_id": "SYNTH-PIPE-001", "role": "SUPPORTS"},
            {"link_id": "L3", "opportunity_id": "OPP-KA03-SEC-2031", "evidence_id": "KA03-D01", "role": "SUPPORTS"},
        ],
    }
    return {"synthetic": True, "note": "TEST-ONLY — 모든 값은 합성", "records": R, "evidence": evidence,
            "definitions_extra": {"DEF_SYNTH_RAW_DIRECT": {"measure": "INT_RAW_*", "text": "SYNTH: 정의 일치 가정(테스트 전용)", "compare_to": "EXT_RAW", "comparability": "DIRECT", "synthetic": True}}}


def negative_records() -> list[dict]:
    """One rule violation per record; the expected code is in `expect`."""
    N = [
        (rec("N-001", "KA03", "ACTUAL_REVENUE", 2026, "123.456", "억원", "123.46", period="FORECAST", case="ACTUAL"), "C02_RAW_MUTATED"),
        (rec("N-002", "KA03", "APPROVED_TARGET", 2031, "100", "억원", "100", case="APPROVED", version=2,
             history=H_VERIFIED[:1] + [{"to": "VERIFIED", "by": VER}, {"to": "APPROVED", "by": UP}]), "C04_SOD"),
        (rec("N-003", "KA03", "SALES_PLAN", 2028, "160", "억원", "160", version=2, history=[{"to": "APPROVED", "by": APR}]), "C04_BAD_TRANSITION"),
        (rec("N-004", "KA03", "ACTUAL_REVENUE", 2026, "5", "억원", "5", level="CATEGORY", area="MOBILE_B2B", period="FORECAST", case="ACTUAL"), "C08_AREA_UNMAPPED"),
        (rec("N-005", None, "ACTUAL_REVENUE", 2026, "5", "억원", "5", period="FORECAST", case="ACTUAL"), "C08_ACCOUNT_UNMAPPED"),
        (rec("N-006", "KA03", "TARGET_CASE", 2030, "200", "억원", "200", case="TARGET_CASE_C", history=H_VERIFIED), "C01_TIMING"),
        (rec("N-007", "KA03", "INT_RAW_ADJ", 2026, "10", "억원", "10", definition="DEF_INT_RAW_TBD", history=H_VERIFIED, version=3), "C05_ADJ_UNDOCUMENTED"),
        (rec("N-008", "KA03", "EXT_RAW", 2026, "987", "억원", "987", definition="DEF_EXT_RAW_V1"), "C01_EXTERNAL_IMPORT"),
        (rec("N-009", "KA03", "APPROVED_TARGET", 2031, "250", "억원", "250", case="APPROVED", version=4, derived_from_case_id="TARGET_CASE_B"), "C07_TARGET_CASE_MISMATCH"),
        (rec("N-010", "KA03", "ACTUAL_REVENUE", 2026, "1", "억원", "1", period="FORECAST", case="ACTUAL", history=H_VERIFIED, status="APPROVED"), "C04_STATUS_MISMATCH"),
        (dict(rec("N-011", "KA03", "ACTUAL_REVENUE", 2026, "1", "억원", "1", period="FORECAST", case="ACTUAL", version=5), synthetic=False), "C10_REAL_IN_TEST"),
    ]
    out = []
    for r, code in N:
        r["expect"] = code
        out.append(r)
    return out


if __name__ == "__main__":
    p = valid_payload()
    p["negative_records"] = negative_records()
    OUT.write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
    print(OUT, len(p["records"]), "valid +", len(p["negative_records"]), "negative")
