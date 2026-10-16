# DATA DICTIONARY (v1.0)

단위: 금액 **억원(KRW)**, 비율 0~1 소수(화면 표시는 %). 금액은 SQLite에 TEXT decimal 문자열로 저장(부동소수점 오차 방지), JSON 출력 시 소수 2자리.

## 1. 데이터 계층
| 계층 | 위치 | 설명 |
|---|---|---|
| Raw | `data/raw/research/KAxx.json` | 조사 원본(불변). RESEARCH_PROTOCOL 스키마 |
| Raw (시장) | `data/raw/research/_MARKET_BENCHMARKS.json`, `_KISA_DEFINITION.json` | 시장 벤치마크·정의 근거 |
| Config | `config/*.json`, `accounts_seed.csv` | 파라미터(가정), 계정 보정, 원천 보정, 중복 그룹, 전략 평가 |
| Internal | `data/internal_inputs/management_inputs.csv` | 사내 CR·Target 입력(관리자) |
| Processed | `data/processed/intel.db`, `dashboard.json`, `metric_history.csv` | 모델 결과·버전 이력 |
| Exports | `data/exports/*.csv, *.xlsx` | 내보내기 |
| Frontend | `frontend/src/data/dashboard.json` | 번들용 사본(정적 빌드) |
| Test fixtures | 테스트 코드 내 `TEST-ONLY` 합성값 | 실제 데이터에 저장되지 않음 |

## 2. SQLite 테이블 (`backend/schema.sql`)
| 테이블 | 키 | 주요 컬럼 |
|---|---|---|
| accounts | account_id | original_name, segment, family, research_status, aggregate_class, overlap_groups, data_version |
| account_entities | account_id | legal_name_ko/en, corp_code, stock_code, business_reg_no, parent_group, is_korean_entity, dart_available, economic_scope, exclusions, entity_status, entity_notes |
| financial_facts | fact_id | account_id, metric, fiscal_year, value, unit, scope, verification_status, evidence_ids |
| it_spending_components | (account_id, year, scenario, category) | ts_value, raw_value, fpr_value |
| account_metrics | (account_id, metric, year, scenario, addr_case, data_version) | value, low, high, unit, status, confidence, formula, evidence_ids, assumption_ids |
| forecast_assumptions | driver_id | account_id, type, description, amount, unit, period, evidence_ids |
| competitive_assumptions | — | account_id, category, observation, incumbent, lgu_relationship |
| evidence_sources | evidence_id | tier, source_type, source_title, publisher, source_url, document_id, publication_date, accessed_at, fiscal_period, page_or_section, quoted_statement, reported_value, reported_unit, verification_status, notes, source_hash |
| metric_evidence_links | — | account_id, metric, year, scenario, evidence_id |
| data_quality_issues | — | account_id, severity(ERROR/WARN/INFO), code, message, metric, year, scenario |
| management_inputs | account_id | cr_2026_ytd_eok, cr_2026_forecast_eok, cr_basis, target_revenue_2031_eok, target_basis, updated_at |
| strategic_opportunities | area | fpr_2026, fpr_2031, fpr_cagr, n_accounts, priority_score, recommendation_type |
| research_runs | data_version | run_at, summary |
| (CSV) metric_history.csv | — | 빌드마다 append: data_version, account_id, metric, year, scenario, value, status, confidence |

## 3. 지표 코드
| 코드 | 정의 | 산식 |
|---|---|---|
| TS | Customer Total IT Spending | 앵커 × (1+g)^(2026−FY) (METHODOLOGY §3) |
| RAW | Realistically Addressable Wallet | Σ TS_i × Addressability_i |
| FPR | U+ Full Potential Revenue | Σ RAW_i × Capture_Ceiling_i |
| CR | Current Revenue 2026 | 사내 입력(연말 예상), NULL 허용 |
| CSOW | Current Share of Wallet | CR / RAW |
| PCR | Potential Capture Rate | CR / FPR |
| UPSIDE | Upside 2026 | FPR − CR |
| TARGET | 2031 Target Revenue | 경영진 입력 또는 FPR_2031×0.5(SCENARIO) |
| TARGET_SOW | Target SOW | Target / RAW_2031(base) |
| UPSIDE_2031 | Estimated Upside 2031 | FPR_2031(base) − CR_2026 |
| TARGET_INCREMENT | Target 증분 | Target − CR_2026 |
| TS/RAW/FPR_CAGR | 5년 CAGR | (V2031/V2026)^(1/5) − 1 |

`addr_case`: base(현 역량) / expansion(Strategic Expansion Case). `scenario`: low / base / high.

## 4. 상태·분류 코드
- 지표 status: VERIFIED, DERIVED, ESTIMATED, SCENARIO, UNKNOWN
- 사실 verification_status: VERIFIED(DART API 등 원천 직접), DERIVED(확정 산식), SECONDARY_UNCONFIRMED(검색 인용·원문 미열람)
- research_status: NOT_STARTED, ENTITY_RESOLVED, SOURCES_COLLECTED, MODEL_ESTIMATED, EVIDENCE_VERIFIED, QUALITY_APPROVED, NEEDS_REVIEW
- aggregate_class: COMPARABLE, OVERLAP_RISK, DEFINITION_MISMATCH, EXCLUDED_UNKNOWN
- TS anchor method: DIRECT_IT_BUDGET, KISA_IT_INVESTMENT, KISA_DERIVED, KISA_SEC_SCALED, ACCOUNT_SPECIFIC, REVENUE_INTENSITY, UNKNOWN
- 카테고리: CONNECTIVITY, DC_COLO, CLOUD, AI_INFRA, SECURITY, SI_BUILD, IT_OPS, SW_LICENSE, HW_DEVICE, INTERNAL_LABOR

## 5. 가정 ID
A-MIX(카테고리 구성), C-ADDR(접근률), C-CAP(포획 상한), B-INT(IT 집약도), B-G26(2026 환산 성장률), B-BRIDGE(2031 브리지), B-ALLOC(증분 배분), B-RANGE(불확실성 폭), B-SECR(정보보호/IT 비율 대체), B-FX(환율 1,400), D-TGT(시나리오 목표). 근거 맵: `config/parameter_evidence.json`.

## 6. 확장 포인트 (§11, 미구현)
`frontend/src/types.ts` `ProductRevenuePoint {account_id, year, product, lgu_revenue, capture_rate, competitor_shares, status, evidence_ids}` — 사내 상품 매출 피드 연결 시 `extensions/ProductRevenueDrilldown.tsx`에서 렌더.
