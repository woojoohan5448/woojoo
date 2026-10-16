# INTERNAL_INTEGRATION_HANDOFF — 사내 데이터 통합 작업 인계

> 기준선: Phase 3A 최종(태그 `v3.0-phase3a-final`). 상세 근거: `docs/vnext/phase3a/{DATA_CONTRACT,PHASE3A_READINESS,PHASE3A_REPORT}.md`, `contracts/phase3a_data_contract.v0.json`, `config/official_source_policy.json`.
>
> **원칙: 사내 원천 데이터가 없다는 이유로 가상의 값을 공식 데이터로 채우지 않습니다.** 값이 없으면 NULL(화면은 '사내 매출 미입력', '사내 목표 미입력', 'RESEARCH GAP')로 둡니다. 합성 데이터는 샌드박스 테스트에서만 씁니다(`synthetic=true`, 운영 모드에서 차단).

## 1. 현행 TS/RAW/FPR 데이터 구조와 계산 흐름
판서자 프레임워크(①~⑧)와 엔진 대응:

| 지표 | 정의 | 산식(엔진) | 코드 |
|---|---|---|---|
| ① TS (Customer Total IT Spending) | 고객 연간 IT 지출 총액(사내 인건비·HW·SW·서비스 포함), 원칙적으로 별도 법인 | 앵커(근거 유형별) → FY2026 환산(`B-G26`) | `models/spending/ts.py` |
| ② RAW (Realistical Addressable Wallet) | LG U+가 현실적으로 공략 가능한 지출 | Σ TS_cat × Addressability_cat(사내 인건비·캡티브 제외) | `models/addressability/raw.py` |
| ③ FPR (U+ Full Potential Revenue) | LG U+ 최대 확보 가능 매출 | Σ RAW_cat × Capture ceiling_cat | `models/capture/fpr.py` |
| ④ CR (Current Revenue) | LG U+ 실제 매출 | **사내 승인값만**(없으면 NULL) | `models/internal/excel_io.py` → build |
| ⑤ C-SOW / PCR | CR/RAW, CR/FPR | CR이 있을 때만 | build |
| ⑥ Upside | FPR − CR | CR이 있을 때만 | build |
| ⑦ 2031 TS/RAW/FPR | 2031 전망 | 브리지: 자연 성장(organic CAGR) + 증분 배분(B-ALLOC: 클라우드·AI·규제·효율·대체) + 계정별 인프라 동인 → Low/Base/High 시나리오 × Base Case/Strategic Expansion(접근률·포획상한 확대) | `models/forecasting/bridge.py` |
| ⑧ Target / Target SOW | 2031 목표 매출 / Target ÷ RAW_2031 | **경영진 승인(MANAGEMENT_APPROVED)만 공식.** 시나리오 목표(FPR×0.5, D-TGT)는 토글할 때만 보이는 참고값 | build(D1) |

- **TS 근거 유형**(`accounts[].evidence_basis.basis`, 53개사):
  - RECONSTRUCTED_FINANCIALS 25, DIRECT_IT_DISCLOSURE 11, INDUSTRY_AVERAGE 7, SCENARIO 4, CONTRACT_DIRECT_RAW 1, NONE 5
  - IT 지출을 1차 원문에서 확인한 계정은 0개입니다.
- **카테고리 9 + 접근 불가 1개**와 사업영역 대응:

  | 카테고리 | 사업영역 |
  |---|---|
  | CONNECTIVITY | Connectivity |
  | DC_COLO | Data Center / IDC |
  | CLOUD | Cloud |
  | AI_INFRA | AI Infrastructure |
  | SECURITY | Security |
  | SI_BUILD | AI Transformation / SI |
  | IT_OPS | SI / Managed Services |
  | SW_LICENSE, HW_DEVICE | 기타 |
  | INTERNAL_LABOR | 접근 불가 |

- **산출 경로**: `python -m models.build`가 다음을 생성합니다.
  - `data/processed/dashboard.json` · `intel.db` · `metric_history.csv`
  - `frontend/src/data/dashboard.json` · `frontend/public/data/dashboard.json`
  - `data/exports/*`
