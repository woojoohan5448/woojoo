# SOURCE TRACEABILITY REPORT — 근거·산식 연결 검증 (STEP 1~2)

> data_version `20261016T051757Z` · 브랜치 `qa-final-audit` · 안전 체크포인트 태그 `v2.0-phase1-4-checkpoint` · 생성: `python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports`
> 이 보고서의 모든 수치는 `data/qa/*.csv`에서 재계산 가능하다. 사내 데이터는 포함되지 않았다(contains_internal_data=False).

## 1. 결과
| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| 값이 있는 지표 레코드(2026·2031 base TS/RAW/FPR) | 286 | 286 |
| 산식 보유 + 근거 ID 해석 가능 | 283 | 286 |
| 계정 근거 목록에 없는 근거 ID | 0 | 0 |
| parameter_evidence 미등록 가정 ID | B-ALLOC, B-RANGE | 없음 |
| 근거 ID 0개 레코드(산업 평균 방식 제외 시 오류) | 3 | 0  |

- 수정 전 근거 ID 0개 레코드 3건은 KA32(계약 기반 RAW)의 FPR_2026·RAW_2031·FPR_2031이었다(QA-04). 산업 평균 계정은 매출·판관비 사실의 근거 ID와 가정 ID(B-INT)로 연결되어 있다.
- 원천 조사 파일 해시(`source_hash`)·보충 파일 해시가 계정마다 기록되어 있어 값의 재현 경로가 고정된다.

## 2. 출처 유형별 분포
| 근거 유형 | 앵커 근거 출처 유형 | 계정 수 |
|---|---|---|
| 계약 기반(RAW만) | — | 1 |
| IT지출 공시값 | KISA_DISCLOSURE_VIA_PRESS | 11 |
| 산업 평균 적용 추정 | DART_API | 4 |
| 산업 평균 적용 추정 | DART_AUDIT_REPORT | 2 |
| 산업 평균 적용 추정 | NEWS | 1 |
| 근거 없음(RESEARCH GAP) | — | 5 |
| 재무항목 재구성 추정 | DART_AUDIT_REPORT | 14 |
| 재무항목 재구성 추정 | KISA_DISCLOSURE_VIA_PRESS | 8 |
| 재무항목 재구성 추정 | DART_FILING | 2 |
| 재무항목 재구성 추정 | KISA_DISCLOSURE_VIA_PRESS;NEWS | 1 |
| 시나리오 | NEWS | 2 |
| 시나리오 | GOV_DATA;NEWS | 1 |
| 시나리오 | DART_AUDIT_REPORT;NEWS | 1 |

출처 유형: `DART_API`·`DART_AUDIT_REPORT`·`DART_FILING`=전자공시 원문(1차), `KISA_DISCLOSURE_VIA_PRESS`=KISA 정보보호 공시값의 언론 인용(2차), `NEWS`·`PRESS_RELEASE`=보도(2차), `GOV_DATA`·`BENCHMARK`=통계·벤치마크.

