"""Phase 3A Reconciliation Data Contract validator (standalone, read-only).

Validates canonical internal-data records against contracts/phase3a_data_contract.v0.json,
resolves which values may feed official dashboard slots (approved only), and reconciles
internal SAM/RAW against the external model WITHOUT changing either side.

- Never imports models.build, never writes to data/, config/ or the internal store.
- External values are read from data/processed/dashboard.json (engine output) — read-only.
- Raw values are compared exactly (Decimal); nothing is rounded, recomputed or "fixed".

Usage:
  python3 tools/contract_validate.py <records.json>   (or python3 -m models.recon.contract) [--mode test|production] [--out report.json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "phase3a_data_contract.v0.json"
DASHBOARD = ROOT / "data" / "processed" / "dashboard.json"


def load_contract(path: Path = CONTRACT) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _dec(v) -> Decimal | None:
    if v is None:
        return None
    try:
        return Decimal(str(v).replace(",", "").strip())
    except InvalidOperation:
        return None


def normalize(raw_value: str, unit: str, c: dict) -> Decimal | None:
    d = _dec(raw_value)
    f = c["unit_to_eok"].get(unit)
    return None if d is None or f is None else d * Decimal(f)


class Report:
    def __init__(self):
        self.issues: list[dict] = []

    def add(self, code, severity, msg, rec=None):
        self.issues.append({"code": code, "severity": severity, "message": msg, "record_id": rec.get("record_id") if rec else None})

    def codes(self, severity=None):
        return [i["code"] for i in self.issues if severity is None or i["severity"] == severity]


# ------------------------------------------------------------------ external model lookup (read-only)
def external_value(dash: dict, c: dict, account_id: str, measure: str, fy: int, case_id: str, area_level: str, area_id: str):
    acc = next((a for a in dash["accounts"] if a["account_id"] == account_id), None)
    if acc is None:
        return None
    m = {"EXT_TS": "TS", "EXT_RAW": "RAW", "EXT_FPR": "FPR"}[measure]
    if fy == 2026:
        rec = acc["m"]["2026"][m]
        total, by_cat = rec.get("value"), rec.get("by_cat")
    elif fy == 2031:
        scen, case = case_id.split("|")
        b = acc["m"]["2031"][scen.lower()]
        key = m if m == "TS" else f"{m}_{'base' if case == 'BASE_CASE' else 'expansion'}"
        rec = b[key]
        total, by_cat = rec.get("value"), rec.get("by_cat")
    else:
        return None  # external model has no 2027–2030 values (interpolation is illustrative only)
    if area_level == "ACCOUNT":
        return _dec(total)
    if not by_cat:
        return None
    if area_level == "CATEGORY":
        return _dec(by_cat.get(area_id))
    cats = [k for k, v in c["category_to_biz_area"].items() if v == area_id]
    vals = [by_cat.get(k) for k in cats]
    return None if not cats or any(v is None for v in vals) else sum((_dec(v) for v in vals), Decimal(0))


# ------------------------------------------------------------------ checks
def check_record(r: dict, c: dict, rep: Report, mode: str, extra_defs: dict):
    for f in c["required_fields"]:
        if f not in r:
            rep.add("C01_MISSING_FIELD", "ERROR", f"필수 필드 누락: {f}", r)
            return False
    for f in c["required_source_fields"]:
        if not r["source"].get(f):
            rep.add("C01_MISSING_SOURCE", "ERROR", f"source.{f} 누락 (원천 추적 불가)", r)
    e = c["enums"]
    for fld, en in (("area_level", "area_level"), ("period_type", "period_type"), ("case_family", "case_family"), ("status", "status")):
        if r[fld] not in e[en]:
            rep.add("C01_ENUM", "ERROR", f"{fld}={r[fld]} 허용값 아님", r)
    if r["source"].get("layer") not in e["layer"]:
        rep.add("C01_ENUM", "ERROR", f"source.layer={r['source'].get('layer')} 허용값 아님", r)
    if r["measure_id"] not in c["measures"]:
        rep.add("C01_MEASURE", "ERROR", f"measure_id={r['measure_id']} 계약에 없음", r)
        return False
    if c["measures"][r["measure_id"]]["layer"] == "EXTERNAL_MODEL":
        rep.add("C01_EXTERNAL_IMPORT", "ERROR", "외부 모델 값은 Import 대상이 아님 — 엔진 산출값을 직접 참조", r)
    if r["account_id"] is None or not re.fullmatch(r"KA\d{2}", str(r["account_id"])):
        rep.add("C08_ACCOUNT_UNMAPPED", "ERROR", f"account_id 미매핑: {r.get('account_name_src')}", r)
    # area
    if r["area_level"] == "ACCOUNT" and r["area_id"] != "ALL":
        rep.add("C08_AREA", "ERROR", "ACCOUNT 레벨은 area_id=ALL", r)
    if r["area_level"] == "CATEGORY" and r["area_id"] not in c["categories"]:
        rep.add("C08_AREA_UNMAPPED", "ERROR", f"카테고리 미매핑: {r['area_id']} (사내 상품군 → 카테고리 매핑 필요)", r)
    if r["area_level"] == "BIZ_AREA" and r["area_id"] not in {v for v in c["category_to_biz_area"].values() if v}:
        rep.add("C08_AREA_UNMAPPED", "ERROR", f"사업영역 미매핑: {r['area_id']}", r)
    # case
    if r["case_family"] == "INTERNAL_CASE" and not re.fullmatch(c["case_ids"]["INTERNAL_CASE_PATTERN"], r["case_id"]):
        rep.add("C01_CASE", "ERROR", f"case_id={r['case_id']} 형식 위반", r)
    # raw preservation: normalized value must equal raw × unit factor EXACTLY
    raw = r["raw"]
    if not isinstance(raw.get("value"), str):
        rep.add("C02_RAW_NOT_STRING", "ERROR", "raw.value는 원본 셀 문자열 그대로 보존(숫자 변환 금지)", r)
    if raw.get("unit") not in e["unit"]:
        rep.add("C01_UNIT", "ERROR", f"단위 미지원: {raw.get('unit')}", r)
    else:
        n = normalize(raw.get("value"), raw["unit"], c)
        if n is None:
            rep.add("C02_RAW_NOT_NUMERIC", "ERROR", f"원본값 숫자 아님: {raw.get('value')!r}", r)
        elif _dec(r["value_eok"]) != n:
            rep.add("C02_RAW_MUTATED", "ERROR", f"정규화값 {r['value_eok']} ≠ 원본 {raw['value']} {raw['unit']} 환산 {n} — 반올림·수정 금지", r)
    # definition
    defs = {**c["definitions"], **extra_defs}
    if r["definition_ref"] not in defs:
        rep.add("C01_DEFINITION", "ERROR", f"definition_ref 미등록: {r['definition_ref']}", r)
    # measure-specific
    for req in c["measures"][r["measure_id"]].get("requires", []):
        if not r.get(req):
            rep.add("C05_ADJ_UNDOCUMENTED", "ERROR", f"{r['measure_id']}는 {req} 필수", r)
    if r["measure_id"] in ("TARGET_CASE", "APPROVED_TARGET") and r["fiscal_year"] != 2031:
        rep.add("C01_TIMING", "ERROR", "Target은 FY2031", r)
    # synthetic guard
    if r["synthetic"] and mode == "production":
        rep.add("C10_SYNTHETIC_IN_PRODUCTION", "ERROR", "합성 데이터는 운영 모드에서 사용 불가", r)
    if not r["synthetic"] and mode == "test":
        rep.add("C10_REAL_IN_TEST", "ERROR", "테스트 모드에는 합성 데이터만 허용(사내 원천값 사용 금지)", r)
    return True


def check_history(r: dict, c: dict, rep: Report):
    h = r["history"]
    state, uploader, verifier = "SOURCE", r["source"].get("uploaded_by"), None
    for step in h:
        to = step.get("to")
        if to not in c["transitions"].get(state, []):
            rep.add("C04_BAD_TRANSITION", "ERROR", f"상태 전이 {state}→{to} 불가", r)
            return
        if to == "VERIFIED":
            verifier = step.get("by")
            if verifier == uploader:
                rep.add("C04_SOD", "ERROR", "검증자 = 업로더 (직무 분리 위반)", r)
        if to == "APPROVED":
            if not step.get("by") or step.get("by") in (uploader, verifier):
                rep.add("C04_SOD", "ERROR", "승인자 누락 또는 업로더/검증자와 동일 (직무 분리 위반)", r)
        if to == "REJECTED" and not step.get("reason"):
            rep.add("C04_REASON", "WARN", "반려 사유 누락", r)
        state = to
    if state != r["status"]:
        rep.add("C04_STATUS_MISMATCH", "ERROR", f"status={r['status']} ≠ 이력 최종 상태 {state}", r)


def _key(r):
    return (r["account_id"], r["area_level"], r["area_id"], r["fiscal_year"], r["period_type"], r["case_id"], r["measure_id"], r["source"].get("version"))


def validate(records: list[dict], c: dict, dash: dict | None, mode: str = "test", extra_defs: dict | None = None) -> dict:
    rep = Report()
    extra_defs = extra_defs or {}
    if mode == "test":
        for k, d in extra_defs.items():
            if not d.get("synthetic"):
                rep.add("C10_EXTRA_DEF", "ERROR", f"테스트 전용 정의 {k}는 synthetic=true 필요")
    elif extra_defs:
        rep.add("C10_EXTRA_DEF", "ERROR", "운영 모드에서는 계약 외 정의 사용 불가")
    ok = [r for r in records if check_record(r, c, rep, mode, extra_defs)]
    for r in ok:
        check_history(r, c, rep)
    seen = {}
    for r in ok:
        k = _key(r)
        if k in seen:
            rep.add("C03_DUPLICATE_KEY", "ERROR", f"키 중복: {k} ({seen[k]})", r)
        seen[k] = r["record_id"]
    # records with any ERROR never reach official resolution or reconciliation (quarantined, still reported)
    errored = {i["record_id"] for i in rep.issues if i["severity"] == "ERROR" and i["record_id"]}
    live = [r for r in ok if r["status"] not in ("REJECTED", "SUPERSEDED") and r["record_id"] not in errored]
    by = defaultdict(list)
    for r in live:
        by[(r["account_id"], r["area_level"], r["area_id"], r["fiscal_year"], r["case_id"], r["source"].get("version"))].append(r)
    # C05 RAW adjustment integrity — reported, never fixed
    for k, rs in by.items():
        src = [r for r in rs if r["measure_id"] == "INT_RAW_SOURCE"]
        adj = [r for r in rs if r["measure_id"] == "INT_RAW_ADJ"]
        aft = [r for r in rs if r["measure_id"] == "INT_RAW_ADJUSTED"]
        if aft and (src or adj):
            lhs = sum((_dec(r["value_eok"]) for r in src + adj), Decimal(0))
            rhs = _dec(aft[0]["value_eok"])
            if lhs != rhs:
                rep.add("C05_RAW_ADJ_UNBALANCED", "WARN", f"{k}: 보정 전 + 보정액 = {lhs} ≠ 보정 후 {rhs} (원본 유지, 확인 필요)", aft[0])
        sam = [r for r in rs if r["measure_id"] == "INT_SAM"]
        if sam and aft and _dec(aft[0]["value_eok"]) > _dec(sam[0]["value_eok"]):
            rep.add("C06_RAW_ABOVE_SAM", "WARN", f"{k}: 사내 RAW > SAM", aft[0])
    # C08 category sum vs account total (same measure/fy/case/version) — reported only
    tot = defaultdict(dict)
    for r in live:
        tot[(r["account_id"], r["fiscal_year"], r["case_id"], r["measure_id"], r["definition_ref"], r["source"].get("version"))].setdefault(r["area_level"], []).append(r)
    for k, lv in tot.items():
        if "ACCOUNT" in lv and "CATEGORY" in lv:
            s = sum((_dec(r["value_eok"]) for r in lv["CATEGORY"]), Decimal(0))
            t = _dec(lv["ACCOUNT"][0]["value_eok"])
            if s != t:
                rep.add("C08_AREA_SUM_DIFF", "WARN", f"{k}: 카테고리 합 {s} ≠ 계정 합계 {t} (원본 유지 — 미배분 금액 확인)", lv["ACCOUNT"][0])
    official = resolve_official(live, c, rep)
    recon = reconcile(live, c, dash, rep, extra_defs) if dash else []
    return {"mode": mode, "n_records": len(records), "n_valid": len(ok), "quarantined": sorted(errored), "errors": len(rep.codes("ERROR")), "warnings": len(rep.codes("WARN")),
            "issues": rep.issues, "official": official, "reconciliation": recon}


def resolve_official(live: list[dict], c: dict, rep: Report) -> dict:
    """Only APPROVED records feed official slots. Everything else is listed as excluded with the reason."""
    out = {"CR": {}, "TARGET": {}, "REVENUE_PLAN": {}, "excluded": []}
    approved = [r for r in live if r["status"] == "APPROVED"]
    for r in live:
        if r["status"] != "APPROVED" and c["measures"][r["measure_id"]]["official_use"] == "OFFICIAL_WHEN_APPROVED":
            out["excluded"].append({"record_id": r["record_id"], "reason": f"미승인({r['status']}) — 공식 계산 제외"})
        if c["measures"][r["measure_id"]]["official_use"] == "COMPARISON_ONLY":
            out["excluded"].append({"record_id": r["record_id"], "reason": f"{r['measure_id']}는 대사 비교 전용"})
    # CR: ACTUAL_FULL_YEAR wins over FORECAST; account-level row wins; never mix levels
    rule = c["official_resolution"]["CR"]
    for aid in sorted({r["account_id"] for r in approved if r["measure_id"] == "ACTUAL_REVENUE"}):
        rows = [r for r in approved if r["measure_id"] == "ACTUAL_REVENUE" and r["account_id"] == aid and r["fiscal_year"] == rule["fiscal_year"]]
        for pt in rule["period_priority"]:
            sel = [r for r in rows if r["period_type"] == pt]
            if not sel:
                continue
            acct = [r for r in sel if r["area_level"] == "ACCOUNT"]
            use = acct or [r for r in sel if r["area_level"] == "CATEGORY"]
            out["CR"][aid] = {"value_eok": str(sum((_dec(r["value_eok"]) for r in use), Decimal(0))), "period_type": pt,
                              "records": [r["record_id"] for r in use], "synthetic": any(r["synthetic"] for r in use)}
            break
    # TARGET: APPROVED_TARGET only; TARGET_CASE/STRETCH/SALES_PLAN are never promoted
    cases = {(r["account_id"], r["case_id"]): r for r in live if r["measure_id"] == "TARGET_CASE"}
    for r in approved:
        if r["measure_id"] != "APPROVED_TARGET":
            continue
        if r["area_level"] != "ACCOUNT":
            continue
        src_case = r.get("derived_from_case_id")
        if src_case:
            cr = cases.get((r["account_id"], src_case))
            if cr is None:
                rep.add("C07_TARGET_CASE_MISSING", "ERROR", f"승인 목표의 원천 케이스 {src_case} 없음", r)
                continue
            if _dec(cr["value_eok"]) != _dec(r["value_eok"]):
                rep.add("C07_TARGET_CASE_MISMATCH", "ERROR", f"승인 목표 {r['value_eok']} ≠ 케이스 {src_case} 원본 {cr['value_eok']}", r)
                continue  # lineage broken → not official
        prev = out["TARGET"].get(r["account_id"])
        if prev and prev["version"] >= r["source"]["version"]:
            continue
        out["TARGET"][r["account_id"]] = {"value_eok": r["value_eok"], "version": r["source"]["version"], "record": r["record_id"],
                                          "derived_from_case_id": src_case, "synthetic": r["synthetic"]}
    for r in approved:
        if r["measure_id"] == "SALES_PLAN" and r["area_level"] == "ACCOUNT" and r["fiscal_year"] in c["official_resolution"]["REVENUE_PLAN"]["fiscal_year"]:
            out["REVENUE_PLAN"].setdefault(r["account_id"], {})[str(r["fiscal_year"])] = r["value_eok"]
    return out


def reconcile(live: list[dict], c: dict, dash: dict, rep: Report, extra_defs: dict) -> list[dict]:
    defs = {**c["definitions"], **extra_defs}
    thr = Decimal(c["variance_threshold"])
    rows = []
    for r in live:
        mid = r["measure_id"]
        if mid in ("INT_SAM", "INT_RAW_SOURCE", "INT_RAW_ADJUSTED"):
            ext_m = "EXT_RAW"
        elif mid in ("APPROVED_TARGET", "TARGET_CASE", "STRETCH", "SALES_PLAN"):
            ext_m = "EXT_FPR"
        else:
            continue
        if r["fiscal_year"] not in (2026, 2031):
            continue
        ext_case = "BASE|BASE_CASE"
        ext = external_value(dash, c, r["account_id"], ext_m, r["fiscal_year"], ext_case, r["area_level"], r["area_id"])
        comp = defs.get(r["definition_ref"], {}).get("comparability", "UNKNOWN")
        val = _dec(r["value_eok"])
        row = {"record_id": r["record_id"], "account_id": r["account_id"], "area": f"{r['area_level']}:{r['area_id']}", "fiscal_year": r["fiscal_year"],
               "internal_measure": mid, "internal_eok": str(val), "status": r["status"], "external_measure": f"{ext_m}[{ext_case}]",
               "external_eok": None if ext is None else str(ext.quantize(Decimal('0.01'))), "comparability": comp, "synthetic": r["synthetic"]}
        if ext is None:
            row["judgement"] = "EXTERNAL_NA"
        elif comp == "CEILING_ONLY":
            row["judgement"] = "TARGET_ABOVE_FPR" if val > ext else "WITHIN_FPR"
            if val > ext and mid == "APPROVED_TARGET":
                rep.add("C07_TARGET_ABOVE_FPR", "WARN", f"{r['account_id']} 승인 목표 {val} > 외부 FPR_2031 {ext.quantize(Decimal('0.01'))} (값 유지, 검토 필요)", r)
        elif comp == "UNKNOWN":
            row["judgement"] = "NOT_COMPARABLE"  # definition unknown → values side by side only, no variance
        elif ext > 0:
            diff = val / ext - 1
            row["diff_pct"] = str(diff.quantize(Decimal("0.0001")))
            row["judgement"] = ("ALIGNED" if abs(diff) <= thr else "REVIEW_INTERNAL_HIGHER" if diff > 0 else "REVIEW_INTERNAL_LOWER") if comp == "DIRECT" \
                else "REFERENCE_ONLY" if comp == "PROXY" else "NOT_COMPARABLE"
        else:
            row["judgement"] = "EXTERNAL_NA"
        rows.append(row)
    return rows


def check_evidence_links(links: list[dict], opportunities: list[dict], internal_evidence: list[dict], dash: dict, c: dict) -> list[dict]:
    """Every link must reference an existing evidence id whose account/area matches the opportunity."""
    issues = []
    ext_ids = {}
    for a in dash["accounts"]:
        for area, ae in (a.get("area_evidence") or {}).items():
            for typ, ids in (ae.get("observation_ids") or {}).items():
                for i in ids:
                    ext_ids.setdefault(i, set()).add((a["account_id"], area, typ))
    int_ids = {e["evidence_id"]: e for e in internal_evidence}
    opp = {o["opportunity_id"]: o for o in opportunities}
    for ln in links:
        o = opp.get(ln["opportunity_id"])
        if o is None:
            issues.append({"code": "C11_OPP_MISSING", "link": ln["link_id"]})
            continue
        if ln["role"] not in c["evidence_link"]["roles"]:
            issues.append({"code": "C11_ROLE", "link": ln["link_id"]})
        eid = ln["evidence_id"]
        if eid in int_ids:
            e = int_ids[eid]
            if e["type"] not in c["evidence_link"]["internal_evidence_types"]:
                issues.append({"code": "C11_TYPE", "link": ln["link_id"]})
            if (e["account_id"], e["area_id"]) != (o["account_id"], o["area_id"]):
                issues.append({"code": "C11_SCOPE_MISMATCH", "link": ln["link_id"]})
        elif eid in ext_ids:
            if not any(acc == o["account_id"] and area == o["area_id"] for acc, area, _ in ext_ids[eid]):
                issues.append({"code": "C11_SCOPE_MISMATCH", "link": ln["link_id"]})
        else:
            issues.append({"code": "C11_EVIDENCE_MISSING", "link": ln["link_id"]})
    # opportunities with no SUPPORTS link may not be presented as confirmed
    supported = {ln["opportunity_id"] for ln in links if ln["role"] == "SUPPORTS"}
    for o in opportunities:
        if o.get("presented_as") == "CONFIRMED" and o["opportunity_id"] not in supported:
            issues.append({"code": "C11_CONFIRMED_WITHOUT_EVIDENCE", "opportunity": o["opportunity_id"]})
    return issues


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("records")
    ap.add_argument("--mode", default="test", choices=["test", "production"])
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    payload = json.loads(Path(a.records).read_text(encoding="utf-8"))
    c = load_contract()
    dash = json.loads(DASHBOARD.read_text(encoding="utf-8")) if DASHBOARD.exists() else None
    res = validate(payload["records"], c, dash, a.mode, payload.get("definitions_extra"))
    if dash and "evidence" in payload:
        ev = payload["evidence"]
        res["evidence_link_issues"] = check_evidence_links(ev["links"], ev["opportunities"], ev.get("internal_evidence", []), dash, c)
    txt = json.dumps(res, ensure_ascii=False, indent=2)
    if a.out:
        Path(a.out).write_text(txt, encoding="utf-8")
    print(f"records {res['n_records']} · valid {res['n_valid']} · errors {res['errors']} · warnings {res['warnings']}")
    for i in res["issues"]:
        print(f"  [{i['severity']}] {i['code']} {i['record_id'] or ''} {i['message']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
