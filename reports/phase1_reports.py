"""Phase 1 completion-gate reports (data-driven). python3 -m reports.phase1_reports

Outputs: data/phase1/EVIDENCE_RECOVERY_LOG.csv, data/phase1/SOURCE_COVERAGE_REPORT.md,
         data/phase1/PHASE1_VALIDATION_REPORT.md, docs/NA_RECOVERY_STATUS.md
"""
from __future__ import annotations

import csv
import glob
import json
import os
import subprocess
from collections import Counter

from models.common import PROCESSED, ROOT

P1 = ROOT / "data" / "phase1"


def main():
    d = json.loads((PROCESSED / "dashboard.json").read_text(encoding="utf-8"))
    cov = json.loads((P1 / "current_coverage.json").read_text(encoding="utf-8"))
    base = cov["baseline"]
    accs = {a["account_id"]: a for a in d["accounts"]}

    # ---- EVIDENCE_RECOVERY_LOG.csv
    log = []
    for p in sorted(glob.glob(str(ROOT / "data" / "raw" / "research_p1" / "KA*.json"))):
        s = json.loads(open(p, encoding="utf-8").read())
        aid = os.path.basename(p)[:4]
        for r in s.get("research_log", []):
            log.append({"account_id": aid, "kind": "ATTEMPT", "level": r.get("level", ""), "tool": r.get("tool", ""),
                        "step": r.get("step", ""), "target": str(r.get("target", ""))[:120], "result": r.get("result", ""),
                        "detail": str(r.get("detail", ""))[:300], "retryable": r.get("retryable", "")})
        for r in s.get("recovery_levels_tried", []) if isinstance(s.get("recovery_levels_tried"), list) else []:
            if isinstance(r, dict):
                log.append({"account_id": aid, "kind": "LEVEL", "level": r.get("level", ""), "tool": r.get("tool", ""),
                            "step": r.get("metric", r.get("what", "")), "target": "", "result": r.get("result", ""),
                            "detail": str(r.get("detail", r.get("note", "")))[:300], "retryable": ""})
    for k in cov["recovered_keys"]:
        aid, y, m = k.split("|")
        a = accs[aid]
        log.append({"account_id": aid, "kind": "FIELD_RECOVERED", "level": a["anchor"]["method"], "tool": "models.build",
                    "step": f"{y} {m}", "target": "", "result": a["na_class"][f"{y}|{m}"]["class"],
                    "detail": a["anchor"]["formula"][:300], "retryable": ""})
    with open(P1 / "EVIDENCE_RECOVERY_LOG.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["account_id", "kind", "level", "tool", "step", "target", "result", "detail", "retryable"])
        w.writeheader(); w.writerows(log)

    # ---- source coverage
    ev_all = [e for a in d["accounts"] for e in a["evidence"]]
    p1_ev = [e for e in ev_all if "-P1-" in (e.get("evidence_id") or "")]
    by_type = Counter(e.get("source_type") for e in p1_ev)
    by_status = Counter(e.get("verification_status") for e in p1_ev)
    facts = [f for a in d["accounts"] for f in a["facts"]]
    p1_facts = [f for f in facts if f.get("_phase") == "P1"]
    ts_methods = Counter(a["anchor"]["method"] for a in d["accounts"])
    ts_methods_v1 = Counter(a["anchor"]["method"] for a in json.loads((PROCESSED / "dashboard_v1_baseline.json").read_text(encoding="utf-8"))["accounts"])
    anchors_verified = sum(1 for a in d["accounts"] if a["m"]["2026"]["TS"]["value"] is not None and
                           any(i.get("fact_status") == "VERIFIED" for i in a["anchor"].get("inputs", [])))
    n_ts = sum(1 for a in d["accounts"] if a["m"]["2026"]["TS"]["value"] is not None)
    trace_ok = trace_n = 0
    for a in d["accounts"]:
        for k, r in a["m"]["2026"].items():
            if r["value"] is not None:
                trace_n += 1
                trace_ok += bool(r["evidence_ids"] or r["assumption_ids"] or r["inputs"])
    mcp_rows = Counter()
    for e in p1_ev:
        st = (e.get("source_type") or "") + " " + (e.get("publisher") or "") + " " + (e.get("source_title") or "")
        key = "MyDART/DART 원문" if "AUDIT" in st or "MyDART" in st or "감사보고서" in st or "DART_FILING" in st else \
            "OpenDART API" if "DART_API" in st else "KR-BID" if "KR-BID" in st or "krbid" in st.lower() else \
            "WebSearch(보도)" if (e.get("source_type") in ("NEWS", "KISA_DISCLOSURE_VIA_PRESS", "PRESS_RELEASE", "RESEARCH_REPORT")) else e.get("source_type") or "기타"
        mcp_rows[key] += 1

    L = ["# SOURCE COVERAGE REPORT — Phase 1", "", f"data_version {d['meta']['data_version']}", "",
         "## 1. 커버리지 지표", "", "| 지표 | 기준선(v1) | 현재 | 산식 |", "|---|---|---|---|",
         f"| External Estimable Coverage | {base['external_coverage']:.1%} ({base['external_covered']}/{base['external_fields']}) | **{cov['external_coverage']:.1%}** ({cov['external_covered']}/{cov['external_fields']}) | 유효 값(검증·파생·근거 기반 추정) 필드 / 외부 추정 가능 필드(NOT_APPLICABLE 제외) |",
         f"| N/A Recovery Rate | — | **{cov['na_recovery_rate']:.1%}** ({cov['recovered_external_fields']}/{cov['initial_external_missing']}) | 복구된 외부 결측 필드 / 최초 외부 결측 필드 |",
         f"| Missing Evidence Count (외부) | {base['external_missing']} | **{cov['external_missing']}** | INSUFFICIENT_EVIDENCE 필드 수 |",
         f"| Internal Required Count | {base['internal_required']} | {cov['internal_required']} | CR·C-SOW·PCR·Upside·Target·Target SOW (사내 데이터) |",
         f"| NOT_APPLICABLE | 0 | {cov['not_applicable']} | 지표 비적용(키암코 DC 2026 미운영) |",
         f"| Verified Evidence Coverage (TS 앵커) | — | {anchors_verified}/{n_ts} ({anchors_verified / max(1, n_ts):.0%}) | TS 앵커 입력 중 원천 직접 확인(VERIFIED) 사실 포함 고객 / TS 산출 고객 |",
         f"| Source Traceability Rate (2026 지표) | — | {trace_ok}/{trace_n} ({trace_ok / max(1, trace_n):.0%}) | 산식+출처/가정 연결된 값 / 값 존재 지표 |",
         f"| 등급 분포 (전체 필드) | {base['by_class']} | {cov['by_class']} | |",
         "", "## 2. Phase 1 신규 근거",
         f"- 보충 조사 파일 {len(glob.glob(str(ROOT / 'data' / 'raw' / 'research_p1' / 'KA*.json')))}개 고객, 신규 사실 {len(p1_facts)}건, 신규 근거 {len(p1_ev)}건",
         "- 신규 근거 검증 상태: " + ", ".join(f"{k} {v}" for k, v in by_status.items()),
         "- 신규 근거 원천별: " + ", ".join(f"{k} {v}" for k, v in mcp_rows.most_common()),
         "- source_type: " + ", ".join(f"{k} {v}" for k, v in by_type.most_common()),
         "", "## 3. TS 앵커 방법 변화 (v1 → 현재)", "", "| 방법 | v1 | 현재 |", "|---|---|---|"]
    for m in sorted(set(ts_methods) | set(ts_methods_v1)):
        L.append(f"| {m} | {ts_methods_v1.get(m, 0)} | {ts_methods.get(m, 0)} |")
    L += ["", "## 4. 독립 근거 판정", "- MyDART·OpenDART·koreaStock DART 데이터는 동일 원천 → 독립 근거 1건으로 계산.",
          "- KR-BID·나라장터는 동일 원천(G2B).", "- 동일 보도를 인용한 복수 기사는 1건으로 계산."]
    (P1 / "SOURCE_COVERAGE_REPORT.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    # ---- validation report
    try:
        t = subprocess.run(["python3", "-m", "pytest", "-q"], cwd=ROOT, capture_output=True, text=True, timeout=300).stdout.strip().splitlines()[-1]
    except Exception as e:  # noqa
        t = f"pytest 실행 실패: {e}"
    conf = list(csv.DictReader(open(P1 / "DATA_CONFLICTS.csv", encoding="utf-8-sig")))
    chg = list(csv.DictReader(open(P1 / "MODEL_CHANGE_LOG.csv", encoding="utf-8-sig")))
    V = ["# PHASE 1 VALIDATION REPORT", "", f"data_version {d['meta']['data_version']}", "",
         "## 1. 무결성", f"- 모델 검증 이슈: {d['issues_summary']}", f"- 자동 테스트: {t}",
         f"- 프론트엔드 동기화 오류: {len(cov.get('frontend_sync_errors', []))}건",
         "- 불변식 0 ≤ FPR ≤ RAW ≤ TS, Target ≤ FPR_2031, CR NULL≠0: tests/test_model.py 통과 시 보장",
         "", "## 2. 오류 재검증 규칙 결과 (DATA_CONFLICTS.csv)", "", "| 규칙 | 심각도 | 건수 |", "|---|---|---|"]
    for (r, s), n in sorted(Counter((c["rule"], c["severity"]) for c in conf).items()):
        V.append(f"| {r} | {s} | {n} |")
    V += ["", "### 해석", "- **R02 (IT/판관비 이상치)**: KB국민카드·대신증권·토스증권은 판관비 계정에 인건비가 빠지거나(별도 계정) 범위가 달라 은행 기준 보정 비율과 정의 불일치 → 카드·증권사에 판관비 집약도 방식이 부적합함을 확인, 감사보고서 IT 비용 항목(L2) 또는 KISA 근거로 대체.",
          "- **R09 (근거 충돌)**: 구글(그룹 매출 6,831억→법인 2,052억), 한국오라클(글로벌 분기 수치→국내 법인 1.1조) 등 기존 범위 오류 정정. 신한카드는 판관비 방식(≈1,000억)이 역산 IT 예산(≈2,200억, 저신뢰)과 충돌 → 과소추정 가능성 경고 유지.",
          "- **R06**: 삼성SDS 2031 인프라 증분(계획 기반)이 TS2031의 41% → 계획 실현 리스크 표시.",
          "", "## 3. 추정치 변경 요약 (MODEL_CHANGE_LOG.csv)",
          f"- 변경 유형: {dict(Counter(c['change_type'] for c in chg))}", "- 주요 TS_2026 변경(v1→현재, 억원):"]
    for c in chg:
        if c["metric"] == "TS" and c["year"] == "2026":
            V.append(f"  - {c['account_id']} {c['original_name']}: {c['v1_baseline'] or 'N/A'} → {float(c['current']):,.0f} ({c['v1_method']} → {c['current_method']})" if c["current"] else
                     f"  - {c['account_id']} {c['original_name']}: {c['v1_baseline']} → N/A")
    V += ["", "## 4. Completion Gate", "", "| 산출물 | 상태 |", "|---|---|"]
    for fn in ["NA_BASELINE_AUDIT.csv", "NA_RECOVERY_PLAN.csv", "EVIDENCE_RECOVERY_LOG.csv", "DATA_CONFLICTS.csv", "CORRECTIONS.json", "SOURCE_COVERAGE_REPORT.md"]:
        V.append(f"| data/phase1/{fn} | {'생성' if (P1 / fn).exists() else '없음'} |")
    V.append(f"| docs/MCP_SOURCE_REGISTRY.md | {'생성' if (ROOT / 'docs' / 'MCP_SOURCE_REGISTRY.md').exists() else '없음'} |")
    V += ["", "## 5. 미해결 (INSUFFICIENT_EVIDENCE) — 원인과 후속 조치", "", "| 고객 | 필드 | 원인 | 후속 조치 |", "|---|---|---|---|"]
    follow = {"KA28": "DC 운영위탁 수수료·연결비 단가(사내 IDC 사업부 자료) 확보 시 용량 모델 적용 (가산 26MW는 LG U+ 운영)",
              "KA32": "TS(USFK IT 예산) 공개 불가 — 계약 상한 기반 RAW만 유지. SAM.gov 계약 실집행액 확인",
              "KA41": "신협중앙회 감사보고서/경영공시(MyDART 미등록) 및 차세대 예산 확정 공고 모니터링(KR-BID)",
              "KA42": "Fastly 서울 POP 호스팅 IDC·트랜짓 계약(사내 영업 자료) 필요",
              "KA43": "Valve 국내 캐시·피어링 계약(사내 영업 자료) 필요",
              "KA45": "메타 국내 망·캐시 대가는 해외 법인 계약 — 사내 계약 데이터로만 확인 가능",
              "KA50": "2031: DC 준공·임차인 확정 후 용량 모델 적용 (KR-BID/뉴스 모니터링)"}
    for a in d["accounts"]:
        miss = [k for k, v in a["na_class"].items() if v["class"] == "INSUFFICIENT_EVIDENCE"]
        if miss:
            V.append(f"| {a['account_id']} {a['original_name']} | {', '.join(miss)} | {a['na_class'][miss[0]]['reason'][:90]} | {follow.get(a['account_id'], '-')} |")
    (P1 / "PHASE1_VALIDATION_REPORT.md").write_text("\n".join(V) + "\n", encoding="utf-8")

    # ---- NA recovery status (per account)
    S = ["# N/A RECOVERY STATUS (53 accounts)", "", f"data_version {d['meta']['data_version']} · 외부 커버리지 {cov['external_coverage']:.1%} · 복구율 {cov['na_recovery_rate']:.1%}", "",
         "| ID | 고객 | TS 방법 | TS 2026 등급 | 외부 결측 | 상태 | 비고 |", "|---|---|---|---|---|---|---|"]
    for a in d["accounts"]:
        miss = sum(v["class"] == "INSUFFICIENT_EVIDENCE" for k, v in a["na_class"].items())
        cls = a["na_class"]["2026|TS"]["class"]
        state = "추가 검증 필요" if cls in ("ESTIMATED_LOW", "INSUFFICIENT_EVIDENCE") else "추정 완료" if cls.startswith("ESTIMATED") else cls
        S.append(f"| {a['account_id']} | {a['original_name']} | {a['anchor']['method']} | {cls} | {miss} | 조사 완료 · {state} · 내부 데이터 필요 | {(a.get('override_notes') or [''])[-1][:70]} |")
    (ROOT / "docs" / "NA_RECOVERY_STATUS.md").write_text("\n".join(S) + "\n", encoding="utf-8")
    print("phase1 reports written; log rows", len(log))


if __name__ == "__main__":
    main()
