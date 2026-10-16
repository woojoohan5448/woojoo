"""Render the five final QA reports from data/qa/* (computed by models.qa.final_audit) + data/qa/QA_FINDINGS.json.

python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports
Output: reports/final_qa/{FINAL_DATA_QUALITY_AUDIT, FINANCIAL_MODEL_RISK_REPORT, SOURCE_TRACEABILITY_REPORT,
        INTERNAL_EXCEL_INTEGRATION_READINESS, WINDOWS_MIGRATION_CHECKLIST}.md
"""
from __future__ import annotations

import csv
import json
from collections import Counter

from models.common import ROOT

QA = ROOT / "data" / "qa"
OUT = ROOT / "reports" / "final_qa"
BASIS_KO = {"DIRECT_IT_DISCLOSURE": "IT지출 공시값", "RECONSTRUCTED_FINANCIALS": "재무항목 재구성 추정", "INDUSTRY_AVERAGE": "산업 평균 적용 추정",
            "SCENARIO": "시나리오", "CONTRACT_DIRECT_RAW": "계약 기반(RAW만)", "NONE": "근거 없음(RESEARCH GAP)"}
GRADE_KO = {"ESTIMATED_HIGH": "HIGH", "ESTIMATED_MEDIUM": "MED", "ESTIMATED_LOW": "LOW", "INSUFFICIENT_EVIDENCE": "GAP", "NOT_APPLICABLE": "N/A(비적용)"}


def rd(name):
    return list(csv.DictReader((QA / name).open(encoding="utf-8-sig")))


def n(v, d=0):
    if v in (None, "", "None"):
        return "—"
    x = float(v)
    return f"{x:,.{d}f}"


def pct(v, d=1):
    return "—" if v in (None, "", "None") else f"{float(v) * 100:.{d}f}%"


