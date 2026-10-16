# Internal–External Data Reconciliation 설계 · 표준 Data Contract (v0.1 초안)

> 2026-10-16 · 기계 판독 계약 `contracts/phase3a_data_contract.v0.json` · 검증기 `tools/contract_validate.py` · 합성 검증 `tests/test_phase3a_contract.py`
>
> 실제 사내 원천값은 사용하지 않았습니다. 스키마는 현재 알려진 정보(사용자 기술 항목과 기존 Import 4개 시트)와 **합성 데이터**만으로 검증했습니다. 기존 엔진(`models/build.py`), Import(`models/internal/excel_io.py`), 원천 파일은 변경하지 않았습니다.

## 0. 핵심 요약
1. **두 세계를 섞지 않고 나란히 둡니다.**
   - 외부 모델(TS/RAW/FPR)은 공식 "기회 규모"로 그대로 둡니다.
   - 사내 SAM/RAW는 **대사 비교 전용**입니다.
   - 사내 매출 계열(실적·계획·목표)은 **승인된 경우에만** 공식 슬롯(CR, Target, 매출 계획)에 들어갑니다.
2. **원본은 그대로 보존합니다.** 사내 RAW 역산 보정은 `보정 전 / 보정액 / 보정 후` 3개 레코드로 따로 저장하고, 2031 Target Case는 케이스별 원본값 그대로 저장합니다.
   - 값을 다시 계산하거나 반올림하지 않습니다. 불일치가 있으면 경고만 하고 고치지 않습니다.
3. **표준 키**는 `account_id × area_level/area_id × fiscal_year × period_type × case_id × measure_id × source.version`입니다. 모든 레코드는 원천 위치(파일 해시·시트·셀)와 승인 상태를 가집니다.
4. 상태는 **SOURCE → VALIDATED → VERIFIED → APPROVED** 순으로 진행하며, 직무 분리 규칙을 둡니다. 공식 대시보드 계산에는 **APPROVED만** 들어갑니다.
5. **정의가 확정되지 않은 비교에는 정합/불일치 판정을 내리지 않습니다.**
   - SAM은 NOT_COMPARABLE, 사내 RAW는 REFERENCE_ONLY로 둡니다.
   - ±20% 판정(ALIGNED/REVIEW)은 정의가 DIRECT로 확정된 이후에만 적용합니다.

## 1. 필드별 매핑표 (외부 모델 ↔ 사내 Excel)
| # | 사내 항목 | 계약 measure | 외부 대응 | 관계 | 주요 정의 차이(확인 필요) | 비교 규칙(v0) | 공식 사용 |
|---|---|---|---|---|---|---|---|
| 1 | Internal SAM | `INT_SAM` | ① TS 또는 ② RAW | **미확정** | SAM이 TS(총 IT 지출)인지, U+ 포트폴리오로 서비스 가능한 범위(RAW 상위)인지 불명. 무선/단말 포함 여부 불명 | UNKNOWN → NOT_COMPARABLE(값만 병기) | 비교 전용 |
| 2 | Internal RAW(원본) | `INT_RAW_SOURCE` | ② RAW(Realistical Addressable Wallet) | 근사 | 외부 RAW는 `TS × 카테고리 Addressability`(하향식, 인건비·캡티브 제외). 사내 RAW는 매출 계획·목표 점유율에서 **역산**했을 가능성(상향식) | PROXY → REFERENCE_ONLY(차이율만 표시) | 비교 전용 |
| 3 | RAW 역산 보정 | `INT_RAW_ADJ` | — | — | 보정 방법·사유·작성자 필수(`adjustment_method`, `adjustment_reason`) | 원본 + 보정 = 보정 후 정합성만 점검(C05) | 비교 전용 |
| 4 | Internal RAW(보정 후) | `INT_RAW_ADJUSTED` | ② RAW | 근사 | 위와 같음 | PROXY → REFERENCE_ONLY | 비교 전용 |
| 5 | Actual Revenue | `ACTUAL_REVENUE` | ④ CR | **동일 개념** | 매출 인식 기준(수주/인식), VAT, 무선 포함 여부, 법인 범위(그룹 계열사 합산 여부) | 외부값 없음. CR ≤ FPR_2026 점검은 기존 엔진 규칙 | **승인 시 공식 CR** |
| 6 | Sales Plan(연도별) | `SALES_PLAN` | 없음(외부는 2027~2030 미산출) | — | 계획 연도 범위, 상품 범위 | FPR_2031 상한 점검(CEILING_ONLY) | **승인 시 공식 매출 계획 경로** |
| 7 | Stretch | `STRETCH` | ③ FPR(상한 비교) | 상한 비교 | 도전 목표는 계획 이상, FPR 이하가 정상 | CEILING_ONLY | 비교 전용 |
| 8 | 2031 Target Case별 수치 | `TARGET_CASE` (case_id `TARGET_CASE_<이름>`) | ⑧ Target(시나리오 목표 = FPR × 0.5) | 대안 | 케이스 이름·개수·산식 미확인. **케이스는 승인 전 후보값** | CEILING_ONLY | 비교 전용(자동 승격 금지) |
| 9 | Approved Target | `APPROVED_TARGET` (`derived_from_case_id`) | ⑧ 2031 Target Revenue | **동일 개념(D1)** | 승인 주체·일자 | 원천 케이스와 값 정확 일치(C07), FPR_2031 초과 시 플래그(값 유지) | **승인 시 공식 Target** |
| — | 외부 TS/RAW/FPR | `EXT_TS/RAW/FPR` | 엔진 산출(`m.*`) | — | 외부 정의 확정(DEF_EXT_*_V1) | Import 대상 아님(C01_EXTERNAL_IMPORT) | 공식 기회 규모 |

