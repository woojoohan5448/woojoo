# FINANCIAL METHODOLOGY v2 (Phase 1~4 추가분)

> v1.0 정의(TS/RAW/FPR/CR/Target, 브리지, 신뢰도 점수)는 `docs/METHODOLOGY.md`를 그대로 따른다. 이 문서는 Phase 1~4에서 **추가·변경된 산정 규칙**만 기술한다.

## 1. TS 앵커 우선순위 (`models/spending/ts.py::select_anchor`)
| 순위 | 방법 | 정의 | 대표 등급 |
|---|---|---|---|
| 1 | ACCOUNT_SPECIFIC | `config/account_overrides.json`의 `ts_anchor`(분석가 산식·입력·근거 ID 명시). 등급은 override에서 지정 | MEDIUM~LOW |
| 2 | DIRECT_IT_BUDGET | 공시·보도된 연간 IT 예산. **DERIVED 예산은 KISA 값이 있으면 양보** | HIGH~MEDIUM |
| 3 | KISA_IT_INVESTMENT / KISA_DERIVED | KISA 정보보호 공시 '정보기술부문 투자액' | HIGH(FY≥2024 직접 보고) |
| 4 | KISA_SEC_SCALED | 정보보호 투자액 ÷ 자사 보안비율(없으면 업종 B-SECR) | MEDIUM(자사 비율)/LOW |
| 5 | AUDIT_IT_COMPONENTS (L2) | 감사보고서 IT 계정(전산업무비·전산용역비·소프트웨어 상각 등) 합 ÷ 실증 커버리지. **분석가 화이트리스트(fact_id)만** 합산 | MEDIUM |
| 6 | EMPLOYEE_COMPARABLE (L5) | 동종 KISA 공시사 1인당 IT 투자 × 임직원 수 (비교군 n≥3) | LOW |
| 7 | REVENUE_INTENSITY | 업종 IT 집약도 × 매출(FIN은 판관비 기준) | LOW |
| — | UNKNOWN | 위 어느 것도 근거 부족 → `INSUFFICIENT_EVIDENCE` | — |

강한 후보(KISA_IT/DERIVED/자사비율 SEC)가 있으면 L2 구성요소법은 대체 근거(alternatives)로만 표시되어 교차검증에 쓰인다.

## 2. 실증 커버리지 (L2 → TS 환산계수, `model_parameters.json::component_model.coverage`)
| 키 | 값 | 근거 | 상태 |
|---|---|---|---|
| FIN | 0.468 | KB국민은행 0.476, 우리은행 0.460 (전산업무비 ÷ KISA IT 투자액) | EMPIRICAL (B-COMP) |
| CLOUD_INFRA | 0.806 | 네이버클라우드 IT 계정 ÷ KISA | EMPIRICAL |
| CORP | 0.6 | 실증 표본 없음 | ASSUMPTION (범위 확대) |
범위: 하한 = 합계/커버리지 상한값, 상한 = 합계/커버리지 하한값.

## 3. 시나리오 앵커 (L6, ESTIMATED_LOW, 정의 상이)
| 계정 | 산식 | 정의 |
|---|---|---|
| KA07 MS | 부산 85MW × 30억/MW/년(수도권 상면 25만원/kW/월) | 국내 인프라 지출 |
| KA38 | KR-BID 계약 연환산 | 조달 계약 기준 |
| **KA45 메타 (P2 신규)** | 평균[매출비율법 1.9% × 광고 총판매액 10,752억 = 204억, 트래픽법 전용회선시장 11,150억 × 4.3% = 479억] = 342억(범위 204~479) | 망 이용대가 **동등가치**(실제 지급액 아님) |
`definition_note`가 있는 계정(KA06·07·08·45·46)은 R10 DEFINITION_MISMATCH로 표시되고 포트폴리오 비교 합계에서 분리된다.

## 4. 등급 체계 (`models/build.py::assign_grades`)
- **ESTIMATED_HIGH**: FY≥2024 KISA/예산 직접 보고 + 신뢰도 ≥55만.
- **ESTIMATED_MEDIUM**: 자사 비율 SEC 환산, L2 구성요소, MEDIUM 지정 override.
- **ESTIMATED_LOW**: 집약도·임직원 비교·시나리오.
- RAW/FPR은 TS보다 한 단계 낮게, 2031은 추가로 한 단계 낮게(최저 LOW).
- 추정값은 VERIFIED로 표시하지 않는다. VERIFIED/DERIVED는 원천 사실(facts)에만 쓴다.

## 5. N/A 분류 (`models/audit.py::classify`)
| 엔진 분류 | 대시보드 표시 | 의미 |
|---|---|---|
| ESTIMATED_HIGH/MEDIUM | VERIFIED·ESTIMATED 배지 | 근거 기반 추정 |
| ESTIMATED_LOW | LOW CONFIDENCE | 추정(불확실성 큼) |
| INTERNAL_REQUIRED | INTERNAL INPUT REQUIRED | CR·C-SOW·PCR·Upside·Target·Target SOW — 사내 데이터 없이는 산출 금지 |
| INSUFFICIENT_EVIDENCE | RESEARCH GAP | 외부 근거 부족(숫자 생성 금지) |
| NOT_APPLICABLE | NOT APPLICABLE | `config/not_applicable.json`(예: KA50 2026 — 착공 전) |
| ERROR | VALIDATION ERROR | 불변식 위반 |

## 6. 커버리지 지표 (`data/phase1/current_coverage.json`)
- External Estimable Coverage = 외부 필드(TS/RAW/FPR × 2026/2031, NOT_APPLICABLE 제외) 중 값 보유 비율.
- N/A Recovery Rate = 기준선(v1) 결측 116개 중 현재 값 보유 또는 정당한 NOT_APPLICABLE 판정 수 ÷ 116.
- Internal Required Count = 사내 입력 필요 필드 수(318) — 외부 조사로 줄이지 않는다.

## 7. 사내 데이터 통합 (Phase 4, `models/build.py::reconcile`)
- INTERNAL_ACTUAL → CR_2026 → C-SOW = CR/TS, PCR = CR/FPR, Upside = FPR − CR.
- MANAGEMENT_TARGET → Target_2031 (Target ≤ FPR_2031 검증), Target SOW = Target/TS_2031.
- SALES_ESTIMATE는 외부 추정을 덮어쓰지 않고 차이 플래그: |영업/모델 − 1| ≤ 20% ALIGNED, 초과 시 REVIEW_SALES_HIGHER/LOWER, 미입력 NO_SALES_INPUT. opportunity_gap = 모델 FPR − 영업 FPR.
- 상품별 LG U+ 매출 배분은 범위 밖.
