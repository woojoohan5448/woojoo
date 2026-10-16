# INTERNAL EXCEL INTEGRATION READINESS (STEP 5)

> data_version `20261016T051757Z` · 브랜치 `qa-final-audit` · 안전 체크포인트 태그 `v2.0-phase1-4-checkpoint` · 생성: `python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports`
> 이 보고서의 모든 수치는 `data/qa/*.csv`에서 재계산 가능하다. 사내 데이터는 포함되지 않았다(contains_internal_data=False).

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
| ID | 심각도 | 발견 사항 | 조치 | 상태 | 잔여 위험 |
|---|---|---|---|---|---|
| QA-I1 | HIGH | **승인 완료 배치를 '거부' 처리 가능(감사 추적 위조 위험)** — reject()가 상태 확인 없이 APPROVED 배치를 REJECTED로 변경 — 저장소에는 값이 반영된 채 이력만 '거부'로 바뀜. | PENDING_REVIEW만 거부 가능(API 409). 테스트 추가. | **FIXED** | 없음. |
| QA-I2 | HIGH | **행 선택이 빈 목록이면 전체 행이 승인됨** — approve(rows=[])가 'rows and …' 조건 때문에 모든 유효 행을 반영. | rows=None일 때만 전체, 빈 목록은 0행. 수정 전 코드로 테스트 실패 재현 확인. | **FIXED** | 없음. |
| QA-I3 | HIGH | **같은 계정의 FORECAST와 ACTUAL_FULL_YEAR 행이 CR에 합산(이중 계상)** — 두 기간 유형이 별도 키로 저장되어 CR_2026 = 예상 + 실적으로 계산됨(합성 테스트: 100+120=220). | ACTUAL_FULL_YEAR가 있으면 그것만, 없으면 FORECAST 합산. 수정 전 코드로 테스트 실패 재현 확인. | **FIXED** | 상품·계약 단위 행의 정의(부가세·대리점 수수료 포함 여부)는 사내 재무 기준과 대사 필요. |
| QA-I4 | HIGH | **v1 간이 입력 API가 미리보기·승인 없이 Git 추적 CSV에 사내 값을 직접 저장** — /api/management-inputs → data/internal_inputs/management_inputs.csv(.gitignore 예외로 추적됨) 즉시 갱신·재계산. | 기본 비활성화(410), KAI_ENABLE_LEGACY_INPUT=1일 때만 허용. CSV 경유 값에는 LEGACY_DIRECT_INPUT 경고. 화면 문구 정정. | **FIXED** | 레거시 활성화 시 Git 커밋 위험 — 사내 저장소 pre-commit 훅 권장. |
| QA-I5 | MEDIUM | **APPROVED_ACCOUNT_PLAN 레이어는 저장·이력만 되고 모델·화면에 미반영** — ACCOUNT_PLAN 시트 승인 시 레이어에 저장되나 build가 소비하지 않음. | 변경 없음(확장 포인트로 문서화). | **OPEN** | 영업 추정과 외부 추정 차이를 '승인된 Account Plan 값으로 확정'하는 마지막 단계는 수작업. |

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