- **dashboard.json 주요 블록**:
  - `accounts[].m.{2026,2031.<low|base|high>,target}` — 각 값은 MetricRec: value·low·high·status·confidence·formula·inputs·evidence_ids·assumption_ids, 카테고리별 by_cat
  - `accounts[].area_evidence`
  - `portfolio.aggregate`
  - `strategy[]` — 기존 엔진, 점수 포함
  - `initiatives[]`, `priority_sensitivity`, `opportunity_flow` — Phase 3A
  - `recon` — Phase 3A 원장·출처

## 2. 53개 KA 고객 ID 체계
- `account_id`는 **KA01~KA53**입니다. 원본 목록은 `config/accounts_seed.csv`(account_id, original_name, segment, pilot)입니다.
- 법인 식별은 `docs/ACCOUNT_MASTER.csv`에 있습니다: legal_name_ko/en, **corp_code(DART)**, stock_code, **business_reg_no**, parent_group, related_key_accounts, fiscal_year_end, economic_scope, exclusions, entity_status, overlap_groups, aggregate_class.
- 사내 고객명 매핑은 `config/account_aliases.json`으로 합니다. 정확히 일치하거나 difflib 유사도 0.88 이상이면 매핑하고, 미매핑 행은 오류로 격리합니다.
- **사내 고객 코드 ↔ KA ID 대응표는 아직 없습니다(Blocker B6).** 사업자번호(business_reg_no)를 1차 연결 키로 쓰는 것을 권장합니다.
- 집계 분류(`aggregate_class`): COMPARABLE 19, OVERLAP_RISK 24, DEFINITION_MISMATCH 5(KA06·07·08·45·46, 합계 제외), EXCLUDED_UNKNOWN 5.

## 3. 표준 키 (고객 · 사업영역 · 연도 · 시나리오)
| 키 | 값 |
|---|---|
| `account_id` | KA01~KA53 |
| `area_level` / `area_id` | ACCOUNT/`ALL` · CATEGORY/9개 카테고리 · BIZ_AREA/8개 사업영역 |
| `fiscal_year` | 2024~2031. 외부 모델은 **2026·2031만** 산출합니다(2027~2030은 화면용 CAGR 보간 예시이며 데이터가 아님) |
| `period_type` | FY · YTD · FORECAST · ACTUAL_FULL_YEAR · PLAN |
| `case_family` / `case_id` | 외부 `LOW\|BASE\|HIGH` × `BASE_CASE\|STRATEGIC_EXPANSION`(6종). 사내 `PLAN`·`STRETCH`·`ACTUAL`·`APPROVED`·`TARGET_CASE_<X>` — **이름이 같아도 외부와 사내 시나리오를 연결하지 않습니다** |
| `measure_id` | EXT_TS/RAW/FPR · INT_SAM · INT_RAW_SOURCE/ADJ/ADJUSTED · ACTUAL_REVENUE · SALES_PLAN · STRETCH · TARGET_CASE · APPROVED_TARGET |
| `source.*` | source_id, layer, file_sha256, sheet, cell_ref, as_of, version, uploaded_by |

원장 키 형식은 `<SLOT>|<FY>|<CASE>`입니다(예: `RAW|2031|BASE|BASE_CASE`, `CR|2026|ACTUAL`, `TARGET|2031|APPROVED`).

## 4. Import 및 Reconciliation 구조
| 계층 | 현재 상태 | 위치 |
|---|---|---|
| 사내 Excel v1 (INTERNAL_ACTUAL · SALES_ESTIMATE · MANAGEMENT_TARGET · ACCOUNT_PLAN) | **구현.** 순서: preview → approve(이력 보존) → build | `models/internal/excel_io.py`, 저장 `INTERNAL_STORE_DIR/*` |
| Phase 4 대사(SALES_ESTIMATE ↔ 외부, ±20%) | 구현 | `models/build.py::reconcile` |
| Phase 3A 계약 검증기(C01~C11: 필수·원본 보존·직무 분리·RAW 보정 정합·Target Case 연결·합성 차단·근거 연결) | 구현(합성 검증) | `models/recon/contract.py` |
| Phase 3A 원장·공식 출처 선택 | 구현(합성 검증). 운영 데이터 0건 | `models/recon/ledger.py`, 저장 `INTERNAL_STORE_DIR/recon/{records,selections}.json` |
| 대사 화면 | 구현 | `frontend/src/components/ReconPanel.tsx`(① 고객 화면) |
| **Excel v2 새 시트**(INTERNAL_SAM_RAW · RAW_ADJUSTMENT · SALES_PLAN · STRETCH · TARGET_CASES) → recon 레코드 | **미구현(Phase 3B)** | 설계: `docs/vnext/phase3a/DATA_CONTRACT.md` §5 |

