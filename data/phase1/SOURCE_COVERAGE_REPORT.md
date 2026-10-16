# SOURCE COVERAGE REPORT — Phase 1

data_version 20261016T123435Z

## 1. 커버리지 지표

| 지표 | 기준선(v1) | 현재 | 산식 |
|---|---|---|---|
| External Estimable Coverage | 63.5% (202/318) | **90.8%** (286/315) | 유효 값(검증·파생·근거 기반 추정) 필드 / 외부 추정 가능 필드(NOT_APPLICABLE 제외) |
| N/A Recovery Rate | — | **72.4%** (84/116) | 복구된 외부 결측 필드 / 최초 외부 결측 필드 |
| Missing Evidence Count (외부) | 116 | **29** | INSUFFICIENT_EVIDENCE 필드 수 |
| Internal Required Count | 318 | 318 | CR·C-SOW·PCR·Upside·Target·Target SOW (사내 데이터) |
| NOT_APPLICABLE | 0 | 3 | 지표 비적용(키암코 DC 2026 미운영) |
| Verified Evidence Coverage (TS 앵커) | — | 23/47 (49%) | TS 앵커 입력 중 원천 직접 확인(VERIFIED) 사실 포함 고객 / TS 산출 고객 |
| Source Traceability Rate (2026 지표) | — | 143/143 (100%) | 산식+출처/가정 연결된 값 / 값 존재 지표 |
| 등급 분포 (전체 필드) | {'ESTIMATED_HIGH': 13, 'ESTIMATED_MEDIUM': 53, 'ESTIMATED_LOW': 136, 'INTERNAL_REQUIRED': 318, 'INSUFFICIENT_EVIDENCE': 116} | {'ESTIMATED_HIGH': 10, 'ESTIMATED_MEDIUM': 53, 'ESTIMATED_LOW': 223, 'INTERNAL_REQUIRED': 318, 'INSUFFICIENT_EVIDENCE': 29, 'NOT_APPLICABLE': 3} | |

## 2. Phase 1 신규 근거
- 보충 조사 파일 44개 고객, 신규 사실 293건, 신규 근거 210건
- 신규 근거 검증 상태: SECONDARY_UNCONFIRMED 58, VERIFIED 152
- 신규 근거 원천별: MyDART/DART 원문 140, WebSearch(보도) 52, OpenDART API 10, COMPANY_IR 2, GOV_DATA 2, KR-BID 2, BENCHMARK 2
- source_type: DART_AUDIT_REPORT 116, NEWS 37, DART_FILING 22, KISA_DISCLOSURE_VIA_PRESS 15, DART_API 12, GOV_DATA 4, COMPANY_IR 2, BENCHMARK 2

## 3. TS 앵커 방법 변화 (v1 → 현재)

| 방법 | v1 | 현재 |
|---|---|---|
| ACCOUNT_SPECIFIC | 1 | 9 |
| AUDIT_IT_COMPONENTS | 0 | 11 |
| DIRECT_IT_BUDGET | 1 | 0 |
| KISA_IT_INVESTMENT | 10 | 17 |
| KISA_SEC_SCALED | 4 | 3 |
| REVENUE_INTENSITY | 17 | 7 |
| UNKNOWN | 20 | 6 |

## 4. 독립 근거 판정
- MyDART·OpenDART·koreaStock DART 데이터는 동일 원천 → 독립 근거 1건으로 계산.
- KR-BID·나라장터는 동일 원천(G2B).
- 동일 보도를 인용한 복수 기사는 1건으로 계산.