**정의 차이 점검 축.** 매핑을 확정하려면 아래 7개 축을 모두 확인해야 합니다.

| 축 | 외부 모델 | 사내 Excel(가정) | 차이 영향 |
|---|---|---|---|
| 측정 대상 | 고객의 지출(Customer spend) | U+ 매출(Revenue) / 시장(SAM) | 지출과 매출을 직접 비교하는 것 금지. 비교 쌍은 RAW↔RAW, Target↔FPR 상한으로 제한 |
| 방향 | 하향식(TS → RAW → FPR) | 상향식 역산 가능 | 역산 RAW는 목표가 크면 RAW도 커지는 순환 → DIRECT 판정 금지 |
| 법인 범위 | 원칙상 별도 법인(KA별 `economic_scope`) | 그룹·계열 합산 가능 | 계정 매핑 시 `entity_scope` 필수 |
| 상품 범위 | 9개 카테고리(무선 단말 미포함 추정) | 무선·IoT·단말 포함 가능 | 미매핑 상품군은 C08로 차단, 매핑표 필요 |
| 시점 | FY2026 기준·FY2031 전망, 고객 회계연도(3월 결산 고객 있음) | U+ 회계연도(12월) | `fiscal_year` + `as_of` 병기 |
| 단위/VAT | 억원, VAT 제외 | 원·백만원, VAT 포함 가능 | 단위는 원본 보존 후 환산(정확 일치 검증), VAT는 `vat_basis` 필드 |
| 시나리오 | Low/Base/High × Base Case/Strategic Expansion | Plan/Stretch/Target Case A·B… | 이름이 같아도 개념이 다름 → `case_family` 분리 |

## 2. 표준 Data Contract — 연결 키
| 키 | 값 | 비고 |
|---|---|---|
| `account_id` | `KA01`~`KA53` | `docs/ACCOUNT_MASTER.csv` + `config/account_aliases.json` 매핑. 원본 고객명은 `account_name_src`로 보존. 미매핑 → C08 오류(격리) |
| `area_level` / `area_id` | `ACCOUNT`/`ALL`, `CATEGORY`/9개 카테고리, `BIZ_AREA`/8개 사업영역 | 카테고리 → 사업영역은 계약의 `category_to_biz_area`. 사내 상품군 → 카테고리 매핑은 별도 설정(Blocker B5) |
| `fiscal_year` | 2024~2031 | 외부 모델은 2026·2031만 존재(2027~2030은 예시 보간이므로 비교하지 않음) |
| `period_type` | `FY`·`YTD`·`FORECAST`·`ACTUAL_FULL_YEAR`·`PLAN` | 기존 INTERNAL_ACTUAL 규칙(QA-I3: 확정이 예상보다 우선, 합산 금지) 승계 |
| `case_family` / `case_id` | 외부 `BASE\|BASE_CASE` 등 6종 · 사내 `PLAN`·`STRETCH`·`ACTUAL`·`APPROVED`·`TARGET_CASE_<X>` | 외부와 사내 시나리오는 이름이 같아도 연결하지 않음 |
| `measure_id` | §1의 12종 | measure별 `official_use` = MODEL_VALUE / COMPARISON_ONLY / OFFICIAL_WHEN_APPROVED |
| `source.*` | `source_id`, `layer`, `file_sha256`, `sheet`, `cell_ref`, `as_of`, `version`, `uploaded_by` | 원천 셀까지 역추적. 같은 키의 새 값은 `version`을 올려 추가(덮어쓰기 금지) |
| `raw` | `value`(셀 문자열 그대로), `unit`, `formula` | `value_eok`는 `raw.value × 단위계수`와 **정확히 일치**해야 함(C02). 반올림하면 오류 |
| `definition_ref` | `DEF_EXT_*`, `DEF_INT_*` | 정의 레지스트리. `comparability` = DIRECT / PROXY / UNKNOWN / CEILING_ONLY |
| `status` / `history[]` | 아래 §3 | 상태 전이 이력 전체 보존 |