대사 판정은 정의 비교 가능성(`definition.comparability`)에 따라 달라집니다.

| 비교 가능성 | 판정 |
|---|---|
| DIRECT | ALIGNED(±20%) 또는 REVIEW |
| PROXY | REFERENCE_ONLY(차이율만 표시) |
| UNKNOWN | NOT_COMPARABLE |
| CEILING_ONLY | 사내 매출이 외부 FPR 이하인지만 점검 |

**지출(TS/RAW)과 매출(CR/Target)은 직접 비교하지 않습니다.**

## 5. 공식값 승인·출처 전환 정책 (`config/official_source_policy.json`)
- **TS/RAW/FPR**: 기본 출처는 외부 모델입니다. 다만 **영구 공식값이 아닙니다.**
  - 슬롯별 사내 후보는 RAW ← `INT_RAW_ADJUSTED`·`INT_SAM`입니다. TS·FPR은 사내 상당 항목을 정의한 뒤 후보로 등록합니다.
- **전환 조건(모두 충족)**:
  1. 사내 레코드 `APPROVED`
  2. 정의 `DIRECT`(외부 측정값과 동일 정의)
  3. 별도 출처 선택(selection) `APPROVED`
  4. 선택 승인자 ≠ 결정자 ≠ 업로더
  5. 고객·연도·범위 일치
  6. 운영 모드에서 합성 데이터 아님
- 자동 전환은 없습니다. 전환되면 외부값을 `replaced_external_value`로 함께 보존합니다.
- **CR / Target / 매출 계획**: 사내 승인값만 씁니다. 외부 대체는 없습니다.
  - Target Case·Stretch·Sales Plan은 **승인 목표로 자동 승격하지 않습니다.**
  - 승인 목표의 `derived_from_case_id`는 원천 케이스 값과 정확히 같아야 합니다.
- **상태 흐름**: SOURCE → VALIDATED → VERIFIED → APPROVED (REJECTED / SUPERSEDED). 공식 계산에는 APPROVED만 들어가고, 오류 레코드는 격리합니다.
- **현재**: 사내 레코드 0건, 전환 0건, 승인 Target 0/53, 신규 전략과제 승인 0/8.

## 6. 사내 SAM / RAW / CR / Target Case 연결 예정 위치
| 사내 항목 | 계약 measure | 저장 | 엔진·화면 연결 지점 |
|---|---|---|---|
| Internal SAM | `INT_SAM` | recon/records.json | `ledger.resolve_official`(RAW 슬롯 후보, 정의 DIRECT 후) · `ReconPanel` 사내 필드 'SAM' |
| Internal RAW(원본 · 역산 보정 · 보정 후) | `INT_RAW_SOURCE` · `INT_RAW_ADJ` · `INT_RAW_ADJUSTED` | 같음 | 3개 레코드로 분리 보존(C05 정합 경고만) · RAW 슬롯 후보 |
| Actual Revenue(CR) | `ACTUAL_REVENUE` | 현재: INTERNAL_ACTUAL 레이어 → `management_rows_for_build` → `m.2026.CR`. Phase 3B: recon 레코드와 일원화 | `models/build.py`(CR·C-SOW·PCR·Upside), `contract.resolve_official` CR 규칙(ACTUAL_FULL_YEAR가 FORECAST보다 우선, 합산 금지) |
| Sales Plan · Stretch | `SALES_PLAN` · `STRETCH` | recon | 승인된 Sales Plan → 매출 계획 경로(TS/RAW/FPR 보간을 대체하지 않음), Stretch는 비교 전용 |
| 2031 Target Case별 수치 | `TARGET_CASE`(`TARGET_CASE_<X>`, 원본 이름 보존) | recon | 비교 전용 · 승인 목표 원천 |
| Approved Target | `APPROVED_TARGET` | 현재: MANAGEMENT_TARGET 레이어 → `m.target.TARGET`(MANAGEMENT_APPROVED). Phase 3B: recon과 일원화 | build D1 · Target ≤ FPR_2031 점검(초과 시 값 유지 + 플래그) |
| 고객 파이프라인·계약 근거 | `INTERNAL_PIPELINE` · `INTERNAL_CONTRACT` 근거 | 사내 저장소만 | `strategy_actions` Demand 관점 근거로 추가 가능(링크 규칙 C11) |