## 3. 계정별 TS 앵커 근거 연결 (53개)
| ID | 고객 | 앵커 방법 | FY | 앵커 값(억) | 앵커 상태 | 입력 상태 | 근거 ID | 출처 유형 | 근거 검증 상태 | 산식 |
|---|---|---|---|---|---|---|---|---|---|---|
| KA01 | (주)엘지씨엔에스 | KISA_IT_INVESTMENT | 2025 | 4,698.3 | SECONDARY_UNCONFIRMED | — | KA01-E04 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^1 (B-G26) |
| KA02 | 한국토요타자동차 | REVENUE_INTENSITY | 2025 | 120.8 | ESTIMATED | — | KA02-E01 | NEWS | SECONDARY_UNCONFIRMED | TS_FY2025 = 매출(revenue) × 산업 IT 집약도 0.0080 (B-INT, Tier 3) → × (1+0.04)^1 (B-G26) |
| KA03 | 국민은행 | KISA_IT_INVESTMENT | 2025 | 5,315.0 | SECONDARY_UNCONFIRMED | — | KA03-E12 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^1 (B-G26) |
| KA04 | 신한카드(주) | REVENUE_INTENSITY | 2025 | 973.9 | ESTIMATED | — | KA04-E06 | DART_API | VERIFIED | TS_FY2025 = 판관비(sga) × 산업 IT 집약도 0.1252 (B-INT, Tier 3) → × (1+0.05)^1 (B-G26) |
| KA05 | 한국전력공사 | REVENUE_INTENSITY | 2025 | 5,732.2 | ESTIMATED | — | KA05-E10 | DART_API | VERIFIED | TS_FY2025 = 매출(revenue) × 산업 IT 집약도 0.0060 (B-INT, Tier 3) → × (1+0.03)^1 (B-G26) |
| KA06 | 구글클라우드 | ACCOUNT_SPECIFIC | 2025 | 1,236.2 | ESTIMATED | — | KA06-P1-E01, KA06-P1-E02, KA06-P1-E04, KA06-P1-E05 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025(국내 인프라 지출) = 설비관련비용 352.8억 + 네트워크장비 취득 421.0억 + 리스 지출 462.5억 = 1,236.3억 (구글클라우드코리아 감사보고서). 교차검증: 서울 리전 인프라 운영지원 수익 1,142.6억(원가가산)  |
| KA07 | 마이크로소프트 | ACCOUNT_SPECIFIC | 2026 | 2,550.0 | SCENARIO | — | KA07-P1-E08, DCB-E01 | NEWS | SECONDARY_UNCONFIRMED | TS_2026(시나리오, L6 용량 모델) = 부산 리전 운영 용량 85MW(Tier3 단독) × 코로케이션 임대료 30.0억/MW/년(수도권 25만원/kW/월 가정, DCB01) — 부산은 수도권보다 낮을 수 있음 |
| KA08 | 아마존 | ACCOUNT_SPECIFIC | 2026 | 14,000.0 | SCENARIO | — | KA08-E03, KA08-E04 | NEWS | SECONDARY_UNCONFIRMED | TS_2026(국내 인프라 투자 연평균) = 아마존 한국 누적 투자 전망 12.6조원 ÷ 9년(2023~2031) ≈ 1.4조원/년 |
| KA09 | (주)카카오 | KISA_IT_INVESTMENT | 2025 | 8,303.3 | DERIVED | — | KA09-E05 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.07)^1 (B-G26) |
| KA10 | 네이버클라우드 | KISA_IT_INVESTMENT | 2024 | 6,529.0 | DERIVED | — | KA10-E03 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2024 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.12)^2 (B-G26) |
| KA11 | (주)신세계아이앤씨 | KISA_IT_INVESTMENT | 2023 | 560.3 | SECONDARY_UNCONFIRMED | — | KA11-P1-E04 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2023 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^3 (B-G26) |
| KA12 | (주)에스원 | KISA_IT_INVESTMENT | 2024 | 572.8 | SECONDARY_UNCONFIRMED | — | KA12-P1-E06 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2024 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.03)^2 (B-G26) |
| KA13 | 롯데이노베이트(주) | REVENUE_INTENSITY | 2025 | 518.2 | ESTIMATED | — | KA13-E02 | DART_API | VERIFIED | TS_FY2025 = 매출(revenue) × 산업 IT 집약도 0.0500 (B-INT, Tier 3) → × (1+0.05)^1 (B-G26) |
| KA14 | 삼성에스디에스(주) | KISA_SEC_SCALED | 2025 | 5,704.4 | ESTIMATED | — | KA14-E04, KA14-E03 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | 정보기술부문 투자액 = 정보보호부문 투자액 ÷ 정보보호/IT 비율(인접 연도(FY2023) 자사 공시 비율) → × (1+0.05)^1 (B-G26) |
| KA15 | 지에스네오텍(주) | ACCOUNT_SPECIFIC | 2025 | 148.6 | ESTIMATED | — | KA15-P1-E01 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = (매출 5,241.5억 − 용역원가 3,429억[고객 재판매·서비스 원가]) × IT서비스 집약도 8.2%(LG CNS 8.6%·CJ올리브 7.7% 평균) — MSP 재판매 매출에 집약도를 그대로 곱하면 과대 → × (1+0.12 |
| KA16 | 지에스리테일 | AUDIT_IT_COMPONENTS | 2025 | 1,111.5 | DERIVED | VERIFIED | KA16-P1-E02 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 666.9억 ÷ 포괄률 0.600 [CORP_전산비: 분석가 가정(실측 없음): 일반기업 판관비 전산비·전산수수료가 IT 비용의 약 60%] → × (1+0.03)^1 (B-G26) |
| KA17 | 현대엘리베이터 | AUDIT_IT_COMPONENTS | 2025 | 283.4 | DERIVED | VERIFIED | KA17-P1-E02 | DART_FILING | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 170.0억 ÷ 포괄률 0.600 [CORP_전산비: 분석가 가정(실측 없음): 일반기업 판관비 전산비·전산수수료가 IT 비용의 약 60%] → × (1+0.04)^1 (B-G26) |
| KA18 | (주)신한은행 | KISA_IT_INVESTMENT | 2025 | 4,634.0 | SECONDARY_UNCONFIRMED | — | KA18-P1-E01 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^1 (B-G26) |
| KA19 | (주)우리은행 | KISA_IT_INVESTMENT | 2025 | 3,998.0 | DERIVED | — | KA19-E09 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^1 (B-G26) |
| KA20 | (주)우리카드 | AUDIT_IT_COMPONENTS | 2025 | 690.3 | DERIVED | VERIFIED | KA20-P1-E01 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 323.0억 ÷ 포괄률 0.468 [FIN_전산업무비: 실측 n=2: 국민은행 전산업무비 2,530.8/KISA IT 5,315=0.476, 우리은행 1,849.2/4,016.8=0.460 ( |
| KA21 | (주)케이비국민카드 | AUDIT_IT_COMPONENTS | 2025 | 1,562.7 | DERIVED | VERIFIED | KA21-P1-E01 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 731.4억 ÷ 포괄률 0.468 [FIN_전산업무비: 실측 n=2: 국민은행 전산업무비 2,530.8/KISA IT 5,315=0.476, 우리은행 1,849.2/4,016.8=0.460 ( |
| KA22 | (주)하나은행 | KISA_IT_INVESTMENT | 2025 | 4,121.0 | SECONDARY_UNCONFIRMED | — | KA22-P1-E01 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^1 (B-G26) |
| KA23 | (주)한국스탠다드차타드은행 | AUDIT_IT_COMPONENTS | 2025 | 1,233.4 | DERIVED | VERIFIED | KA23-P1-E01 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 577.2억 ÷ 포괄률 0.468 [FIN_전산업무비: 실측 n=2: 국민은행 전산업무비 2,530.8/KISA IT 5,315=0.476, 우리은행 1,849.2/4,016.8=0.460 ( |
| KA24 | 농협은행 | REVENUE_INTENSITY | 2025 | 5,044.4 | ESTIMATED | — | KA24-P1-E01 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 판관비(sga) × 산업 IT 집약도 0.1252 (B-INT, Tier 3) → × (1+0.05)^1 (B-G26) |
| KA25 | 미래에셋증권(주) | AUDIT_IT_COMPONENTS | 2025 | 2,099.7 | DERIVED | VERIFIED | KA25-P1-E01 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 982.6억 ÷ 포괄률 0.468 [FIN_전산업무비: 실측 n=2: 국민은행 전산업무비 2,530.8/KISA IT 5,315=0.476, 우리은행 1,849.2/4,016.8=0.460 ( |
| KA26 | 한국투자증권(주) | KISA_IT_INVESTMENT | 2025 | 1,770.0 | DERIVED | — | KA26-E10 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^1 (B-G26) |
| KA27 | (주)비바리퍼블리카 | KISA_IT_INVESTMENT | 2025 | 1,943.4 | SECONDARY_UNCONFIRMED | — | KA27-E08 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.1)^1 (B-G26) |
| KA28 | 코람코자산운용 | UNKNOWN | — | — | UNKNOWN | — | — | — | — | 근거 부족 — 추정 불가 |
| KA29 | 쿠팡(주) | KISA_IT_INVESTMENT | 2025 | 25,725.0 | SECONDARY_UNCONFIRMED | — | KA29-E02 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.07)^1 (B-G26) |
| KA30 | 메르세데스벤츠코리아(주) | AUDIT_IT_COMPONENTS | 2025 | 834.8 | DERIVED | VERIFIED | KA30-P1-E03 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 500.9억 ÷ 포괄률 0.600 [CORP_전산비: 분석가 가정(실측 없음): 일반기업 판관비 전산비·전산수수료가 IT 비용의 약 60%] → × (1+0.04)^1 (B-G26) |
| KA31 | 씨제이올리브네트웍스(주) | KISA_IT_INVESTMENT | 2024 | 609.4 | SECONDARY_UNCONFIRMED | — | KA31-P1-E06 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2024 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^2 (B-G26) |
| KA32 | 주한미군 | UNKNOWN | — | — | UNKNOWN | — | — | — | — | 근거 부족 — 추정 불가 |
| KA33 | 케이지모빌리티 | KISA_IT_INVESTMENT | 2025 | 240.0 | SECONDARY_UNCONFIRMED | — | KA33-E50 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.04)^1 (B-G26) |
| KA34 | (주)아이비케이시스템 | ACCOUNT_SPECIFIC | 2025 | 46.4 | ESTIMATED | — | KA34-P1-E02 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 자체 IT 소비 프록시(감가상각+무형상각) 23.2억 ÷ IT서비스 포괄률 0.5. 교차검증: 비통과 매출(3,986.9억×18%)×8.2% ≈ 58.8억. 매출의 82%는 IBK기업은행 대상 통과성 원가 → × (1+0.05)^ |
| KA35 | (주)케이비손해보험 | AUDIT_IT_COMPONENTS | 2025 | 1,217.3 | DERIVED | VERIFIED | KA35-P1-E02 | DART_FILING | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 569.7억 ÷ 포괄률 0.468 [FIN_전산업무비: 실측 n=2: 국민은행 전산업무비 2,530.8/KISA IT 5,315=0.476, 우리은행 1,849.2/4,016.8=0.460 ( |
| KA36 | (주)코스콤 | REVENUE_INTENSITY | 2025 | 238.5 | ESTIMATED | — | KA36-P1-E01 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 매출(operating_revenue) × 산업 IT 집약도 0.0500 (B-INT, Tier 3) → × (1+0.05)^1 (B-G26) |
| KA37 | 대신증권(주) | KISA_SEC_SCALED | 2025 | 682.9 | ESTIMATED | — | KA37-E11, KA37-E10 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | 정보기술부문 투자액 = 정보보호부문 투자액 ÷ 정보보호/IT 비율(인접 연도(FY2024) 자사 공시 비율) → × (1+0.05)^1 (B-G26) |
| KA38 | 새마을금고중앙회 | ACCOUNT_SPECIFIC | 2026 | 1,561.0 | SCENARIO | — | KA38-P1-E01, KA38-P1-E02, KA38-P1-E03 | GOV_DATA;NEWS | SECONDARY_UNCONFIRMED;VERIFIED | TS_2026(L3 계약 기반 하한 시나리오) = 차세대 3,370억(VAT 포함, 28개월)÷1.1÷28×12 = 1,313억 + 생성형 AI 인프라 250억(11개월)÷1.1÷11×12 = 248억. 기존 운영비 미포함 → 하한, 착수 시점·낙찰자 |
| KA39 | 엔에이치투자증권(주) | KISA_SEC_SCALED | 2025 | 1,631.6 | ESTIMATED | — | KA39-E10, KA39-E11, KA39-E08, KA39-E09 | KISA_DISCLOSURE_VIA_PRESS;NEWS | SECONDARY_UNCONFIRMED | 정보기술부문 투자액 = 정보보호부문 투자액 ÷ 정보보호/IT 비율(인접 연도(FY2024) 자사 공시 비율) → × (1+0.05)^1 (B-G26) |
| KA40 | 한화시스템(주) | REVENUE_INTENSITY | 2025 | 1,545.7 | ESTIMATED | — | KA40-E02 | DART_API | VERIFIED | TS_FY2025 = 매출(revenue) × 산업 IT 집약도 0.0500 (B-INT, Tier 3) → × (1+0.05)^1 (B-G26) |
| KA41 | 신용협동조합 | UNKNOWN | — | — | UNKNOWN | — | — | — | — | 근거 부족 — 추정 불가 |
| KA42 | Fastly, Inc. | UNKNOWN | — | — | UNKNOWN | — | — | — | — | 근거 부족 — 추정 불가 |
| KA43 | Valve Corporation | UNKNOWN | — | — | UNKNOWN | — | — | — | — | 근거 부족 — 추정 불가 |
| KA44 | 차이나유니콤 | ACCOUNT_SPECIFIC | 2025 | 104.4 | ESTIMATED | — | KA44-P1-E01, KA44-P1-E03 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 매출원가 중 인건비·임차료·감가상각 제외 잔여 104.4억 (회선·IDC 등 외부 구매 상한, 차이나유니콤오퍼레이션스코리아 감사보고서) → × (1+0.05)^1 (B-G26) |
| KA45 | 페이스북 | ACCOUNT_SPECIFIC | 2025 | 341.9 | SCENARIO | — | KA45-P1-E03, KA45-P2-E01, KA45-P2-E02, KA45-P2-E03 | DART_AUDIT_REPORT;NEWS | SECONDARY_UNCONFIRMED;VERIFIED | TS(시나리오, L6) = 평균[ 매출비율법 1.9%×광고 총판매액 10,752.2억(FY2025)=204.3억 , 트래픽법 전용회선시장 11,150억×메타 트래픽 4.3%=479.4억 ] = 341.9억 (범위 204~479) → × (1+0.05) |
| KA46 | 한국오라클 | ACCOUNT_SPECIFIC | 2026 | 847.4 | ESTIMATED | — | KA46-P1-E03, KA46-P1-E05 | DART_AUDIT_REPORT | VERIFIED | TS_FY2026(5월 결산, 국내 인프라 지출) = 컴퓨터장치 취득 663.4억(OCI 리전 장비) + 호스팅 비용 184.0억 = 847.4억. 장비 취득이 전년 대비 2.4배로 일회성 가능 → 저신뢰 |
| KA47 | (주)가비아 | AUDIT_IT_COMPONENTS | 2025 | 202.8 | DERIVED | VERIFIED | KA47-P1-E02 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 163.4억 ÷ 포괄률 0.806 [CLOUD_INFRA: 실측 n=1: 네이버클라우드 (유형상각 2,996.9+통신비 2,265.3)/KISA IT 6,529(FY24 파생)=0.806, 범 |
| KA48 | (주)카카오페이 | KISA_IT_INVESTMENT | 2025 | 1,146.0 | DERIVED | — | KA48-P1-E05 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.1)^1 (B-G26) |
| KA49 | 엔에이치엔클라우드(주) | AUDIT_IT_COMPONENTS | 2025 | 544.0 | DERIVED | VERIFIED | KA49-P1-E02, KA49-P1-E02 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 438.5억 ÷ 포괄률 0.806 [CLOUD_INFRA: 실측 n=1: 네이버클라우드 (유형상각 2,996.9+통신비 2,265.3)/KISA IT 6,529(FY24 파생)=0.806, 범 |
| KA50 | 키암코인천도화동데이터센터일반부동산사모투자회사 | UNKNOWN | — | — | UNKNOWN | — | — | — | — | 근거 부족 — 추정 불가 |
| KA51 | 토스뱅크 | KISA_IT_INVESTMENT | 2024 | 967.0 | SECONDARY_UNCONFIRMED | — | KA51-E01 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2024 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.05)^2 (B-G26) |
| KA52 | 토스증권 | AUDIT_IT_COMPONENTS | 2025 | 690.2 | DERIVED | VERIFIED | KA52-P1-E02 | DART_AUDIT_REPORT | VERIFIED | TS_FY2025 = 감사·사업보고서 IT 비용 항목 합계 323.0억 ÷ 포괄률 0.468 [FIN_전산업무비: 실측 n=2: 국민은행 전산업무비 2,530.8/KISA IT 5,315=0.476, 우리은행 1,849.2/4,016.8=0.460 ( |
| KA53 | 토스페이먼츠 | KISA_IT_INVESTMENT | 2025 | 411.0 | DERIVED | — | KA53-P1-E04 | KISA_DISCLOSURE_VIA_PRESS | SECONDARY_UNCONFIRMED | TS_FY2025 = KISA 정보보호 공시 정보기술부문 투자액 → × (1+0.1)^1 (B-G26) |

## 4. 발견 사항
| ID | 심각도 | 발견 사항 | 조치 | 상태 | 잔여 위험 |
|---|---|---|---|---|---|
| QA-01 | HIGH | **'EVIDENCE_VERIFIED(근거 검증)' 상태가 IT 지출이 아니라 입력 재무항목 검증을 뜻함** — L2 구성요소법 11개 계정(KA16·17·20·21·23·25·30·35·47·49·52)은 감사보고서 IT 비용 항목(VERIFIED)을 합산 후 포괄률(가정)로 나눈 추정치인데, 앵커 fact_status=VERIFIED → research_status=EVIDENCE_VERIFIED(화면 '근거 검증')로 표시되어 TS 자체가 검증된 것처럼 읽힘. | 앵커 fact_status=DERIVED, input_fact_status=VERIFIED로 분리. EVIDENCE_VERIFIED는 IT 지출 수치 자체를 1차 원문에서 확인한 경우만, 입력만 확인되면 INPUTS_VERIFIED('입력 재무항목 원문 확인(TS는 추정)'). 계정별 evidence_basis(근거 유형) 필드·화면 배지 추가. 신뢰도 점수·등급·값 불변 확인(전후 diff). | **FIXED** | 현재 EVIDENCE_VERIFIED 계정은 0개 — IT 지출을 1차 원문에서 직접 확인한 고객이 없다는 사실 자체가 잔여 위험(QA-02). |
| QA-02 | HIGH | **ESTIMATED_HIGH 10개 계정의 IT 지출액이 모두 KISA 공시값의 언론 인용(2차 출처)** — KISA 정보보호 공시 포털 직접 접속 불가(네트워크 차단)로 정보기술부문 투자액은 전부 SECONDARY_UNCONFIRMED. KA01·KA29·KA31은 원 단위까지 일치해 공시 전재 가능성이 높으나 원문 대조 전. | 값·등급 유지(공시 법정 수치의 정확 인용). evidence_basis.source_level=SECONDARY_PRESS로 화면에 'KISA 공시값 언론 인용 — 원문 대조 전' 표기. | **MITIGATED** | 사내망에서 KISA 정보보호공시 종합포털 원문 대조 후 VERIFIED 전환 필요(11개 계정). |
| QA-04 | LOW | **가정 ID B-RANGE·B-ALLOC 미등록, KA32 FPR·2031 레코드 근거 ID 누락** — 286개 지표 레코드 중 283개만 추적 완결. B-RANGE(범위 폭), B-ALLOC(2031 증분 배분)가 parameter_evidence에 없음. KA32(계약 기반 RAW)의 FPR_2026·RAW/FPR_2031에 계약 근거 ID 미연결. | parameter_evidence에 B-RANGE·B-ALLOC 등록(ANALYST_JUDGMENT), KA32 계약 근거 ID 전파. | **FIXED** | B-ALLOC·A-MIX·C-ADDR·C-CAP 등 핵심 가정은 실증 근거 없는 ANALYST_JUDGMENT. |
| QA-11 | MEDIUM | **FINANCIAL_METHODOLOGY.md 산식 3건이 코드와 불일치** — C-SOW=CR/TS(코드: CR/RAW), Target SOW=Target/TS_2031(코드: Target/RAW_2031), opportunity_gap=모델 FPR−영업 FPR(코드: FPR−CR). | 문서를 코드·METHODOLOGY.md 기준으로 정정. | **FIXED** | 없음. |

## 5. 잔여 위험
- KISA 정보보호 공시 원문은 이 환경에서 접속 불가 — 11개 계정의 IT 지출액은 언론 인용 상태로 남는다(사내망 대조 필요).
- 해외 공공 API(USAspending·SEC·PeeringDB·Steam) 차단으로 KA32·KA42·KA43 근거 확보 불가(`docs/MCP_SOURCE_REGISTRY.md` §3).
- 근거 문서의 원문 스냅샷(PDF)은 저장하지 않고 URL·접수번호·인용문만 보관 — 원문 링크 변경 시 접수번호로 재조회.