레코드 예시(합성):
```json
{"record_id":"S-KA03-010","synthetic":true,"account_id":"KA03","area_level":"ACCOUNT","area_id":"ALL",
 "fiscal_year":2026,"period_type":"FORECAST","case_family":"INTERNAL_CASE","case_id":"ACTUAL","measure_id":"ACTUAL_REVENUE",
 "source":{"source_id":"SYNTH-S-KA03-010","layer":"INTERNAL_EXCEL","file_sha256":"000…","sheet":"SYNTH","cell_ref":"R010","as_of":"2026-10-16","version":1,"uploaded_by":"synth.uploader"},
 "raw":{"value":"12,000","unit":"백만원","formula":null},"value_eok":"120.00","definition_ref":"DEF_INT_REVENUE_TBD",
 "entity_scope":"UNKNOWN","vat_basis":"UNKNOWN","status":"APPROVED",
 "history":[{"to":"VALIDATED","by":"contract_validate"},{"to":"VERIFIED","by":"synth.verifier"},{"to":"APPROVED","by":"synth.approver"}]}
```

## 3. 데이터 우선순위·승인 규칙
### 3-1. 상태(원천값 vs 검증값 vs 승인값)
| 상태 | 의미 | 누가 | 화면 표시 | 공식 계산 |
|---|---|---|---|---|
| SOURCE | Excel에서 읽은 원천값(원본 그대로) | 업로더 | 대사 패널 "원천값" | ✗ |
| VALIDATED | 계약 규칙(C01~C08) 통과 | 시스템 | "형식 검증" | ✗ |
| VERIFIED | 담당자가 정의·범위 확인, 외부 대사 차이 사유 기재 | 검증자(영업/사업 담당, 업로더 ≠ 검증자) | "검증됨(미승인)" | ✗ |
| APPROVED | 경영 승인 | 승인자(업로더·검증자와 다른 사람) | "승인" | **✓** |
| REJECTED / SUPERSEDED | 반려(사유 필수) / 새 버전으로 대체 | — | 이력에만 표시 | ✗ |

- 승인 단위는 **고객 × 사업영역 × measure × 연도 × case × version**입니다.
- 같은 고객이라도 Connectivity는 승인, Cloud는 검증 중처럼 영역별로 상태가 다를 수 있습니다.
- 대시보드는 셀마다 상태 배지를 표시합니다.
- 오류가 있는 레코드는 **격리**합니다(`quarantined`). 보고서에는 남지만 공식·대사 계산에서 제외합니다.

### 3-2. 공식 슬롯별 우선순위
| 공식 슬롯 | 1순위 | 2순위 | 없을 때 | 절대 사용 금지 |
|---|---|---|---|---|
| ④ CR 2026 | APPROVED `ACTUAL_REVENUE` · ACTUAL_FULL_YEAR | APPROVED · FORECAST | **NULL**('사내 매출 미입력') | 0 대체, FORECAST + ACTUAL 합산, 영업 계획, 외부 추정 |
| ⑧ Target 2031 | APPROVED `APPROVED_TARGET`(최신 version, 원천 케이스와 값 일치) | — | NULL('사내 목표 미입력'), 시나리오 목표는 토글 참고값(D1) | TARGET_CASE·STRETCH·SALES_PLAN 자동 승격 |
| 매출 계획 경로 2027~2031 | APPROVED `SALES_PLAN` | — | 표시 안 함 | TS/RAW/FPR 보간 경로 대체에 사용 |
| ①②③ TS/RAW/FPR | 외부 엔진 값(현행 유지) | — | RESEARCH GAP | 사내 SAM/RAW로 자동 대체 |