## 7. 연도·금액 단위와 결측 처리 규칙
- **금액**: 내부 단위는 **억원**(Decimal)입니다. Import 시 원·천원·백만원·억원·조원을 환산하며, 원본 셀 문자열·단위·수식을 보존합니다. 환산값은 원본 × 단위계수와 **정확히 일치**해야 합니다(반올림하면 오류).
- **화면 표시**: 추정값은 유효숫자 2자리 '≈'(예: ≈5,600억원), 실측값은 1억 단위입니다.
- **VAT**: 외부 모델은 VAT 제외입니다. 사내 값은 `vat_basis`를 반드시 기재합니다(미확인 = UNKNOWN, Blocker B7).
- **연도**: 외부 TS 앵커는 고객 회계연도 기준입니다(예: 3월 결산 KA02는 FY2025 = 2025.04~2026.03). 이를 FY2026으로 환산합니다. 사내 매출은 U+ 회계연도(12월)이며 `fiscal_year`와 `as_of`를 함께 기록합니다.
- **결측**:
  - 값이 없으면 **NULL**이며, 0으로 대체하지 않습니다.
  - 상태는 RESEARCH GAP(INSUFFICIENT_EVIDENCE) 또는 사내 미입력(INTERNAL_REQUIRED)입니다.
  - 합계는 '근거가 있는 고객의 부분합'으로 표시하고 n/53을 함께 적습니다.
  - 성장률은 같은 고객 집합으로만 계산합니다.
- **불변식**: 0 ≤ FPR ≤ RAW ≤ TS, Target ≤ FPR_2031. 위반해도 값을 바꾸지 말고 `data_quality_issues`에 기록합니다.

## 8. 법인·그룹 Scope 처리 원칙
- TS는 원칙적으로 **별도 법인(KISA 공시 단위)** 기준입니다. 연결 재무를 쓰면 계열 중복이 생기므로 쓰지 않습니다(ACCOUNT_MASTER의 `economic_scope`·`exclusions` 참조).
- 중복 그룹(`config/overlap_groups.json`):
  - HIGH: CONSOLIDATION — 토스·카카오
  - MEDIUM: SUPPLIER_BUYER — GS, 하이퍼스케일러-MSP, DC 펀드, 금융 인프라
  - LOW: 금융그룹 계열사 — 별도 기준 합산 가능
  - ② 화면은 HIGH·MEDIUM 15개사를 '중복 위험'으로 표시하고 제외 토글을 제공합니다.
- 하이퍼스케일러 등 **정의 상이 5개사**(국내 인프라 투자·망 이용대가 환산 기준)는 합계와 우선순위에서 제외하고 따로 표시합니다.
- 사내 데이터는 `entity_scope`(STANDALONE · CONSOLIDATED · GROUP · DOMESTIC_ONLY)를 반드시 기재합니다. 외부와 범위가 다르면 비교 판정을 하지 않습니다.

## 9. Phase 3B 최소 구현 범위 (별도 승인 후)
1. 실제 사내 Excel 헤더를 계약 필드로 매핑합니다(`config/internal_header_map.json`). 사내 양식이 바뀌어도 코드는 바꾸지 않아도 되게 합니다.
2. Excel v2 새 시트 Import: INTERNAL_SAM_RAW, RAW_ADJUSTMENT, SALES_PLAN, STRETCH, TARGET_CASES → recon 레코드. 원본 보존·버전 추가·격리를 적용합니다.
3. 승인을 2단계(verify → approve)로 나누고 직무 분리를 적용합니다. 기존 1단계 approve는 하위 호환으로 유지합니다.
4. 출처 선택(selection) 승인 UI와 감사 로그를 만듭니다.
5. 계약의 승인값을 엔진 CR·Target에 연결합니다. 기존 INTERNAL_ACTUAL·MANAGEMENT_TARGET 경로와 일원화하되 D1 규칙은 유지합니다.
6. 고객 × 사업영역 대사 보고서와 REVIEW 사유 코드 입력.
7. 파일럿 3~5개사로 검증합니다(사내 PC 샌드박스). 회귀 세트 전체가 통과해야 합니다.

