"""Financial integrity validation. Never mutates values — only emits data-quality issues."""
from __future__ import annotations

from decimal import Decimal

from models.common import D0, cagr

TOL = Decimal("0.0001")


def _issue(acc, severity, code, msg, metric=None, year=None, scenario=None):
    return {"account_id": acc, "severity": severity, "code": code, "message": msg,
            "metric": metric, "year": year, "scenario": scenario}


def _close(a, b):
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= TOL * max(Decimal(1), abs(b))


def validate_account(acc: dict) -> list[dict]:
    a = acc["account_id"]
    out = []
    m26 = acc["m"]["2026"]
    ts, raw, fpr, cr = (m26[k]["value"] for k in ("TS", "RAW", "FPR", "CR"))
    # Hierarchy 2026
    if ts is not None and raw is not None and raw > ts + TOL:
        out.append(_issue(a, "ERROR", "RAW_GT_TS", f"RAW {raw:.1f} > TS {ts:.1f}", "RAW", 2026))
    if raw is not None and fpr is not None and fpr > raw + TOL:
        out.append(_issue(a, "ERROR", "FPR_GT_RAW", f"FPR {fpr:.1f} > RAW {raw:.1f}", "FPR", 2026))
    for k in ("TS", "RAW", "FPR"):
        v = m26[k]["value"]
        if v is not None and v < 0:
            out.append(_issue(a, "ERROR", "NEGATIVE", f"{k} 음수", k, 2026))
    if ts is None:
        out.append(_issue(a, "WARN", "TS_UNKNOWN", "TS_2026 산출 근거 부족(UNKNOWN). 합계에서 제외됨.", "TS", 2026))
    # Current revenue
    if cr is None:
        out.append(_issue(a, "INFO", "CR_NULL", "CR_2026 미입력(NULL) — 0으로 처리하지 않음. C-SOW·Upside N/A.", "CR", 2026))
    else:
        if cr < 0:
            out.append(_issue(a, "ERROR", "NEGATIVE", "CR 음수", "CR", 2026))
        if fpr is not None and cr > fpr + TOL:
            out.append(_issue(a, "WARN", "CR_GT_FPR", f"CR {cr:.1f} > FPR {fpr:.1f}: FPR 가정(접근성·포획 상한) 재검토 필요", "CR", 2026))
        exp = cr / raw if raw else None
        if not _close(m26["CSOW"]["value"], exp):
            out.append(_issue(a, "ERROR", "CSOW_FORMULA", "C-SOW ≠ CR/RAW", "CSOW", 2026))
        exp = cr / fpr if fpr else None
        if not _close(m26["PCR"]["value"], exp):
            out.append(_issue(a, "ERROR", "PCR_FORMULA", "Potential Capture Rate ≠ CR/FPR", "PCR", 2026))
        exp = fpr - cr if fpr is not None else None
        if not _close(m26["UPSIDE"]["value"], exp):
            out.append(_issue(a, "ERROR", "UPSIDE_FORMULA", "Upside ≠ FPR−CR", "UPSIDE", 2026))
    if cr is None and m26["UPSIDE"]["value"] is not None:
        out.append(_issue(a, "ERROR", "UPSIDE_WITHOUT_CR", "CR 미확인인데 Upside 값 존재", "UPSIDE", 2026))
    # 2031
    for scen, block in acc["m"]["2031"].items():
        for case in ("base", "expansion"):
            t, r, f = block["TS"]["value"], block[f"RAW_{case}"]["value"], block[f"FPR_{case}"]["value"]
            if t is not None and r is not None and r > t + TOL:
                out.append(_issue(a, "ERROR", "RAW_GT_TS", f"2031 {scen}/{case} RAW > TS", "RAW", 2031, scen))
            if r is not None and f is not None and f > r + TOL:
                out.append(_issue(a, "ERROR", "FPR_GT_RAW", f"2031 {scen}/{case} FPR > RAW", "FPR", 2031, scen))
        tgt = acc["m"]["target"]["TARGET"]["value"]
        f_base = block["FPR_base"]["value"]
        if tgt is not None and f_base is not None and tgt > f_base + TOL:
            sev = "ERROR" if scen == "base" else "WARN"
            out.append(_issue(a, sev, "TARGET_GT_FPR", f"Target {tgt:.1f} > FPR_2031({scen}) {f_base:.1f}", "TARGET", 2031, scen))
        # CAGR check
        if ts is not None and block["TS"]["value"] is not None:
            exp = cagr(ts, block["TS"]["value"])
            got = block["TS_CAGR"]["value"]
            if exp is not None and (got is None or abs(exp - got) > Decimal("0.0005")):
                out.append(_issue(a, "ERROR", "CAGR_FORMULA", "TS CAGR 재계산 불일치", "TS_CAGR", 2031, scen))
    tg = acc["m"]["target"]
    tsow = tg["TARGET_SOW"]["value"]
    csow = m26["CSOW"]["value"]
    if tg["TARGET"]["status"] == "SCENARIO":
        out.append(_issue(a, "INFO", "TARGET_SCENARIO", "2031 Target은 경영진 입력 없음 → SCENARIO(FPR×달성률). 경영진 의사결정 필요.", "TARGET", 2031))
    if csow is None:
        out.append(_issue(a, "INFO", "SOW_COMPARE_NA", "C-SOW 미확인 → Target SOW 개선 여부 확인 불가", "TARGET_SOW", 2031))
    elif tsow is not None and tsow <= csow:
        out.append(_issue(a, "INFO", "TARGET_SOW_NOT_ABOVE", f"[목표 적정성 검토] Target SOW {tsow:.3f} ≤ C-SOW {csow:.3f} — 데이터 오류가 아니라 목표 수준 검토 사항(⑧)", "TARGET_SOW", 2031))
    # Lineage
    for yr, blk in (("2026", m26),):
        for k, rec in blk.items():
            if rec["status"] not in ("UNKNOWN",) and rec["value"] is not None:
                if not rec.get("formula"):
                    out.append(_issue(a, "ERROR", "LINEAGE_FORMULA", f"{k} 산식 누락", k, int(yr)))
                if not (rec.get("evidence_ids") or rec.get("assumption_ids") or rec.get("inputs")):
                    out.append(_issue(a, "ERROR", "LINEAGE_SOURCE", f"{k} 출처/가정 연결 누락", k, int(yr)))
    return out