사내 RAW를 공식 RAW로 **채택(ADOPTION)**할지는 별도 경영 결정이 필요하며, v0 범위에서는 제외합니다.
- 채택하려면 정의를 DIRECT로 확정하고, 고객 × 영역 단위로 승인받아야 합니다.
- 반영 경로는 기존 `config/account_overrides.json`의 변경 기록(MODEL_CHANGE_LOG)을 따릅니다.

### 3-3. 대사(Variance) 판정
| 정의 관계 | 판정 | 의미 |
|---|---|---|
| DIRECT | ALIGNED(±20%) / REVIEW_INTERNAL_HIGHER / REVIEW_INTERNAL_LOWER | REVIEW는 검증자 사유 코드 필수(예: 계열사 포함, 무선 포함, 역산 보정) |
| PROXY | REFERENCE_ONLY + 차이율 | 정의 확정 전에는 정합/불일치 판정 금지 |
| UNKNOWN | NOT_COMPARABLE(값만 병기, 차이율 미산출) | SAM 정의 확정 전 |
| CEILING_ONLY | WITHIN_FPR / TARGET_ABOVE_FPR | 사내 목표·계획 ≤ 외부 FPR_2031. 초과 시 값은 유지하고 플래그만 표시 |

- 기존 Phase 4 Reconciliation(`SALES_ESTIMATE` ↔ 외부, ±20%)은 그대로 유지합니다.
- 새 계약의 대사는 **카테고리·사업영역 단위**까지 확장됩니다. 외부 `by_cat`을 사업영역으로 합산해 비교합니다.

## 4. Opportunity ↔ Demand Evidence 연결 구조
```
opportunity (account_id, area_id[사업영역], fiscal_year, case_id)    ← 금액: 외부 FPR by_cat 합산 (value_basis 유지)
   │ 1..n
opportunity_evidence_link (link_id, opportunity_id, evidence_id, role: SUPPORTS | CONTRADICTS | CONTEXT)
   │ n..1
evidence
   ├─ 외부: DEMAND_SIGNAL · INCUMBENT_OBSERVED · ACCOUNT_SPECIFIC_SHARE   ← 현행 area_evidence.observation_ids (예: KA03-D01)
   └─ 사내(신규, 외부 반출 금지): INTERNAL_PIPELINE · INTERNAL_CONTRACT     ← 사내 저장소에만, 승인 레이어
```
- 근거 tier(EVIDENCE_BASED / MODEL_ESTIMATED / UNVERIFIED)는 **링크된 근거에서만** 산출합니다. 금액 산정 방식(`value_basis`)과는 별개입니다.
- 검증기 C11 규칙:
  - 존재하지 않는 근거 ID는 오류(C11_EVIDENCE_MISSING).
  - 다른 고객·영역의 근거를 연결하면 오류(C11_SCOPE_MISMATCH).
  - SUPPORTS 근거 없이 `presented_as=CONFIRMED`이면 오류(C11_CONFIRMED_WITHOUT_EVIDENCE).
  - 마지막 규칙이 **"실수요 근거가 없는 영역은 확정 과제로 표시하지 않는다"**를 데이터 계층에서 강제합니다.
- 전략 엔진 집계: 사업영역별 `n_accounts_signal`, `fpr2031_by_tier`, `evidence_level`은 현행 산식을 그대로 씁니다.
  - Phase 3A에서는 SCREEN_VERIFICATION §4의 F7-2에 따라 '기존 지출 관측'과 '신규 수요 신호'를 나눠 **표시**합니다.

## 5. Import Contract 개선안 (v2 제안 — 미구현)
현행 4개 시트(INTERNAL_ACTUAL · SALES_ESTIMATE · MANAGEMENT_TARGET · ACCOUNT_PLAN)는 **그대로 유지**하고(하위 호환), 아래 시트를 추가합니다.

| 새 시트 | 필수 컬럼 | 저장 레이어 | 비고 |
|---|---|---|---|
| `INTERNAL_SAM_RAW` | account, area, fiscal_year, measure(SAM/RAW_SOURCE/RAW_ADJUSTED), value, unit, definition_ref | INTERNAL_SAM_RAW | 비교 전용 |
| `RAW_ADJUSTMENT` | account, area, fiscal_year, raw_before, adjustment, raw_after, method, reason, adjusted_by | INTERNAL_SAM_RAW | 3개 값 모두 원본 보존. 합이 안 맞으면 경고만(C05) |
| `SALES_PLAN` | account, area, fiscal_year(2026~2031), revenue, unit, plan_version, owner | SALES_PLAN | 승인 시 매출 계획 경로 |
| `STRETCH` | account, area, fiscal_year, revenue, unit, owner | SALES_PLAN(case STRETCH) | 비교 전용 |
| `TARGET_CASES` | account, case_name, target_2031, unit, basis, proposed_by | TARGET_CASE | 케이스명 → `TARGET_CASE_<X>` 정규화, 원본명 보존 |
| `MANAGEMENT_TARGET`(확장) | + `derived_from_case`(선택) | MANAGEMENT_TARGET | 원천 케이스와 값 정확 일치 검증 |