## 10. 미해결 Blocker와 우회 가능한 작업
| # | Blocker | 막히는 범위 | 우회·선행 가능 작업 |
|---|---|---|---|
| **B1** | 사내 Excel 실제 양식(헤더·행 단위·병합·수식) 미확인 | Excel v2 Import 전체 | 값을 지운 양식으로 헤더 매핑 초안 작성. 합성 데이터로 Import 파이프라인 선개발 |
| **B2** | Internal SAM 정의(TS 대응인지 RAW 상위인지, 무선·단말 포함 여부) | SAM 비교·전환 | 비교 불가(NOT_COMPARABLE) 상태로 값만 병기 |
| **B3** | RAW 역산 보정 산식·주체 | 사내 RAW 판정·전환 | 참고(REFERENCE_ONLY)로 차이율만 표시 |
| **B4** | Target Case 목록·승인 케이스 선정·승인권자 | 승인 목표 연결 | 기존 MANAGEMENT_TARGET 경로로 승인 목표만 입력 가능 |
| B5 | 사내 상품군 → 카테고리·사업영역 매핑 | 영역 단위 대사 | 계정(ACCOUNT) 단위 대사부터 |
| **B6** | 사내 고객 코드 ↔ KA01~53, 계열 합산 범위 | 모든 사내 레코드(미매핑 시 격리) | 사업자번호로 매핑표 작성 |
| B7 | 매출 인식 기준·VAT·단위 | CR 비교 정확도 | `vat_basis`·`entity_scope` UNKNOWN으로 기록 |
| **B8** | 사내 데이터 취급 보안 승인 | 실데이터 적재 | 샌드박스·합성 데이터 개발 |
| B9 | RACI(업로더·검증자·승인자) | 직무 분리 운영 | 역할 코드만 선반영 |
| B10 | Sales Plan·Stretch 연도 범위 | 매출 계획 경로 | B1과 함께 확인 |

**굵게 표시한 B1·B2·B3·B4·B6·B8은 실제 Import 전에 반드시 해소해야 합니다.**

## 11. 절대로 변경하면 안 되는 기존 계산 기준선
1. **53개사 TS/RAW/FPR 2026·2031 값**: `tests/fixtures/vnext_baseline.json`, `tests/test_vnext_baseline.py`. 의도적으로 바꿀 때는 화이트리스트 등록과 변경 로그(`data/phase1/MODEL_CHANGE_LOG.csv`)가 필수입니다.
2. **우선순위 산식과 점수**: 35×규모 + 20×성장 + 15×수요 고객 수 + 15×진입 가능성 + 15×수요 신뢰도 − 난이도.
   - Connectivity 73.3 · AI Infrastructure 63.4 · Data Center / IDC 63.3 · Cloud 47.2 · Security 39.6 · AI Transformation / SI 24.9 · SI / Managed Services 22.2 · 기타 20.3
   - 확인: `tests/test_phase3a_actions.py`
   - 근거 3관점은 점수에 넣지 않습니다.
3. **전략과제 8건**: 상태는 검증 필요 7 · 분석 가설 1, 승인 상태는 전부 PROPOSED(자동 승인 0). 3관점 판정 규칙은 `models/strategy_actions.py::RULES`.
4. **D1**: 공식 Target은 MANAGEMENT_APPROVED만입니다. 시나리오 목표는 KPI·합계에서 제외합니다.
5. **원천 조사 파일**(`data/raw/research*/`)은 수정하지 않습니다. 정정은 `config/research_corrections.json`·`account_overrides.json`·`model_parameters.json`으로만 합니다.
6. **성장 궤적 차트**: 끝값 = 엔진 값(954건 검증). 2027~2030은 CAGR 보간 예시이고, 이중축·누적을 쓰지 않으며, CR과 Target을 선으로 잇지 않습니다.
7. **용어**: 판서자 ①~⑧ 원문(`frontend/src/lib/glossary.ts`, "Realistical" 유지). 데이터 키·API 키는 표기를 바꾼다는 이유로 변경하지 않습니다.
8. **보안**: 사내 데이터는 외부 MCP·외부 LLM·Git으로 보내지 않습니다. 사내 데이터가 반영된 번들은 외부 반출 금지입니다(`tools/make_release.py` 차단).
