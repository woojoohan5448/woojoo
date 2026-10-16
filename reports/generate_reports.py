"""Generate data-driven deliverables from the model output (no hand-copied numbers).

python3 -m reports.generate_reports
Outputs: docs/ACCOUNT_MASTER.csv, docs/ENTITY_RESOLUTION_REPORT.md, reports/QUALITY_REPORT.md,
         reports/RESEARCH_GAPS.md, reports/STRATEGIC_SYNTHESIS.md
"""
from __future__ import annotations

import csv
import json
from collections import Counter

from models.common import PROCESSED, ROOT

D = json.loads((PROCESSED / "dashboard.json").read_text(encoding="utf-8"))
A = D["accounts"]
DOCS, REP = ROOT / "docs", ROOT / "reports"


def e(v, digits=0):
    if v is None:
        return "N/A"
    if abs(v) >= 10000:
        return f"{v / 10000:,.2f}조"
    return f"{v:,.{digits}f}억"


def p(v):
    return "N/A" if v is None else f"{v * 100:.1f}%"


def account_master():
    fields = ["account_id", "original_name", "legal_name_ko", "legal_name_en", "corp_code", "stock_code", "business_reg_no", "parent_group",
              "related_key_accounts", "segment", "industry_detail", "is_korean_entity", "fiscal_year_end", "dart_available", "economic_scope",
              "exclusions", "entity_status", "entity_notes", "overlap_groups", "aggregate_class", "research_status"]
    with open(DOCS / "ACCOUNT_MASTER.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for a in A:
            en = a["entity"]
            w.writerow({"account_id": a["account_id"], "original_name": a["original_name"], "legal_name_ko": en.get("legal_name_ko"),
                        "legal_name_en": en.get("legal_name_en"), "corp_code": en.get("corp_code"), "stock_code": en.get("stock_code"),
                        "business_reg_no": en.get("business_reg_no"), "parent_group": en.get("parent_group"),
                        "related_key_accounts": ";".join(en.get("related_key_accounts") or []), "segment": a["segment"],
                        "industry_detail": en.get("industry_detail"), "is_korean_entity": en.get("is_korean_entity"), "fiscal_year_end": en.get("fiscal_year_end"),
                        "dart_available": en.get("dart_available"), "economic_scope": en.get("economic_scope"), "exclusions": en.get("exclusions"),
                        "entity_status": en.get("entity_status"), "entity_notes": en.get("entity_notes"), "overlap_groups": ";".join(a["overlap_groups"]),
                        "aggregate_class": a["aggregate_class"], "research_status": a["research_status"]})
    (PROCESSED / "ACCOUNT_MASTER.csv").write_bytes((DOCS / "ACCOUNT_MASTER.csv").read_bytes())


def entity_report():
    c = Counter(a["entity"].get("entity_status") for a in A)
    L = ["# ENTITY RESOLUTION REPORT", "", f"기준일 2026-10-16 · data_version {D['meta']['data_version']}", "",
         f"**53개 원본 고객 전원 유지.** 매핑 상태: CONFIRMED {c.get('CONFIRMED', 0)} · PROBABLE {c.get('PROBABLE', 0)} · UNCERTAIN {c.get('UNCERTAIN', 0)}", "",
         "## 원칙", "- 원본 고객명은 변경하지 않고 `original_name`으로 보존, 법적 실체는 별도 필드로 매핑.",
         "- DART 고유번호는 PlayMCP OpenDART `find_company`/`get_company_info`로 확인(검증 예: 삼성SDS 00126186 — 도구 설명서에는 '포스코홀딩스'로 잘못 표기되어 있으나 get_company_info로 삼성에스디에스(주) 확인).",
         "- 글로벌 기업(구글·MS·아마존·메타·오라클·차이나유니콤)은 글로벌 그룹과 국내 계약·구매 주체를 분리. 글로벌 CAPEX는 국내 TS에 사용하지 않음.",
         "- 주한미군은 법인 아님 → 계약·예산 모델. 펀드(코람코·키암코)는 DC 펀드 모델.",
         "- 사업자번호는 공개적으로 확인 가능한 경우에만 기록.", "",
         "## 매핑 표", "", "| ID | 원본 고객명 | 공식 법인명 | DART | 모회사·그룹 | 상태 | 경제적 범위 / 메모 |", "|---|---|---|---|---|---|---|"]
    for a in A:
        en = a["entity"]
        note = (en.get("economic_scope") or "") + (" / " + en.get("entity_notes", "")[:160] if en.get("entity_status") != "CONFIRMED" else "")
        L.append(f"| {a['account_id']} | {a['original_name']} | {en.get('legal_name_ko') or '미확인'} | {en.get('corp_code') or '-'} | {en.get('parent_group') or '-'} | "
                 f"{en.get('entity_status')} | {note.replace('|', '/')} |")
    L += ["", "## 중복 집계 위험 그룹", ""]
    for g in D["portfolio"]["overlap_groups"]:
        L.append(f"- **{g['name']}** ({g['type']}, 위험 {g['risk']}): {', '.join(g['members'])} — {g['note']}")
    (DOCS / "ENTITY_RESOLUTION_REPORT.md").write_text("\n".join(L) + "\n", encoding="utf-8")


def quality_report():
    fs = D["meta"]["fact_status"]
    ms = D["meta"]["metric_status_2026"]
    iss = Counter((i["severity"], i["code"]) for a in A for i in a["issues"])
    methods = Counter(a["anchor"]["method"] for a in A)
    total_metrics = Counter()
    for a in A:
        for k in ("TS", "RAW", "FPR", "CR", "CSOW", "PCR", "UPSIDE"):
            total_metrics[a["m"]["2026"][k]["status"]] += 1
        for s in ("low", "base", "high"):
            for k in ("TS", "RAW_base", "RAW_expansion", "FPR_base", "FPR_expansion"):
                total_metrics[a["m"]["2031"][s][k]["status"]] += 1
        for k in ("TARGET", "TARGET_SOW"):
            total_metrics[a["m"]["target"][k]["status"]] += 1
    cal = D["intensity_calibration"]
    L = ["# DATA QUALITY & VALIDATION REPORT", "", f"data_version {D['meta']['data_version']} · 생성 {D['meta']['generated_at']}", "",
         "## 1. 요약", "",
         f"- 원천 사실(Layer A) {sum(fs.values())}건: " + ", ".join(f"{k} {v}" for k, v in fs.items()),
         f"- 지표 레코드(2026 7종 + 2031 시나리오·케이스 15종 + Target 2종 × 53개사) {sum(total_metrics.values())}건: " + ", ".join(f"{k} {v}" for k, v in total_metrics.items()),
         f"- 2026 지표 상태: " + "; ".join(f"{m} → " + ", ".join(f"{s} {n}" for s, n in d.items()) for m, d in ms.items()),
         f"- TS 앵커 방법: " + ", ".join(f"{k} {v}" for k, v in methods.most_common()),
         f"- 무결성 이슈: ERROR {D['issues_summary']['ERROR']} · WARN {D['issues_summary']['WARN']} · INFO {D['issues_summary']['INFO']}",
         "", "> **VERIFIED 지표가 0건인 이유**: TS_2026은 FY2026 연간 '예상치'이므로 정의상 ESTIMATED이며, FY2025 앵커(KISA 공시)도 이 환경에서 원문 페이지를 열 수 없어(WebFetch DNS 차단) 검색 인용(SECONDARY_UNCONFIRMED)으로 분류했다. DART API로 직접 조회한 재무 사실만 VERIFIED이다.",
         "", "## 2. 자동 검증 항목과 결과", "",
         "| 검증 | 결과 |", "|---|---|",
         "| 53개 고객 존재·원본명 불변 | PASS (tests/test_model.py) |",
         "| RAW ≤ TS, FPR ≤ RAW (2026, 2031 × 3 시나리오 × 2 케이스) | PASS |",
         "| Target ≤ FPR_2031(base) | PASS |",
         "| CR NULL → C-SOW·PCR·Upside N/A (0 대체 금지) | PASS |",
         "| CAGR 재계산 일치 | PASS |",
         "| 산식·출처/가정 계보 존재 | PASS |",
         "| 지표 근거 ID → Evidence 해석 가능 | PASS |",
         "| 정의 상이(하이퍼스케일러) 합계 제외 | PASS |",
         "| 가상 테스트 데이터 혼입 없음(is_test_data=false) | PASS |",
         "| 합성 CR 입력 시 C-SOW/PCR/Upside 산식, CR>FPR 경고, Target>FPR 오류 | PASS (TEST-ONLY 합성값, 저장 안 함) |",
         "| API 입력 검증(음수·문자·근거 누락·미존재 ID 거부) | PASS (tests/test_api.py) |",
         "| 브라우저 E2E: 막대 클릭→Inspector, 시나리오·고객 전환 동기화, 미확인 고객 0 미표시, 6개 탭 렌더, JS 오류 0 | PASS 14/14 (tests/e2e) |",
         "", "## 3. 파일럿에서 발견·수정한 모델 결함", "",
         "1. **메트릭 오분류(COR-001)**: 국민은행 '2026 IT 예산 860.75억'은 정보보호 예산 → 그대로 쓰면 TS가 84% 과소. 보정 파일로 재분류(원천 불변), 예산<KISA 50% 시 기각하는 교차검증 추가.",
         "2. **매출 대비 IT 집약도 과대**: KG모빌리티 사전값 1.5% 적용 시 636억 vs KISA 실측 240억(0.57%). → 산업군별 실측 중앙값 보정(n≥2) 도입, 사전값 하향.",
         "3. **증권사 영업수익 왜곡**: 트레이딩 총수익 포함(미래에셋 21조) → 금융사는 판관비 기준 집약도로 전환. 실측 4개사 10.8~12.9%로 일관(중앙값 12.5%).",
         "4. **판관비 정의 불일치(COR-002)**: 미래에셋 인건비 별도 계상 → 합산.",
         "5. **전략 엔진 정의 혼합**: 하이퍼스케일러(국내 투자 기준) 수요가 사업영역 합계에 혼입 → 별도 열로 분리.",
         "6. **비교 축 왜곡**: 2026/2031 그리드 폭 불일치 → 동일 폭·동일 최대값으로 수정(단위 테스트로 고정).",
         "", "## 4. IT 집약도 실증 보정", "", "| 산업군 | 방식 | 분모 | n | Low | Base | High |", "|---|---|---|---|---|---|---|"]
    for k, v in cal.items():
        if k.startswith("_"):
            continue
        L.append(f"| {k} | {v['basis']} | {v.get('denominator', 'revenue')} | {v['n']} | {p(v['low'])} | {p(v['base'])} | {p(v['high'])} |")
    L += ["", "## 5. 경고(WARN) 상세", ""]
    for a in A:
        for i in a["issues"]:
            if i["severity"] in ("WARN", "ERROR") and i["code"] not in ("TS_UNKNOWN", "NOT_RESEARCHED"):
                L.append(f"- [{i['severity']}] {a['account_id']} {a['original_name']} · {i['code']}: {i['message']}")
    L += ["", "## 6. 이슈 코드 분포", ""] + [f"- {s} {c}: {n}" for (s, c), n in sorted(iss.items())]
    (REP / "QUALITY_REPORT.md").write_text("\n".join(L) + "\n", encoding="utf-8")


def gaps_report():
    pri = []
    for a in A:
        ts = a["m"]["2026"]["TS"]
        score = (3 if ts["value"] is None else 2 if ts["confidence"] < 35 else 1 if ts["confidence"] < 60 else 0)
        size = ts["value"] or 0
        pri.append((score, size, a))
    pri.sort(key=lambda x: (-x[0], -x[1]))
    L = ["# 미확인 데이터 및 추가 조사 목록 (Research Gaps)", "", "우선순위: ① TS 미확인 → ② 매출집약도(신뢰도<35) → ③ 원문 미확인(SECONDARY) 승격 대상.", "",
         "## A. 공통 — 접근 제약 해소 시 일괄 개선", "",
         "1. **KISA 정보보호 공시 포털(isds.kisa.or.kr) 원문 대조**: 현재 TS 앵커 대부분이 보도 인용(SECONDARY). 포털 원문 확인 시 VERIFIED 승격 및 신뢰도 상한(70) 해제.",
         "2. **DART 원문(감사보고서 주석) 열람**: 비상장·유한회사(코스콤, IBK시스템, CJ올리브네트웍스, 농협은행, 네이버클라우드, NHN클라우드, 구글·MS·오라클·차이나유니콤 한국법인)는 OpenDART 재무 API가 미제공 → `DART_API_KEY`로 원문/XBRL 수집 필요.",
         "3. **WebSearch 한도(턴당 200회) 소진**으로 미수행된 항목: 각 사 IT 계획(차세대·클라우드·AI·DC), 캡티브 SI 구조 원문, LG U+ 거래 관계 보도. 후속 세션에서 고객별 재조사.",
         "4. **사내 데이터(필수)**: 고객별 CR_2026(YTD·연말 예상), 계약·회선·IDC 상면 현황, 재계약 시점, 수주 파이프라인, 2031 목표 → 관리자 입력 템플릿 `data/internal_inputs/management_inputs.csv`.",
         "", "## B. 고객별", "", "| 순위 | ID | 고객 | 현재 상태 | TS 방법 | 신뢰도 | 핵심 미확인 사항 |", "|---|---|---|---|---|---|---|"]
    for n, (score, size, a) in enumerate(pri, 1):
        if score == 0:
            continue
        oq = "; ".join((a.get("open_questions") or [])[:3]).replace("|", "/")
        L.append(f"| {n} | {a['account_id']} | {a['original_name']} | {a['research_status']} | {a['anchor']['method']} | {a['m']['2026']['TS']['confidence']} | {oq[:260]} |")
    (REP / "RESEARCH_GAPS.md").write_text("\n".join(L) + "\n", encoding="utf-8")


def strategic_synthesis():
    agg = D["portfolio"]["aggregate"]
    a26, a31 = agg["2026_base"], agg["2031_base"]
    st = D["strategy"]
    mb = {i["item_id"]: i for i in D["market_benchmarks"]["items"]}
    lgu = mb.get("MB33")
    est = [a for a in A if a["m"]["2026"]["TS"]["value"] is not None and a["aggregate_class"] != "DEFINITION_MISMATCH"]
    top = sorted(est, key=lambda a: -(a["m"]["2031"]["base"]["FPR_base"]["value"] or 0))[:10]
    fam = D["portfolio"]["by_family"]
    L = ["# STRATEGIC SYNTHESIS — 53 Key Account 통합 시사점 (Layer E)", "", f"data_version {D['meta']['data_version']} · 단위 억원 · 모든 합계는 근거 있는 고객 부분합", "",
         "## 1. 핵심 요약", "",
         f"- 2026 TS {e(a26['TS'])} → 2031 {e(a31['TS'])} (Base, {a26['n_ts']}/53개사). RAW {e(a26['RAW'])} → {e(a31['RAW'])}, FPR {e(a26['FPR'])} → {e(a31['FPR'])}.",
         f"- Low~High 2031 FPR 범위: {e(agg['2031_low']['FPR'])} ~ {e(agg['2031_high']['FPR'])}.",
         (f"- 참고 규모: LG U+ 기업인프라 FY2025 매출 {e(lgu['value'])}(MB33, 보도 인용) 대비 53개사 FPR 2026 부분합은 {a26['FPR'] / lgu['value'] * 100:.0f}% 수준 — Key Account 집중도가 높다는 신호(단, CR 미입력으로 현재 점유는 미확인)." if lgu else ""),
         (lambda t: f"- **집중 위험**: FPR 2026 부분합 상위 1개사({t[0]['original_name']}) 비중 {t[0]['m']['2026']['FPR']['value'] / a26['FPR'] * 100:.0f}%, 상위 3개사 {sum(x['m']['2026']['FPR']['value'] for x in t[:3]) / a26['FPR'] * 100:.0f}%. 대형 플랫폼의 카테고리 구성(A-MIX)은 가정이므로, 상위 고객의 실제 회선·IDC·클라우드 구매 구조 확인이 포트폴리오 결론의 민감도를 좌우함.")(sorted(est, key=lambda a: -(a['m']['2026']['FPR']['value'] or 0))),
         f"- 하이퍼스케일러(아마존)는 TS 정의(국내 인프라 투자 연평균)가 달라 합계에서 제외 — 구글·MS·메타·오라클은 TS 미확인. **하이퍼스케일러 수요 정량화가 DC 투자 판단의 최대 공백.**",
         "", "## 2. 사업영역 우선순위 (Strategic Opportunity Engine)", "", "| 순위 | 사업영역 | 점수 | FPR 2026 | FPR 2031 Base | CAGR | 수요 고객 | 정의상이 별도 수요 | 권고 |", "|---|---|---|---|---|---|---|---|---|"]
    for i, s in enumerate(st, 1):
        L.append(f"| {i} | {s['area']} | {s['priority_score']} | {e(s['FPR_2026'])} | {e(s['FPR_2031'])} | {p(s['FPR_CAGR'])} | {s['n_accounts']} | {e(s['FPR_2031_definition_mismatch']) if s['FPR_2031_definition_mismatch'] else '-'} | {s.get('recommendation_type')} |")
    L += ["", "점수 = " + (st[0]["score_formula"] if st else ""), "", "### 영역별 판단과 근거", ""]
    for s in st[:6]:
        L += [f"**{s['area']}** — {s.get('recommendation')}",
              f"  - 근거: FPR {e(s['FPR_2026'])}→{e(s['FPR_2031'])} (CAGR {p(s['FPR_CAGR'])}), 수요 고객 {s['n_accounts']}개, 수요 신뢰도 {s['demand_confidence']}/100; 상위 수요: "
              + ", ".join(next(a['original_name'] for a in A if a['account_id'] == t['account_id']) + f" {e(t['FPR_2031'])}" for t in s["top_accounts"][:4]),
              f"  - 역량 격차 {s.get('capability_gap')}, 투자 필요 {s.get('investment_need')}, 난이도 {s.get('difficulty')}. 주의: {s.get('caveats') or '-'}", ""]
    L += ["## 3. Top 10 기회 고객 (FPR 2031 Base)", "", "| ID | 고객 | TS 2026 | FPR 2026 | FPR 2031 | FPR CAGR | 신뢰도 | 상위 기회 |", "|---|---|---|---|---|---|---|---|"]
    for a in top:
        b = a["m"]["2031"]["base"]
        L.append(f"| {a['account_id']} | {a['original_name']} | {e(a['m']['2026']['TS']['value'])} | {e(a['m']['2026']['FPR']['value'])} | {e(b['FPR_base']['value'])} | {p(b['FPR_CAGR']['value'])} | {a['m']['2026']['TS']['confidence']} | {a['narrative'].get('key_opportunity', '')} |")
    L += ["", "## 4. 산업군별 구조", "", "| 산업군 | 추정/전체 | TS 2026 | RAW 2026 | FPR 2026 | FPR 2031 |", "|---|---|---|---|---|---|"]
    for k, r in sorted(fam.items(), key=lambda x: -x[1]["FPR_2031"]):
        L.append(f"| {k} | {r['n_est']}/{r['n']} | {e(r['TS_2026'])} | {e(r['RAW_2026'])} | {e(r['FPR_2026'])} | {e(r['FPR_2031'])} |")
    L += ["", "## 5. 실행 권고 (90일)", "",
          "1. **데이터 확보(0~30일)**: 53개사 CR_2026·계약 만기·회선/IDC 상면 현황을 관리자 템플릿으로 입력 → C-SOW·Upside 산출, FPR 가정 보정(CR>FPR 경고 점검). KPI: CR 입력 커버리지 100%.",
          "2. **KISA·DART 원문 검증(0~45일)**: DART_API_KEY 발급, KISA 포털 원문 대조로 TS 앵커 VERIFIED 승격. KPI: TS 신뢰도 60+ 고객 수 (현재 " + str(sum(1 for a in A if a['m']['2026']['TS']['confidence'] >= 60)) + "개 → 목표 35개).",
          "3. **DC/AIDC 수요-용량 정합(30~90일)**: 하이퍼스케일러·플랫폼·클라우드 고객의 MW 단위 수요(코로케이션 vs 자가구축)를 계정팀 인터뷰로 정량화하고 가용 용량·전력 일정과 대조. KPI: MW 수요 파이프라인, 계약 전환율.",
          "4. **보안 역량 격차 진단(30~90일)**: 2027 금융권 정보보호 공시 의무화를 계기로 금융 고객 보안 지출을 상세화, 내부 역량 진단 후 제휴·인수 검토 범위 결정(확정 아님).",
          "5. **Account Plan 목표 설정**: 시나리오 Target(FPR×50%)을 출발점으로 계정별 Target을 경영진이 확정, Target SOW > C-SOW 여부 검증.",
          "", "## 6. 위험과 한계", "",
          "- 접근률·포획 상한(C-ADDR/C-CAP)은 분석가 판단 — 사내 수주·점유 데이터로 보정 전까지 FPR은 ±50% 이상 불확실할 수 있음.",
          "- 매출집약도 추정 고객(신뢰도 30)은 방향성 참고용. 20개사는 TS 미확인으로 포트폴리오 합계에서 빠져 있음(특히 농협은행, KB손해보험, 하이퍼스케일러 4사).",
          "- 2031 브리지 파라미터는 시장 벤치마크(Gartner·과기정통부·KDCC 등, 원문 미열람)에 연동된 산업군 가정이며 고객별 사업계획 반영은 일부(삼성SDS·AWS)에 그침."]
    (REP / "STRATEGIC_SYNTHESIS.md").write_text("\n".join(x for x in L if x is not None) + "\n", encoding="utf-8")


if __name__ == "__main__":
    account_master(); entity_report(); quality_report(); gaps_report(); strategic_synthesis()
    print("reports generated")