공통 개선 사항:
1. **헤더 매핑 설정** `config/internal_header_map.json`(신규 제안)을 둡니다. 실제 사내 Excel의 한글 헤더와 병합 셀 위치를 계약 필드에 매핑합니다. 사내 양식이 바뀌어도 코드는 바꾸지 않아도 됩니다(Blocker B1 대응).
2. **원본 보존**: 셀 문자열, 수식, 파일 SHA-256, 시트·셀 주소를 저장합니다. 환산값은 원본 × 단위계수와 정확히 일치해야 합니다.
3. **버전 추가 방식**: 같은 키의 재업로드는 version+1로 추가하고, 이전 버전은 SUPERSEDED로 남깁니다. 승인된 값은 덮어쓰지 않습니다.
4. **Preview 보고서 확장**: 고객 × 영역 × 연도 × measure 단위 대사표(§3-3 판정)와, 격리 레코드 목록 및 사유를 보여 줍니다.
5. **3단계 승인**: 현행 approve(1단계)를 verify → approve 2단계로 나누고 직무 분리를 강제합니다. 테스트 모드에서는 합성 데이터만, 운영 모드에서는 합성 데이터를 차단합니다(C10).
6. **보안**: 현행 규칙을 승계합니다. 사내 저장소는 `.gitignore` 대상이고, 외부 MCP·LLM·Git으로 반출하지 않으며, 테스트는 샌드박스에서만 합니다. 사내 근거(INTERNAL_PIPELINE/CONTRACT)도 같은 규칙을 따릅니다.

## 6. 합성 데이터 검증 결과
- 합성 데이터는 `python3 -m tests.phase3a_synthetic`로 생성합니다(`tests/fixtures/phase3a_synthetic.json`).
  - 정상 레코드 25건, 위반 레코드 11건이며, 모든 레코드가 `synthetic=true`입니다.
  - 고객 ID는 외부 대사 경로를 검증하려고 실제 KA 코드를 썼습니다. 값은 모두 가공한 값입니다.
- 결과 파일: `contract_validation_synthetic.json`. 테스트: `python3 -m pytest -q tests/test_phase3a_contract.py` → **18 passed**.

| 검증 | 결과 |
|---|---|
| 정상 25건 | 오류 0. 경고 2건은 모두 의도한 것: KA14 RAW 보정 불일치(1000 + 200 ≠ 1250, 값 유지), KA29 승인 목표 0.6조원 > 외부 FPR_2031 5,228억(값 유지) |
| 위반 11종 탐지 | 원본 반올림(C02), 직무 분리(C04), 잘못된 전이 SOURCE→APPROVED, 미매핑 영역 `MOBILE_B2B`·미매핑 고객(C08), Target 연도 오류, 보정 사유 누락(C05), 외부값 Import 시도, 승인 목표 ↔ 케이스 불일치(C07), 상태·이력 불일치, 테스트 모드에 실데이터 플래그(C10) → **11/11 탐지, 오류 레코드는 공식 슬롯에 미반영** |
| 공식 슬롯 | KA03 CR = ACTUAL_FULL_YEAR 118.5(FORECAST 120과 합산 안 함). KA14 CR = 카테고리 합 55. KA29 CR = 미승인이므로 NULL. KA03 Target = 케이스 B 260. 반려된 KA14 목표는 제외. Target Case·Stretch는 제외 목록 |
| 대사 판정 | SAM은 NOT_COMPARABLE, 사내 RAW는 REFERENCE_ONLY(KA03 +6.4%, KA14 −2.6%). DIRECT 시험 정의에서 KA03 Connectivity +6.9%는 ALIGNED, KA29 Cloud +49%는 REVIEW_INTERNAL_HIGHER |
| 원본 불변 | 검증 전후 레코드 해시 동일. `"12,000" 백만원` → 120억 정확 환산 |
| 근거 연결 | 정상 링크는 이슈 0건. 타 고객 근거 연결, 없는 근거, 근거 없는 CONFIRMED 각각 탐지 |
| 운영 모드 | 합성 레코드 전량 차단 |
