# DATA QUALITY & VALIDATION REPORT

data_version 20261016T051757Z · 생성 2026-10-16T05:17:59.039153+00:00

## 1. 요약

- 원천 사실(Layer A) 780건: VERIFIED 514, DERIVED 65, SECONDARY_UNCONFIRMED 201
- 지표 레코드(2026 7종 + 2031 시나리오·케이스 15종 + Target 2종 × 53개사) 1272건: ESTIMATED 272, UNKNOWN 316, SCENARIO 684
- 2026 지표 상태: TS → ESTIMATED 43, SCENARIO 4, UNKNOWN 6; RAW → ESTIMATED 43, SCENARIO 5, UNKNOWN 5; FPR → ESTIMATED 43, SCENARIO 5, UNKNOWN 5; CR → UNKNOWN 53
- TS 앵커 방법: KISA_IT_INVESTMENT 17, AUDIT_IT_COMPONENTS 11, ACCOUNT_SPECIFIC 9, REVENUE_INTENSITY 7, UNKNOWN 6, KISA_SEC_SCALED 3
- 무결성 이슈: ERROR 0 · WARN 20 · INFO 167

> **VERIFIED 지표가 0건인 이유**: TS_2026은 FY2026 연간 '예상치'이므로 정의상 ESTIMATED이며, FY2025 앵커(KISA 공시)도 이 환경에서 원문 페이지를 열 수 없어(WebFetch DNS 차단) 검색 인용(SECONDARY_UNCONFIRMED)으로 분류했다. DART API로 직접 조회한 재무 사실만 VERIFIED이다.

## 2. 자동 검증 항목과 결과

| 검증 | 결과 |
|---|---|
| 53개 고객 존재·원본명 불변 | PASS (tests/test_model.py) |
| RAW ≤ TS, FPR ≤ RAW (2026, 2031 × 3 시나리오 × 2 케이스) | PASS |
| Target ≤ FPR_2031(base) | PASS |
| CR NULL → C-SOW·PCR·Upside N/A (0 대체 금지) | PASS |
| CAGR 재계산 일치 | PASS |
| 산식·출처/가정 계보 존재 | PASS |
| 지표 근거 ID → Evidence 해석 가능 | PASS |
| 정의 상이(하이퍼스케일러) 합계 제외 | PASS |
| 가상 테스트 데이터 혼입 없음(is_test_data=false) | PASS |
| 합성 CR 입력 시 C-SOW/PCR/Upside 산식, CR>FPR 경고, Target>FPR 오류 | PASS (TEST-ONLY 합성값, 저장 안 함) |
| API 입력 검증(음수·문자·근거 누락·미존재 ID 거부) | PASS (tests/test_api.py) |
| 브라우저 E2E: 막대 클릭→Inspector, 시나리오·고객 전환 동기화, 미확인 고객 0 미표시, 6개 탭 렌더, JS 오류 0 | PASS 14/14 (tests/e2e) |

## 3. 파일럿에서 발견·수정한 모델 결함

1. **메트릭 오분류(COR-001)**: 국민은행 '2026 IT 예산 860.75억'은 정보보호 예산 → 그대로 쓰면 TS가 84% 과소. 보정 파일로 재분류(원천 불변), 예산<KISA 50% 시 기각하는 교차검증 추가.
2. **매출 대비 IT 집약도 과대**: KG모빌리티 사전값 1.5% 적용 시 636억 vs KISA 실측 240억(0.57%). → 산업군별 실측 중앙값 보정(n≥2) 도입, 사전값 하향.
3. **증권사 영업수익 왜곡**: 트레이딩 총수익 포함(미래에셋 21조) → 금융사는 판관비 기준 집약도로 전환. 실측 4개사 10.8~12.9%로 일관(중앙값 12.5%).
4. **판관비 정의 불일치(COR-002)**: 미래에셋 인건비 별도 계상 → 합산.
5. **전략 엔진 정의 혼합**: 하이퍼스케일러(국내 투자 기준) 수요가 사업영역 합계에 혼입 → 별도 열로 분리.
6. **비교 축 왜곡**: 2026/2031 그리드 폭 불일치 → 동일 폭·동일 최대값으로 수정(단위 테스트로 고정).

## 4. IT 집약도 실증 보정

| 산업군 | 방식 | 분모 | n | Low | Base | High |
|---|---|---|---|---|---|---|
| FIN | EMPIRICAL | sga | 5 | 10.4% | 12.5% | 12.9% |
| FINTECH | PRIOR | revenue | 1 | 10.0% | 15.0% | 20.0% |
| ITS | PRIOR | revenue | 1 | 3.0% | 5.0% | 9.0% |
| PLATFORM | PRIOR | revenue | 0 | 6.0% | 9.0% | 12.0% |
| CLOUD_DC | PRIOR | revenue | 0 | 15.0% | 25.0% | 35.0% |
| INDUSTRY | PRIOR | revenue | 1 | 0.4% | 0.8% | 1.5% |
| RETAIL_SVC | PRIOR | revenue | 0 | 0.8% | 1.2% | 2.0% |
| PUBLIC | PRIOR | revenue | 0 | 0.3% | 0.6% | 1.0% |

## 5. 경고(WARN) 상세