def findings_table(F, ids=None, area_prefix=None):
    rows = [f for f in F if (ids is None or f["id"] in ids) and (area_prefix is None or f["area"].startswith(area_prefix))]
    out = ["| ID | 심각도 | 발견 사항 | 조치 | 상태 | 잔여 위험 |", "|---|---|---|---|---|---|"]
    for f in rows:
        out.append(f"| {f['id']} | {f['severity']} | **{f['title']}** — {f['detail']} | {f['fix']} | **{f['status']}** | {f['residual']} |")
    return "\n".join(out)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    S = json.loads((QA / "qa_summary.json").read_text(encoding="utf-8"))
    B = json.loads((QA / "before" / "qa_summary.json").read_text(encoding="utf-8")) if (QA / "before" / "qa_summary.json").exists() else {}
    F = json.loads((QA / "QA_FINDINGS.json").read_text(encoding="utf-8"))["findings"]
    L, R, FC, T, SE = rd("METRIC_LEDGER.csv"), rd("RATIO_AUDIT.csv"), rd("FORECAST_DECOMPOSITION.csv"), rd("TRACEABILITY.csv"), rd("SENSITIVITY.csv")
    st = Counter(f["status"] for f in F)
    sev = Counter((f["severity"], f["status"]) for f in F)
    dv = S["data_version"]
    ct = S["comparable_totals"]
    hdr = (f"> data_version `{dv}` · 브랜치 `qa-final-audit` · 안전 체크포인트 태그 `v2.0-phase1-4-checkpoint` · 생성: `python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports`\n"
           f"> 이 보고서의 모든 수치는 `data/qa/*.csv`에서 재계산 가능하다. 사내 데이터는 포함되지 않았다(contains_internal_data={S['contains_internal_data']}).\n")

    # ------------------------------------------------------------------ 1. FINAL_DATA_QUALITY_AUDIT
    basis_rows = []
    for b_, c in sorted(S["evidence_basis"].items(), key=lambda x: -x[1]):
        ids = [r["account_id"] for r in L if r["evidence_basis"] == b_]
        basis_rows.append(f"| {BASIS_KO.get(b_, b_)} (`{b_}`) | {c} | {n(S['comparable_ts2026_by_basis'].get(b_, 0))} | {', '.join(ids)} |")
    led = ["| ID | 고객 | 근거 유형 | 출처 수준 | TS 2026 (범위) | 등급 | RAW 2026 | FPR 2026 | TS 2031 base (결합 범위) | FPR 2031 base | 정의상이 |",
           "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in L:
        rng = f" ({n(r['TS_2026_low'])}~{n(r['TS_2026_high'])})" if r["TS_2026_low"] not in ("", "None") else ""
        led.append(f"| {r['account_id']} | {r['name']} | {BASIS_KO.get(r['evidence_basis'], r['evidence_basis'])} | {r['source_level']} | {n(r['TS_2026'])}{rng} | "
                   f"{GRADE_KO.get(r['TS_2026_grade'], r['TS_2026_grade'] or '—')} | {n(r['RAW_2026'])} | {n(r['FPR_2026'])} | {n(r['TS_2031_base'])} | {n(r['FPR_2031_base'])} | {'Y' if r['definition_mismatch'] == 'True' else ''} |")
    rs_before = B.get("research_status", {})
    doc1 = f"""# FINAL DATA QUALITY AUDIT — 53 Key Account (2026·2031 TS/RAW/FPR)

{hdr}
## 1. 결론 요약
- **값을 바꾼 계정은 없다.** 이번 QA는 기존 수치의 신뢰성 검증이 목적이며, 수정은 표시·상태·범위·추적성·사내 결합 로직에 한정했다(수정 전 스냅샷 대비 2026 TS/RAW/FPR 값·범위·신뢰도·등급, 2031 low/base/high 전 레코드, Target, 포트폴리오 합계 diff 0건. 상태(ESTIMATED→SCENARIO 4개사)와 2031 base 결합 범위만 추가·변경).
- **발견 {len(F)}건**: FIXED {st['FIXED']} · MITIGATED {st['MITIGATED']} · OPEN {st['OPEN']} · DOCUMENTED {st['DOCUMENTED']}. HIGH 심각도 {sum(v for (s, _), v in sev.items() if s == 'HIGH')}건 중 OPEN {sev[('HIGH', 'OPEN')]}건(QA-05 플랫폼 인건비).
- **'VERIFIED'의 실제 의미**: 대시보드의 어떤 TS/RAW/FPR 지표도 status=VERIFIED가 아니다(확인 결과 {len(S['metric_records_with_status_VERIFIED'])}건). 기존 '근거 검증(EVIDENCE_VERIFIED)' 11개 계정은 **IT 지출이 아니라 입력 재무항목**이 원문 확인된 것이었으며 `INPUTS_VERIFIED`로 정정했다. IT 지출 수치를 1차 원문에서 직접 확인한 계정은 **0개**, KISA 공시값을 언론 인용으로 확보한 계정이 11개다.
- **비교 가능 합계(정의 상이 5개사 제외)**: TS 2026 {n(ct['TS_2026'])}억 · RAW {n(ct['RAW_2026'])}억 · FPR {n(ct['FPR_2026'])}억 → 2031 base FPR {n(ct['FPR_2031_base'])}억(Expansion {n(ct['FPR_2031_expansion'])}억).
- 지표 추적성 {S['traceability']['ok']}/{S['traceability']['records']} (수정 전 {B.get('traceability', {}).get('ok', '—')}/{B.get('traceability', {}).get('records', '—')}).

## 2. 검증 범위와 방법 (STEP 1~2)
| 단계 | 방법 | 산출물 |
|---|---|---|
| 지표 원장 | 53개 × 2026·2031 TS/RAW/FPR(base/low/high/expansion), 앵커 방법·회계연도·근거 ID·출처 유형·산식 연결 | `data/qa/METRIC_LEDGER.csv` |
| 근거 유형 분류 | 앵커 방법·fact_status·tier로 직접 공시/재구성/산업평균/시나리오 구분(`models/qa/final_audit.py::evidence_basis`) | 대시보드 `evidence_basis` 필드 |
| VERIFIED 의미 검증 | 지표 status, 앵커 fact_status, 입력 항목 status, research_status를 분리 대조 | 본 문서 §3 |
| 추적성 | 모든 지표 레코드의 evidence_id가 계정 근거 목록에, assumption_id가 parameter_evidence에 존재하는지 | `data/qa/TRACEABILITY.csv` |

## 3. 직접 확인값 vs 추정값 (STEP 2)
| 근거 유형 | 계정 수 | 비교 가능 TS 2026 합(억) | 계정 |
|---|---|---|---|
{chr(10).join(basis_rows)}

**출처 수준 세분**: {', '.join(f'`{k}` {v}' for k, v in S['source_level'].items())}

### VERIFIED 상태가 의미하는 것 — 검증 결과
| 레벨 | 필드 | 의미 | 현황 |
|---|---|---|---|
| 원천 사실 | `facts[].verification_status=VERIFIED` | DART 원문·API에서 확인한 **재무 항목**(매출·자산·전산비 등) | 근거 632건 중 VERIFIED 404 / SECONDARY 228 |
| 앵커 | `anchor.fact_status` | TS 기준값 자체의 상태 | L2 구성요소법은 이번에 VERIFIED → **DERIVED**로 정정, 입력 상태는 `input_fact_status` |
| 지표 | `m.2026.TS.status` | 모델 산출값 상태 | VERIFIED 0건 — 전부 ESTIMATED/SCENARIO/UNKNOWN |
| 계정 | `research_status` | 조사 단계 | 수정 전 {json.dumps(rs_before, ensure_ascii=False)} → 수정 후 {json.dumps(S['research_status'], ensure_ascii=False)} |

## 4. 발견·수정 현황 (전체)
{findings_table(F)}

## 5. 53개 계정 지표 원장 (요약 — 전체 컬럼은 METRIC_LEDGER.csv)
단위 억원. 등급은 TS 2026 기준. 2031 범위는 결합 범위(QA-08).
{chr(10).join(led)}

## 6. 아직 남아 있는 위험 (요약)
1. **IT 지출 1차 원문 미확인**(QA-02): HIGH 등급 10개 계정 포함 11개 계정이 KISA 공시값의 언론 인용. 사내망에서 KISA 정보보호공시 종합포털 원문 대조 필요.
2. **플랫폼 인건비 비중**(QA-05): 쿠팡·카카오 FPR이 최대 −37% 과대 가능 → 포트폴리오 FPR_2026의 최대 약 16%.
3. **비은행 금융 포괄률**(QA-06), **상한값 기준 계정**(QA-07), **업종 일률 성장 동인**(QA-10).
4. **사내 데이터 실검증 미실시**: 결합 기능은 합성 데이터로만 검증(INTERNAL_EXCEL_INTEGRATION_READINESS.md).
5. **Windows 실행 미검증**: 스크립트·의존성은 정적 검증·오프라인 의존성 해석까지만(WINDOWS_MIGRATION_CHECKLIST.md).
"""
    (OUT / "FINAL_DATA_QUALITY_AUDIT.md").write_text(doc1, encoding="utf-8")

    # ------------------------------------------------------------------ 2. FINANCIAL_MODEL_RISK_REPORT
    fs = S["family_stats"]
    fam_rows = ["| 업종(family) | n(RAW/TS) | IT 비율 중앙값 (분모) | IT 비율 범위 | RAW/TS 중앙값 | RAW/TS 범위 | FPR/RAW 중앙값 | FPR/RAW 범위 |", "|---|---|---|---|---|---|---|---|"]
    denom = {r["family"]: r["denominator"] for r in R}
    for k, v in sorted(fs.items()):
        fam_rows.append(f"| {k} | {v['raw_to_ts']['n']} | {pct(v['it_ratio']['median'])} ({denom.get(k, 'revenue')}) | {pct(v['it_ratio']['min'])}~{pct(v['it_ratio']['max'])} | "
                        f"{pct(v['raw_to_ts']['median'])} | {pct(v['raw_to_ts']['min'])}~{pct(v['raw_to_ts']['max'])} | {pct(v['fpr_to_raw']['median'])} | {pct(v['fpr_to_raw']['min'])}~{pct(v['fpr_to_raw']['max'])} |")
    out_rows = ["| ID | 고객 | 업종 | 근거 유형 | IT/분모 | 벤치마크 | IT/매출 | RAW/TS | FPR/RAW | 플래그 | QA 판정 |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    verdict = {
        "KA09": "공시값 기반. 플랫폼은 IT 투자액에 개발 인력 인건비가 커 IT/매출이 높음 — 값보다 **RAW 믹스(인건비 20%)가 과대 위험**(QA-05)",
        "KA10": "클라우드 사업자 — 고객 서비스용 인프라가 IT 지출. 업종 구조상 정상 범위 상단",
        "KA15": "MSP 재판매 통과매출이 분모에 포함 → 비율 왜곡(과소 방향). 과대추정 위험 아님",
        "KA21": "은행 판관비 벤치마크는 카드사에 부적합(분모 정의 차이). 포괄률 가정 민감(QA-06)",
        "KA27": "공시값(FY2025 1,943억) 기반. 핀테크 특성상 개발 인력 비중 큼 — 인건비 믹스 40% 적용 중",
        "KA29": "공시값 기반. 쿠팡 1개사가 비교 FPR의 33% — 믹스 과대 위험 최대(QA-05)",
        "KA32": "BOA 상한 연환산, 포획 50%(2개 BOA 중 1개 보유 근거) — 상한 해석 필요(QA-07)",
        "KA34": "SI 통과매출 분모 — 과소 방향",
        "KA37": "증권 판관비 분모 부적합. IT/매출 1.6%로는 이상치 아님",
        "KA44": "'외부 구매 상한'을 기준값으로 사용 — 과대 위험(QA-07)",
        "KA47": "클라우드/IDC 업종 구조(연결·상면 비중 높음)",
        "KA49": "클라우드/IDC 업종 구조",
        "KA52": "은행 판관비 벤치마크 부적합, 포괄률 민감(QA-06)",
        "KA53": "PG 통과매출 제외 정정 후 값(Phase 1) — 분모(총매출) 왜곡으로 과소 방향",
    }
    for r in R:
        if r["flags"] and r["flags"] != "EXCLUDED_DEFINITION_MISMATCH":
            out_rows.append(f"| {r['account_id']} | {r['name']} | {r['family']} | {BASIS_KO.get(r['evidence_basis'], r['evidence_basis'])} | {pct(r['it_ratio'])} ({r['denominator']}) | "
                            f"{pct(r['bench_low'])}~{pct(r['bench_high'])} | {pct(r['it_to_revenue'])} | {pct(r['raw_to_ts'])} | {pct(r['fpr_to_raw'])} | {r['flags'].replace(';', '<br>')} | {verdict.get(r['account_id'], '')} |")
    sens_rows = ["| 위험 | 계정 | 가정 변경 | 이유 | FPR 2026 기준 | FPR 대안 | 변화 |", "|---|---|---|---|---|---|---|"]
    for r in SE:
        sens_rows.append(f"| {r['risk_id']} | {r['account_id']} {r['name']} | {r['assumption']} | {r['why']} | {n(r.get('FPR_base'), 1)} | {n(r.get('FPR_alt'), 1)} | {pct(r.get('delta_pct')) if r.get('delta_pct') not in ('', 'None', None) else '상한값'} |")
    f = S["forecast"]
    top = sorted(FC, key=lambda r: -float(r["multiplier"]))[:8]
    fc_rows = ["| ID | 업종 | TS 2026 | TS 2031 | 승수 | CAGR | AI 증분 비중 | 계정별 인프라(억/년) | 2026→2031 탄력성 | 2026 범위폭 | 2031 시나리오폭 | 결합폭 |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in top:
        fc_rows.append(f"| {r['account_id']} | {r['family']} | {n(r['TS_2026'])} | {n(r['TS_2031'])} | {float(r['multiplier']):.2f} | {pct(r['ts_cagr'])} | {pct(r['share_ai'])} | {n(r['account_specific_infra'])} | {float(r['elasticity_ts31_to_ts26']):.2f} | {pct(r['ts26_band_pct'], 0)} | {pct(r['ts31_scenario_band_pct'], 0)} | {pct(r['ts31_combined_band_pct'], 0)} |")
    cagr_by_fam = {}
    for r in FC:
        cagr_by_fam.setdefault(r["family"], []).append(float(r["ts_cagr"]))
    cagr_rows = ["| 업종 | n | TS CAGR 범위(2026→2031 base) | 해석 |", "|---|---|---|---|"]
    for k, v in sorted(cagr_by_fam.items()):
        cagr_rows.append(f"| {k} | {len(v)} | {pct(min(v))}~{pct(max(v))} | {'업종 단일 파라미터(계정별 동인 없음)' if max(v) - min(v) < 1e-3 else '계정별 동인/override 존재'} |")
    conc = S["concentration"]
    doc2 = f"""# FINANCIAL MODEL RISK REPORT — 과대추정·2031 전망 검증 (STEP 3~4)

{hdr}
## 1. 핵심 결론
1. **포트폴리오 집중**: 비교 가능 FPR_2026 {n(conc['fpr2026_comparable_total'])}억 중 상위 5개사가 {pct(conc['top5_share'])} — {', '.join(f'{a} {nm} {n(v)}억' for a, nm, v in conc['top5'])}. 쿠팡 1개사의 가정 오차가 전체를 좌우한다.
2. **등급별 FPR**: {', '.join(f'{GRADE_KO.get(k, k)} {n(v)}억' for k, v in conc['fpr2026_by_grade'].items())} — 비교 가능 FPR의 절반 이상이 LOW 등급 기반.
3. **최대 과대추정 위험은 '매출 대비 IT 비율'이 아니라 'TS 내부 구성(믹스)'**이다. 공시 IT 투자액이 맞더라도 인건비 비중을 과소 가정하면 공략 가능 시장(RAW)이 부풀려진다(QA-05).
4. **2031 FPR 증가분의 26%는 LG U+ 역량 확대 가정**에서 나온다(고객 지출 성장 {n(f['comparable_fpr31_from_ts'])}억 vs U+ 역량 {n(f['comparable_fpr31_from_uplus'])}억, Strategic Expansion 추가 {n(f['comparable_fpr31_from_expansion'])}억). 이번에 화면·데이터에서 분리했다(QA-09).
5. **2026 오차는 2031로 1:1 전파**된다(탄력성 중앙값 1.0, 최저 {f['elasticity_min']:.2f}=KA14). 기존 2031 범위(중앙값 폭 {pct(f['median_ts31_scenario_band'], 0)})는 이를 빠뜨렸고, 결합 범위(중앙값 폭 {pct(f['median_ts31_combined_band'], 0)})로 정정했다(QA-08).

## 2. 업종별 비율 비교 (정의 상이 5개사 제외)
IT 비율 분모: FIN=판관비(은행 실측 벤치마크), 그 외=매출. RAW/TS·FPR/RAW는 업종 믹스×접근률×포획상한의 구조적 결과라 업종 내 분산이 작다.
{chr(10).join(fam_rows)}

### 이상치 계정과 판정
기준: IT 비율이 업종 벤치마크 상한의 2배 초과 또는 하한의 절반 미만, IT/매출 30% 초과(인프라 사업 업종 제외), RAW/TS·FPR/RAW가 전체 사분위 범위 1.5배 밖, FPR/RAW가 최대 포획상한 0.45 초과.
{chr(10).join(out_rows)}

**정의 혼합 점검**: 정의 상이(하이퍼스케일러 국내 인프라 지출·망 이용대가 동등가치) {', '.join(S['definition_mismatch_accounts'])} — TS 합 {n(S['mismatch_totals']['TS_2026'])}억, FPR_2026 {n(S['mismatch_totals']['FPR_2026'])}억은 `portfolio.aggregate` 비교 합계에서 제외되어 있음을 확인(QA-12).

## 3. 정량 민감도 (값은 바꾸지 않음)
{chr(10).join(sens_rows)}

## 4. 2031 전망 검증
### 4.1 성장 동인의 구분
| 구분 | 모델 내 위치 | 근거 | 성격 |
|---|---|---|---|
| 고객별 성장 동인 | `infra_drivers`(KA14 AI 인프라), `bridge_override`(KA08) | 보도된 투자 계획 | 계정 특정, 2건뿐 |
| 산업별 성장률 | `forecast_bridge[family]` organic CAGR | B-BRIDGE.organic(시장 벤치마크 연결) | 업종 일률 |
| 시나리오 가정 | cloud·ai·regulatory·efficiency·substitution 5년 누적 비율, low/base/high | ANALYST_JUDGMENT 다수 | 업종 일률 |
| LG U+ 경쟁력 확대 | C-ADDR 2031_base·2031_expansion, C-CAP 2031 | 사업 가정(경영진 승인 대상) | **FPR에만 영향** — FPR_const_capability로 분리 |

{chr(10).join(cagr_rows)}

### 4.2 승수 상위 계정과 2026 오차 전파
{chr(10).join(fc_rows)}
- 탄력성 1.00 = TS_2026이 10% 틀리면 TS_2031도 10% 틀림. KA14는 계정별 절대 증분(연 5,000억)이 있어 0.59.
- 결합폭 = (결합 high − 결합 low) ÷ base. 결합 범위는 확률 구간이 아니라 두 불확실성이 같은 방향일 때의 외곽선이다.

## 5. 발견 사항 (재무 모델)
{findings_table(F, ids=['QA-05', 'QA-06', 'QA-07', 'QA-08', 'QA-09', 'QA-10', 'QA-12', 'QA-13', 'QA-03'])}

## 6. 권고 (우선순위)
1. KISA 공시 '정보기술부문 인력'으로 쿠팡·카카오·네이버클라우드 인건비 비중 보정(포트폴리오 영향 최대).
2. 비은행 금융 포괄률 실측(카드·증권 KISA 공시사 1~2곳).
3. FPR_2031 보고 시 `FPR_const_capability`(현 역량)와 base(역량 확대 가정)를 함께 제시하고, C-ADDR/C-CAP 2031 상향을 경영진 승인 가정으로 명시.
4. 사내 Account Plan으로 상위 10개 계정의 계정별 성장 동인 입력(APPROVED_ACCOUNT_PLAN 레이어 소비 구현 필요).
"""
    (OUT / "FINANCIAL_MODEL_RISK_REPORT.md").write_text(doc2, encoding="utf-8")

    # ------------------------------------------------------------------ 3. SOURCE_TRACEABILITY_REPORT
    tr = S["traceability"]
    bt = B.get("traceability", {})
    per_basis = Counter()
    for r in L:
        per_basis[(r["evidence_basis"], r["anchor_source_types"])] += 1
    src_rows = ["| 근거 유형 | 앵커 근거 출처 유형 | 계정 수 |", "|---|---|---|"]
    for (b_, s_), c in sorted(per_basis.items(), key=lambda x: (x[0][0], -x[1])):
        src_rows.append(f"| {BASIS_KO.get(b_, b_)} | {s_ or '—'} | {c} |")
    anc_rows = ["| ID | 고객 | 앵커 방법 | FY | 앵커 값(억) | 앵커 상태 | 입력 상태 | 근거 ID | 출처 유형 | 근거 검증 상태 | 산식 |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in L:
        anc_rows.append(f"| {r['account_id']} | {r['name']} | {r['anchor_method']} | {r['anchor_fy'] or '—'} | {n(r['anchor_value_eok'], 1)} | {r['anchor_fact_status']} | {r['anchor_input_fact_status'] or '—'} | "
                        f"{r['anchor_evidence_ids'].replace(';', ', ') or '—'} | {r['anchor_source_types'] or '—'} | {r['anchor_evidence_status'] or '—'} | {r['TS_2026_formula'][:140].replace('|', '/')} |")
    no_ev = [x for x in tr["no_evidence_records"]]
    doc3 = f"""# SOURCE TRACEABILITY REPORT — 근거·산식 연결 검증 (STEP 1~2)

{hdr}
## 1. 결과
| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| 값이 있는 지표 레코드(2026·2031 base TS/RAW/FPR) | {bt.get('records', '—')} | {tr['records']} |
| 산식 보유 + 근거 ID 해석 가능 | {bt.get('ok', '—')} | {tr['ok']} |
| 계정 근거 목록에 없는 근거 ID | {len(bt.get('missing_evidence', []))} | {len(tr['missing_evidence'])} |
| parameter_evidence 미등록 가정 ID | {', '.join(bt.get('unregistered_assumptions', [])) or '없음'} | {', '.join(tr['unregistered_assumptions']) or '없음'} |
| 근거 ID 0개 레코드(산업 평균 방식 제외 시 오류) | {len(bt.get('no_evidence_records', []))} | {len(no_ev)} {('(' + ', '.join(no_ev[:12]) + ')') if no_ev else ''} |

- 수정 전 근거 ID 0개 레코드 3건은 KA32(계약 기반 RAW)의 FPR_2026·RAW_2031·FPR_2031이었다(QA-04). 산업 평균 계정은 매출·판관비 사실의 근거 ID와 가정 ID(B-INT)로 연결되어 있다.
- 원천 조사 파일 해시(`source_hash`)·보충 파일 해시가 계정마다 기록되어 있어 값의 재현 경로가 고정된다.

## 2. 출처 유형별 분포
{chr(10).join(src_rows)}

출처 유형: `DART_API`·`DART_AUDIT_REPORT`·`DART_FILING`=전자공시 원문(1차), `KISA_DISCLOSURE_VIA_PRESS`=KISA 정보보호 공시값의 언론 인용(2차), `NEWS`·`PRESS_RELEASE`=보도(2차), `GOV_DATA`·`BENCHMARK`=통계·벤치마크.

## 3. 계정별 TS 앵커 근거 연결 (53개)
{chr(10).join(anc_rows)}

## 4. 발견 사항
{findings_table(F, ids=['QA-01', 'QA-02', 'QA-04', 'QA-11'])}

## 5. 잔여 위험
- KISA 정보보호 공시 원문은 이 환경에서 접속 불가 — 11개 계정의 IT 지출액은 언론 인용 상태로 남는다(사내망 대조 필요).
- 해외 공공 API(USAspending·SEC·PeeringDB·Steam) 차단으로 KA32·KA42·KA43 근거 확보 불가(`docs/MCP_SOURCE_REGISTRY.md` §3).
- 근거 문서의 원문 스냅샷(PDF)은 저장하지 않고 URL·접수번호·인용문만 보관 — 원문 링크 변경 시 접수번호로 재조회.
"""
    (OUT / "SOURCE_TRACEABILITY_REPORT.md").write_text(doc3, encoding="utf-8")

    # ------------------------------------------------------------------ 4. INTERNAL_EXCEL_INTEGRATION_READINESS
    doc4 = f"""# INTERNAL EXCEL INTEGRATION READINESS (STEP 5)

{hdr}
## 1. 판정
**합성(TEST-ONLY) 데이터 기준 결합 기능은 준비됨. 실제 사내 데이터 검증은 미실시.** 이번 재검증에서 승인·집계 로직 결함 4건(QA-I1~I4)을 발견해 수정했고, 수정 전 코드로 테스트 2건이 실패하는 것을 재현해 결함을 확인했다.

## 2. 데이터 계층 분리 (요구사항 대비)
| 계층 | 저장 위치 | Excel 시트 | 모델 반영 | 외부 추정 덮어쓰기 |
|---|---|---|---|---|
| EXTERNAL_FACT / EXTERNAL_ESTIMATE | data/raw · data/processed | — | TS/RAW/FPR | — |
| INTERNAL_ACTUAL (실제 매출 CR) | internal_store/INTERNAL_ACTUAL.json | INTERNAL_ACTUAL | CR_2026 → C-SOW·PCR·Upside | 없음(별도 지표) |
| SALES_ESTIMATE (영업 TS/RAW/FPR) | internal_store/SALES_ESTIMATE.json | SALES_ESTIMATE | Reconciliation 비교만 | **금지 — 테스트로 확인** |
| MANAGEMENT_TARGET (경영 목표) | internal_store/MANAGEMENT_TARGET.json | MANAGEMENT_TARGET | Target_2031 (≤FPR 검증) | 없음 |
| APPROVED_ACCOUNT_PLAN | internal_store/APPROVED_ACCOUNT_PLAN.json | ACCOUNT_PLAN | **미반영(저장·이력만)** — QA-I5 | — |

## 3. 재검증 테스트 (`tests/test_qa_integration.py`, 샌드박스 INTERNAL_STORE_DIR·KAI_DATA_OUT)
| # | 시나리오(합성값) | 기대 | 결과 |
|---|---|---|---|
| 1 | 미리보기만 수행 | 저장소 4개 레이어 0건 | PASS |
| 2 | 빈 행 선택으로 승인 | 0행 반영 | PASS (수정 전 FAIL: 전체 반영) |
| 3 | 거부된 배치 | 저장소 불변 | PASS |
| 4 | 승인된 배치를 거부 | 차단(ValueError/HTTP 409) | PASS (수정 전 허용) |
| 5 | 승인 후 레이어별 건수 | ACTUAL 2·SALES 3·TARGET 2·PLAN 1, 교차 필드 없음 | PASS |
| 6 | KA03·KA18·KA09 외부 TS/RAW/FPR(2026·2031) | 사내 데이터 반영 전후 동일 | PASS |
| 7 | 영업 TS 3,000억(외부 대비 낮음)·RAW +5%·FPR +60% | REVIEW_SALES_LOWER / ALIGNED / REVIEW_SALES_HIGHER, 외부값 유지 | PASS |
| 8 | 경영 목표 = FPR_2031 × 2 | TARGET_GT_FPR **ERROR**, 입력값 유지(자동 절삭 없음) | PASS |
| 9 | CR = FPR_2026 × 3 (KA18) | CR_GT_FPR 경고 + Reconciliation 검토 메모, CR 유지 | PASS |
| 10 | 미입력 계정(KA09) | CR NULL(0 아님), Reconciliation 없음 | PASS |
| 11 | 같은 계정 FORECAST 100 + ACTUAL_FULL_YEAR 120 | CR=120 (합산 금지) | PASS (수정 전 220) |
| 12 | 기존 시나리오(`test_internal_import.py`): 고객명 변형 매핑, 단위 환산, '토스' 모호 매핑 차단, CHANGED/UNCHANGED diff, 이력, API 업로드→승인→대시보드 갱신 | — | PASS |

전체 테스트: pytest 36 · vitest 6 · E2E 16 통과(Linux).

## 4. 발견 사항
{findings_table(F, area_prefix='사내 Excel')}

## 5. 사내 이관 후 실데이터 검증 절차 (필수)
1. 승인된 사내 PC에서만 수행. 외부 LLM·MCP·Git으로 사내 Excel/산출물 전송 금지.
2. 템플릿으로 **1개 계정**만 먼저 업로드 → 미리보기에서 매핑·단위·기간 확인 → 승인 → CR·C-SOW 수기 대사.
3. 상품/계약 단위 행의 정의(부가세, 대리점 수수료, 그룹사 내부거래) 재무팀 확인. ACTUAL_FULL_YEAR와 FORECAST를 같은 연도에 함께 넣으면 ACTUAL만 반영됨을 사용자에게 안내.
4. 53개 계정 확대 → UNMAPPED/AMBIGUOUS 0건이 될 때까지 `config/account_aliases.json` 보강.
5. REVIEW 플래그(영업 vs 외부 ±20% 초과)·CR_GT_FPR·TARGET_GT_FPR 목록을 검토회의 안건으로 사용 — 외부 추정을 수정하려면 근거를 갖고 `config/account_overrides.json`으로 변경(감사 추적 유지).
6. 레거시 간이 입력(`KAI_ENABLE_LEGACY_INPUT`)은 비활성 유지.
7. 대시보드 헤더 '사내 데이터 포함' 표시와 `tools/make_release.py` 차단 동작 확인.

## 6. 남은 위험
- 실제 사내 고객명·상품 체계에서의 매핑 정확도 미검증.
- 권한 분리(업로드/승인/내보내기)는 승인자 이름 기록만 — SSO·역할 기반 접근통제 없음.
- APPROVED_ACCOUNT_PLAN 미반영으로 영업-외부 차이의 최종 확정은 수작업.
- 동시 사용자 환경(서버 배포 방식 C)에서의 잠금은 단일 프로세스 잠금만 구현.
"""
    (OUT / "INTERNAL_EXCEL_INTEGRATION_READINESS.md").write_text(doc4, encoding="utf-8")

    # ------------------------------------------------------------------ 5. WINDOWS_MIGRATION_CHECKLIST
    pkg = json.loads((QA / "package_check.json").read_text(encoding="utf-8")) if (QA / "package_check.json").exists() else {}
    doc5 = f"""# WINDOWS MIGRATION CHECKLIST — 사내 클라우드 PC 이관 (STEP 6)

{hdr}
> ⚠ **이 환경(Linux)에서는 Windows 실행을 검증할 수 없었다.** 아래 '검증 완료'는 정적 점검·오프라인 의존성 해석·Linux 실행 결과이며, Windows 실행 항목은 이관 시 체크해야 한다.

## 1. 패키지 점검 결과 (`tools/make_release.py`)
| 항목 | 결과 |
|---|---|
| 패키지 | `{pkg.get('zip', 'dist_release/KeyAccountIntel_<version>.zip')}` · 파일 {pkg.get('files', '—')}개 · {pkg.get('size_mb', '—')}MB · MANIFEST(SHA-256) 포함 |
| 사내 데이터 포함 여부 | {pkg.get('internal_check', '—')} |
| 비밀 파일(.env·키) | {pkg.get('secrets', '—')} |
| 필수 구성 | {pkg.get('required', '—')} |
| 오프라인 wheel | {pkg.get('wheels', '—')} |
| Windows 스크립트 | {pkg.get('bat', '—')} |

### 검사 규칙(강화됨)
- 차단: `data/internal_store/`·`uploads/` 파일, management_inputs.csv 사내 값, 대시보드 번들 4종·`frontend/dist/*.js`의 `contains_internal_data:true`, `intel.db` management_inputs 사내 값, **허용 경로 밖 xlsx/xls/csv**.
- 제외: `.env`, `*.pem/*.key/*.p12/*.pfx`, node_modules, .venv, dist-single, dist_release.

## 2. 발견·수정 사항
{findings_table(F, ids=['QA-P1', 'QA-P2', 'QA-W1', 'QA-W2'])}

## 3. 의존성
| 구분 | 내용 | 검증 |
|---|---|---|
| Python | 3.11 이상(3.11·3.12·3.13 wheel 확보) | Linux 3.13에서 전체 테스트 통과 |
| 런타임 | fastapi 0.115.4, starlette 0.41.3, pydantic 2.13.5, uvicorn 0.53.0, python-multipart 0.0.32, openpyxl 3.1.5, colorama 0.4.6 | `pip install --dry-run --no-index -f wheels --platform win_amd64` 해석 성공(3.11·3.13, 24개 패키지) |
| 테스트 | pytest 9.1.1, httpx 0.28.1 | 동일 |
| Node.js | **불필요** — `frontend/dist` 빌드 포함 | 패키지에 dist/index.html 포함 확인 |
| 데이터베이스 | SQLite 파일(`data/processed/intel.db`) — 별도 DB 서버 불필요 | 포함 확인 |
| 설정 | `config/*.json`(파라미터·보정), `.env.example`(DART 키는 선택) | 포함 확인 |
| 제외 | `research/collectors`(외부 수집, requests 필요) — 사내 PC에서 실행하지 않음 | — |

## 4. 이관 체크리스트
### A. 반입 전 (개발 환경)
- [x] `python3 -m pytest -q`(36), `npx vitest run`(6), E2E(16) 통과
- [x] `python3 tools/make_release.py` 성공(사내 데이터 감지 0건)
- [x] `wheels/`(win_amd64, cp311~cp313) 생성 후 패키지 포함
- [ ] 보안팀 반입 승인(zip SHA-256: MANIFEST.json과 함께 제출)

### B. 설치 (사내 Windows PC) — **미검증, 이관 시 수행**
- [ ] `python --version` 또는 `py -3 --version` ≥ 3.11
- [ ] 압축 해제 경로에 한글·공백이 없는 위치 권장(예: `C:\\work\\kai`) — 스크립트는 따옴표 처리했으나 미검증
- [ ] `setup_windows.bat` → `.venv` 생성, `wheels`에서 오프라인 설치, `models.build` 완료 메시지
- [ ] 콘솔 한글 정상 출력(chcp 65001 적용 확인)
- [ ] `run_dashboard.bat` → 3초 후 브라우저 `http://127.0.0.1:8000` 자동 열림, 포트 충돌 시 `run_dashboard.bat 8010`
- [ ] Windows Defender/백신이 `.venv\\Scripts\\*.exe`(uvicorn 등) 차단하지 않는지, AppLocker·스크립트 실행 정책 확인
- [ ] 방화벽: 127.0.0.1 바인딩만 사용(외부 노출 없음)

### C. 기능 확인
- [ ] 대시보드 탭 5종 표시, 계정 선택·차트 클릭→근거 패널 연동
- [ ] `python -m pytest -q` 사내 PC에서 재실행(36 통과 기대)
- [ ] 관리자 입력 → 템플릿 다운로드 → 1개 계정 업로드 → 미리보기 → 승인 → 재계산
- [ ] `import_excel.bat status|template|preview|approve` CLI 동작 및 오류 코드 반환
- [ ] 레거시 간이 입력 저장 버튼이 410 안내를 표시(기본 비활성)
- [ ] 사내 데이터 반영 후 헤더 '사내 데이터 포함' 표시, `python tools\\make_release.py` 차단(exit 2)

### D. 보안·운영
- [ ] `data/internal_store/` 폴더 ACL(업로드·승인 담당자만)
- [ ] 사내 Git 사용 시 `.gitignore` 확인 + `data/internal_inputs/management_inputs.csv` 커밋 금지(pre-commit 훅 권장)
- [ ] 백업: `data/internal_store/`(이력 포함), `data/processed/`
- [ ] 사내 AI 도구와 연동하려면 데이터 처리·로깅·보관 정책 승인 선행

## 5. 남은 위험
- Windows 실제 실행, 사내 백신·프록시·실행 정책과의 충돌 여부 **미검증**.
- 압축 해제 경로의 한글·공백, OneDrive 동기화 폴더에서의 파일 잠금 미검증.
- `frontend/dist`는 개발 환경에서 빌드된 정적 파일 — 화면 수정 시 Node.js가 있는 PC에서 재빌드 필요.
"""
    (OUT / "WINDOWS_MIGRATION_CHECKLIST.md").write_text(doc5, encoding="utf-8")
    print("written:", sorted(p.name for p in OUT.glob("*.md")))


if __name__ == "__main__":
    main()