- [WARN] KA06 구글클라우드 · ENTITY_MAPPING: 법인 매핑 PROBABLE: DART 외부감사 감사보고서 FY2022~FY2025 공시 확인(외감 대상). 그러나 OpenDART get_financial_account는 감사보고서 제출사 재무를 제공하지 않아(status 013) 매출 원문 미확인. LG U+ IDC 임차 계약의 실제 계약 주체는 Google LLC 또는 해외 인프라 법인일 가능성 — 국내 법인 매출에 클라우드 인프
- [WARN] KA07 마이크로소프트 · ENTITY_MAPPING: 법인 매핑 PROBABLE: DART 감사보고서 FY2023.06~FY2026.06 공시 확인(최신 2026-10-14 제출). OpenDART 재무 API는 status 013 → 원문 매출 미확인. Azure 리전 DC 소유/임차 주체(해외 MS 인프라 법인 가능)·위치 비공개.
- [WARN] KA08 아마존 · ENTITY_MAPPING: 법인 매핑 PROBABLE: DART에 'Amazon Web Services Korea LLC'(01468283) 고유번호 존재하나 2023-01-01~2026-10-16 공시검색 및 FY2025 재무계정 조회 결과 데이터 없음(status 013). 보도(이데일리, 웹검색 요약)에 따르면 AWS코리아는 유한책임회사로 법인형태를 전환하여 신외감법상 감사보고서 공시 대상에서 제외됨 → 
- [WARN] KA26 한국투자증권(주) · KISA_SWING: KISA IT 투자액 연간 변동폭 최대 40% — 정의·범위 변화 여부 확인 필요
- [WARN] KA27 (주)비바리퍼블리카 · KISA_SWING: KISA IT 투자액 연간 변동폭 최대 94% — 정의·범위 변화 여부 확인 필요
- [WARN] KA28 코람코자산운용 · ENTITY_MAPPING: 법인 매핑 PROBABLE: '코람코자산운용' 정확 일치 00802213(대표 박형석, 강남구 삼성로 511). 단 LG U+ B2B 관계가 운용사 본체인지 데이터센터 펀드/리츠인지 불명 → PROBABLE. 데이터센터 펀드·LG U+ IDC 관련 사실은 검색 한도 소진으로 미확인.
- [WARN] KA29 쿠팡(주) · KISA_SWING: KISA IT 투자액 연간 변동폭 최대 60% — 정의·범위 변화 여부 확인 필요
- [WARN] KA41 신용협동조합 · ENTITY_MAPPING: 법인 매핑 UNCERTAIN: 원명 '신용협동조합'은 개별 조합 총칭이라 구매 주체는 중앙회(전산센터 운영)로 추정. OpenDART find_company('신용협동조합중앙회')→00298827 확인되나 company_info의 대표(박진우)·주소(서초구 방배4동)는 갱신되지 않은 과거 정보로 보이며(현 본부 대전으로 알려짐, 미검증), 2025-01~2026-10 공시 0건. 재무·
- [WARN] KA42 Fastly, Inc. · ENTITY_MAPPING: 법인 매핑 UNCERTAIN: DART '패스틀리' not_found, 웹검색상 한국 법인·지사 미확인 → LG U+ 계약 주체는 Fastly, Inc.(미국) 또는 아태 법인으로 추정. 서울 POP의 IDC·트랜짓 공급사 미확인.
- [WARN] KA43 Valve Corporation · ENTITY_MAPPING: 법인 매핑 UNCERTAIN: DART '밸브코퍼레이션' not_found, 한국 법인 미확인. 비상장으로 공식 재무 없음. 한국 CDN 노드 일부는 StackPath 등 제3자 CDN 위에 운영(Netify) → LG U+ 실거래 상대가 Valve인지 CDN 사업자인지 불확실.
- [WARN] KA44 차이나유니콤 · ENTITY_MAPPING: 법인 매핑 PROBABLE: DART 감사보고서 FY2023~FY2025 공시(외감) 확인, 재무 API 미제공. 로밍·해저케이블 정산은 본사(China Unicom/China Unicom Global HK) 직접 계약일 가능성 — 한국 법인은 기업 고객 국제전용회선 판매 위주로 추정.
- [WARN] KA45 페이스북 · ENTITY_MAPPING: 법인 매핑 UNCERTAIN: DART상 법인명은 여전히 '페이스북코리아 유한회사'(메타플랫폼스코리아 검색 시 not_found). 감사보고서 FY2022~FY2025 공시 확인, 재무 API status 013. 망 이용·캐시서버 계약은 국내 법인이 아니라 Meta Platforms(해외) 계약 가능성이 높아 LG U+ 구매 주체 매핑 불확실.
- [WARN] KA46 한국오라클 · ENTITY_MAPPING: 법인 매핑 PROBABLE: DART 감사보고서 FY2023.05~FY2026.05 공시(최신 2026-09-14 기재정정). 재무 API status 013. OCI 리전 DC 임차 계약 주체는 해외 Oracle 인프라 법인일 가능성.
- [WARN] KA51 토스뱅크 · KISA_SWING: KISA IT 투자액 연간 변동폭 최대 43% — 정의·범위 변화 여부 확인 필요

## 6. 이슈 코드 분포

- INFO CORRECTION_APPLIED: 2
- INFO CR_NULL: 53
- INFO SOURCE_NOT_OPENED: 11
- INFO SOW_COMPARE_NA: 53
- INFO TARGET_SCENARIO: 48
- WARN ENTITY_MAPPING: 10
- WARN KISA_SWING: 4
- WARN TS_UNKNOWN: 6
