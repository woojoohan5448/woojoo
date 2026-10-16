# FINAL DATA QUALITY AUDIT — 53 Key Account (2026·2031 TS/RAW/FPR)

> data_version `20261016T051757Z` · 브랜치 `qa-final-audit` · 안전 체크포인트 태그 `v2.0-phase1-4-checkpoint` · 생성: `python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports`
> 이 보고서의 모든 수치는 `data/qa/*.csv`에서 재계산 가능하다. 사내 데이터는 포함되지 않았다(contains_internal_data=False).

## 1. 결론 요약
- **값을 바꾼 계정은 없다.** 이번 QA는 기존 수치의 신뢰성 검증이 목적이며, 수정은 표시·상태·범위·추적성·사내 결합 로직에 한정했다(수정 전 스냅샷 대비 2026 TS/RAW/FPR 값·범위·신뢰도·등급, 2031 low/base/high 전 레코드, Target, 포트폴리오 합계 diff 0건. 상태(ESTIMATED→SCENARIO 4개사)와 2031 base 결합 범위만 추가·변경).
- **발견 22건**: FIXED 14 · MITIGATED 1 · OPEN 5 · DOCUMENTED 2. HIGH 심각도 12건 중 OPEN 1건(QA-05 플랫폼 인건비).
- **'VERIFIED'의 실제 의미**: 대시보드의 어떤 TS/RAW/FPR 지표도 status=VERIFIED가 아니다(확인 결과 0건). 기존 '근거 검증(EVIDENCE_VERIFIED)' 11개 계정은 **IT 지출이 아니라 입력 재무항목**이 원문 확인된 것이었으며 `INPUTS_VERIFIED`로 정정했다. IT 지출 수치를 1차 원문에서 직접 확인한 계정은 **0개**, KISA 공시값을 언론 인용으로 확보한 계정이 11개다.
- **비교 가능 합계(정의 상이 5개사 제외)**: TS 2026 113,542억 · RAW 29,950억 · FPR 8,200억 → 2031 base FPR 16,168억(Expansion 18,203억).
- 지표 추적성 286/286 (수정 전 283/286).

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
| 재무항목 재구성 추정 (`RECONSTRUCTED_FINANCIALS`) | 25 | 44,601 | KA06, KA09, KA10, KA14, KA15, KA16, KA17, KA19, KA20, KA21, KA23, KA25, KA26, KA30, KA34, KA35, KA37, KA39, KA44, KA46, KA47, KA48, KA49, KA52, KA53 |
| IT지출 공시값 (`DIRECT_IT_DISCLOSURE`) | 11 | 52,614 | KA01, KA03, KA11, KA12, KA18, KA22, KA27, KA29, KA31, KA33, KA51 |
| 산업 평균 적용 추정 (`INDUSTRY_AVERAGE`) | 7 | 14,767 | KA02, KA04, KA05, KA13, KA24, KA36, KA40 |
| 근거 없음(RESEARCH GAP) (`NONE`) | 5 | 0 | KA28, KA41, KA42, KA43, KA50 |
| 시나리오 (`SCENARIO`) | 4 | 1,561 | KA07, KA08, KA38, KA45 |
| 계약 기반(RAW만) (`CONTRACT_DIRECT_RAW`) | 1 | 0 | KA32 |

**출처 수준 세분**: `DIRECT_IT_DISCLOSURE|SECONDARY_PRESS` 11, `INDUSTRY_AVERAGE|BENCHMARK` 7, `RECONSTRUCTED_FINANCIALS|PRIMARY_INPUTS` 16, `SCENARIO|MIXED` 4, `RECONSTRUCTED_FINANCIALS|SECONDARY_INPUTS` 9, `NONE|-` 5, `CONTRACT_DIRECT_RAW|SECONDARY` 1

### VERIFIED 상태가 의미하는 것 — 검증 결과
| 레벨 | 필드 | 의미 | 현황 |
|---|---|---|---|
| 원천 사실 | `facts[].verification_status=VERIFIED` | DART 원문·API에서 확인한 **재무 항목**(매출·자산·전산비 등) | 근거 632건 중 VERIFIED 404 / SECONDARY 228 |
| 앵커 | `anchor.fact_status` | TS 기준값 자체의 상태 | L2 구성요소법은 이번에 VERIFIED → **DERIVED**로 정정, 입력 상태는 `input_fact_status` |
| 지표 | `m.2026.TS.status` | 모델 산출값 상태 | VERIFIED 0건 — 전부 ESTIMATED/SCENARIO/UNKNOWN |
| 계정 | `research_status` | 조사 단계 | 수정 전 {"MODEL_ESTIMATED": 36, "EVIDENCE_VERIFIED": 11, "SOURCES_COLLECTED": 2, "NEEDS_REVIEW": 4} → 수정 후 {"MODEL_ESTIMATED": 36, "INPUTS_VERIFIED": 11, "SOURCES_COLLECTED": 2, "NEEDS_REVIEW": 4} |

## 4. 발견·수정 현황 (전체)
| ID | 심각도 | 발견 사항 | 조치 | 상태 | 잔여 위험 |
|---|---|---|---|---|---|
| QA-01 | HIGH | **'EVIDENCE_VERIFIED(근거 검증)' 상태가 IT 지출이 아니라 입력 재무항목 검증을 뜻함** — L2 구성요소법 11개 계정(KA16·17·20·21·23·25·30·35·47·49·52)은 감사보고서 IT 비용 항목(VERIFIED)을 합산 후 포괄률(가정)로 나눈 추정치인데, 앵커 fact_status=VERIFIED → research_status=EVIDENCE_VERIFIED(화면 '근거 검증')로 표시되어 TS 자체가 검증된 것처럼 읽힘. | 앵커 fact_status=DERIVED, input_fact_status=VERIFIED로 분리. EVIDENCE_VERIFIED는 IT 지출 수치 자체를 1차 원문에서 확인한 경우만, 입력만 확인되면 INPUTS_VERIFIED('입력 재무항목 원문 확인(TS는 추정)'). 계정별 evidence_basis(근거 유형) 필드·화면 배지 추가. 신뢰도 점수·등급·값 불변 확인(전후 diff). | **FIXED** | 현재 EVIDENCE_VERIFIED 계정은 0개 — IT 지출을 1차 원문에서 직접 확인한 고객이 없다는 사실 자체가 잔여 위험(QA-02). |
| QA-02 | HIGH | **ESTIMATED_HIGH 10개 계정의 IT 지출액이 모두 KISA 공시값의 언론 인용(2차 출처)** — KISA 정보보호 공시 포털 직접 접속 불가(네트워크 차단)로 정보기술부문 투자액은 전부 SECONDARY_UNCONFIRMED. KA01·KA29·KA31은 원 단위까지 일치해 공시 전재 가능성이 높으나 원문 대조 전. | 값·등급 유지(공시 법정 수치의 정확 인용). evidence_basis.source_level=SECONDARY_PRESS로 화면에 'KISA 공시값 언론 인용 — 원문 대조 전' 표기. | **MITIGATED** | 사내망에서 KISA 정보보호공시 종합포털 원문 대조 후 VERIFIED 전환 필요(11개 계정). |
| QA-03 | MEDIUM | **시나리오 앵커 계정의 2026 TS/RAW/FPR 상태가 ESTIMATED로 표시** — KA07(용량×임대료)·KA38(계약 연환산)·KA45(망이용대가 동등가치)는 앵커 status=SCENARIO인데 지표 status는 ESTIMATED. KA08(발표 투자계획 연평균)도 계획 기반. | ts_2026: 앵커가 SCENARIO면 TS status=SCENARIO, RAW/FPR 동일 전파. KA08 override status=SCENARIO. 값 불변. | **FIXED** | 없음(등급은 기존 ESTIMATED_LOW 유지). |
| QA-04 | LOW | **가정 ID B-RANGE·B-ALLOC 미등록, KA32 FPR·2031 레코드 근거 ID 누락** — 286개 지표 레코드 중 283개만 추적 완결. B-RANGE(범위 폭), B-ALLOC(2031 증분 배분)가 parameter_evidence에 없음. KA32(계약 기반 RAW)의 FPR_2026·RAW/FPR_2031에 계약 근거 ID 미연결. | parameter_evidence에 B-RANGE·B-ALLOC 등록(ANALYST_JUDGMENT), KA32 계약 근거 ID 전파. | **FIXED** | B-ALLOC·A-MIX·C-ADDR·C-CAP 등 핵심 가정은 실증 근거 없는 ANALYST_JUDGMENT. |
| QA-05 | HIGH | **플랫폼 고객(쿠팡·카카오)의 IT 인건비 비중 가정(20%)이 과소 → RAW·FPR 과대 가능** — KISA 정보기술부문 투자액은 IT 인력 인건비 포함. 카카오 FY2025 급여총액 4,395억원(3,922명, OpenDART 사업보고서)으로 IT 인력 비중에 따라 TS 8,885억 중 인건비가 30~50%일 수 있음. 쿠팡 1개 계정이 비교 가능 FPR_2026의 33%(2,725억) 차지. | 값 불변(IT 인력 수 미확보). 민감도 산출: 인건비 35%면 FPR −18~19%, 50%면 −37%(쿠팡 −1,018억, 카카오 −328억). | **OPEN** | KISA 공시 '정보기술부문 인력' 확보 후 PLATFORM 믹스 계정별 보정 필요. 포트폴리오 FPR_2026의 최대 약 16% 영향. |
| QA-06 | MEDIUM | **은행 실측 포괄률(0.468)을 카드·증권·보험에 적용** — L2 FIN 포괄률은 국민·우리은행 2곳 실측. KA20·KA21·KA25·KA35·KA52(비은행)에 동일 적용. 비은행의 전산업무비가 IT 지출에서 차지하는 비중이 더 크면 TS 과대. 판관비 대비 IT 비율이 은행 벤치마크 2배 초과(KA21 34%, KA52 36%, KA37 57%). | 값 불변. 민감도: 포괄률 0.6→TS −22%, 0.7→ −33%. | **OPEN** | KISA 공시 카드·증권사 1~2곳(예: 신한투자증권 IT 1,131억 FY22)으로 비은행 포괄률 실측 필요. |
| QA-07 | MEDIUM | **상한값을 기준값으로 사용한 계정(KA44·KA32)** — KA44 차이나유니콤 TS=매출원가 중 외부 구매 '상한'(RAW/TS 0.72, FPR/RAW 0.39로 전체 이상치). KA32 주한미군 RAW=BOA 계약 '상한' 연환산이며 LG U+ BOA 누적 집행 $59,351에 불과, FPR/RAW 0.5는 일반 포획 상한(0.45) 초과. | 값 불변. RATIO_AUDIT·SENSITIVITY에 이상치·상한 사용 명시. | **OPEN** | 사내 회선·계약 실적(CR)으로 대체 시 해소. 그 전에는 FPR을 '상한'으로 해석. |
| QA-08 | HIGH | **2031 Low/High 시나리오가 2026 추정 불확실성을 포함하지 않음** — 브리지가 TS_2026 base에서 시작해 low/high는 성장 파라미터만 바꿈. TS_2031은 TS_2026에 선형(탄력성 중앙값 1.0, KA14만 0.59) → 2026 오차가 같은 비율로 2031에 전파되지만 표시 범위(중앙값 ±38%)에는 반영되지 않았음. 결합 시 중앙값 범위 폭 83%. | 2031 base 레코드 low/high = 시나리오 low/high × 2026 TS 범위 비율(결합 범위) + 산식 주석. 화면 수염·근거 패널에 표시. | **FIXED** | 결합 범위는 두 불확실성이 동방향으로 움직인다고 가정한 보수적 외곽선(확률 구간 아님). |
| QA-09 | HIGH | **FPR_2031 base에 LG U+ 역량 확대 가정이 포함되어 있으나 구분 표시 없음** — 비교 가능 FPR 증가분(2026 8,200 → 2031 16,168억) 중 고객 IT 지출 성장 기여 5,885억, 2031 접근률·포획상한 상향(U+ 경쟁력 확대 가정) 기여 2,075억(26%). Strategic Expansion은 추가 2,034억. | 2031 블록에 FPR_const_capability(2026 역량 고정) 레코드 추가, 계정 화면에 증가분 분해 표시. | **FIXED** | C-ADDR 2031_base·C-CAP 2031 상향은 경영진 승인 필요한 사업 가정. |
| QA-10 | MEDIUM | **성장 동인이 업종(family) 단위로 일률 적용** — FIN 17개 계정 TS CAGR이 모두 5.7%로 동일. 고객별 동인은 KA14(AI 인프라 5조 투자 → 연 5,000억)·KA08(투자 페이스) 2건뿐. 하이퍼스케일러 AI 증분(+50%)이 최대 승수(2.24배). | 값 불변. FORECAST_DECOMPOSITION.csv에 계정별 동인 분해 공개. | **OPEN** | 사내 Account Plan(재계약·차세대·DC 증설 일정)으로 계정별 동인 입력 필요 — APPROVED_ACCOUNT_PLAN 레이어는 저장만 되고 모델 미반영(QA-I5). |
| QA-11 | MEDIUM | **FINANCIAL_METHODOLOGY.md 산식 3건이 코드와 불일치** — C-SOW=CR/TS(코드: CR/RAW), Target SOW=Target/TS_2031(코드: Target/RAW_2031), opportunity_gap=모델 FPR−영업 FPR(코드: FPR−CR). | 문서를 코드·METHODOLOGY.md 기준으로 정정. | **FIXED** | 없음. |
| QA-12 | LOW | **정의 상이 계정 합산 분리 확인** — KA06·KA07·KA08·KA45·KA46(TS 합 19,178억)은 portfolio.aggregate에서 제외, 전략 화면 '별도 수요'로만 표시 — 정상. 단 KA32의 계약 상한 RAW(157억)와 KA38의 계약 기반 하한 TS(1,561억, 동일 정의)는 비교 합계에 포함. | 변경 없음. | **DOCUMENTED** | KA32 RAW는 정의상 '상한' — 합계 해석 시 유의(영향 0.5%). |
| QA-13 | MEDIUM | **경영진 목표 미입력 시 FPR×50% 시나리오 Target이 값으로 표시·합산** — TARGET은 na_class=INTERNAL_REQUIRED이지만 값(SCENARIO)이 존재하고 portfolio 2031 TARGET 합계(8,084억)에 포함. | 변경 없음(v1 요구 사양). 화면은 '시나리오 값 — 경영진 입력 필요' 표기. | **DOCUMENTED** | 보고서·회의 자료에 인용 시 '목표'로 오인될 위험 — 사내 MANAGEMENT_TARGET 승인 후 대체. |
| QA-I1 | HIGH | **승인 완료 배치를 '거부' 처리 가능(감사 추적 위조 위험)** — reject()가 상태 확인 없이 APPROVED 배치를 REJECTED로 변경 — 저장소에는 값이 반영된 채 이력만 '거부'로 바뀜. | PENDING_REVIEW만 거부 가능(API 409). 테스트 추가. | **FIXED** | 없음. |
| QA-I2 | HIGH | **행 선택이 빈 목록이면 전체 행이 승인됨** — approve(rows=[])가 'rows and …' 조건 때문에 모든 유효 행을 반영. | rows=None일 때만 전체, 빈 목록은 0행. 수정 전 코드로 테스트 실패 재현 확인. | **FIXED** | 없음. |
| QA-I3 | HIGH | **같은 계정의 FORECAST와 ACTUAL_FULL_YEAR 행이 CR에 합산(이중 계상)** — 두 기간 유형이 별도 키로 저장되어 CR_2026 = 예상 + 실적으로 계산됨(합성 테스트: 100+120=220). | ACTUAL_FULL_YEAR가 있으면 그것만, 없으면 FORECAST 합산. 수정 전 코드로 테스트 실패 재현 확인. | **FIXED** | 상품·계약 단위 행의 정의(부가세·대리점 수수료 포함 여부)는 사내 재무 기준과 대사 필요. |
| QA-I4 | HIGH | **v1 간이 입력 API가 미리보기·승인 없이 Git 추적 CSV에 사내 값을 직접 저장** — /api/management-inputs → data/internal_inputs/management_inputs.csv(.gitignore 예외로 추적됨) 즉시 갱신·재계산. | 기본 비활성화(410), KAI_ENABLE_LEGACY_INPUT=1일 때만 허용. CSV 경유 값에는 LEGACY_DIRECT_INPUT 경고. 화면 문구 정정. | **FIXED** | 레거시 활성화 시 Git 커밋 위험 — 사내 저장소 pre-commit 훅 권장. |
| QA-I5 | MEDIUM | **APPROVED_ACCOUNT_PLAN 레이어는 저장·이력만 되고 모델·화면에 미반영** — ACCOUNT_PLAN 시트 승인 시 레이어에 저장되나 build가 소비하지 않음. | 변경 없음(확장 포인트로 문서화). | **OPEN** | 영업 추정과 외부 추정 차이를 '승인된 Account Plan 값으로 확정'하는 마지막 단계는 수작업. |
| QA-P1 | HIGH | **패키저가 .env(비밀키) 파일을 포함할 수 있었음** — EXCLUDE_DIRS만 있고 파일 제외 규칙 없음 — 루트에 .env가 있으면 DART_API_KEY가 zip에 포함. | .env·*.pem·*.key·*.p12·*.pfx 제외 + 테스트. | **FIXED** | 없음. |
| QA-P2 | HIGH | **허용 폴더 밖 Excel(사내 원본 가능)·내장 대시보드의 사내 데이터 미검사** — internal_store·uploads·management_inputs.csv·data/processed/dashboard.json만 검사. 루트 등에 둔 사내 xlsx, Key_Account_Dashboard.html·frontend 번들·intel.db의 사내 값은 미검사. | 스프레드시트 허용 경로 화이트리스트, 번들 4종·dist JS·intel.db management_inputs 검사 추가 + 테스트. | **FIXED** | 파일 내용 기반 PII 스캔은 미구현. |
| QA-W1 | HIGH | **.bat 스크립트가 LF 줄바꿈·UTF-8(코드페이지 미지정)** — cmd.exe는 LF 전용 파일에서 레이블(goto) 탐색 오류 가능, 한글 cp949 콘솔에서 깨짐. import_excel.bat은 괄호 블록 내 %errorlevel% 즉시 확장 문제. | CRLF 변환, chcp 65001, PYTHONUTF8=1, python/py 런처 자동 감지, 버전 확인, wheels 오프라인 설치 자동 사용, goto 구조로 오류 코드 전달. | **FIXED** | 실제 Windows PC에서 실행 검증 전(이 환경은 Linux). |
| QA-W2 | MEDIUM | **의존성 일부 미고정·Windows 전용 의존성 누락** — python-multipart·requests 범위 지정, colorama(Windows에서 click·pytest 필요)는 pip download 시 호스트 마커 평가로 누락. | 테스트 통과 버전으로 전부 고정, colorama 명시, research 전용 requests 제외. Python 3.11/3.12/3.13 win_amd64 wheel 26개 확보 및 오프라인 의존성 해석(dry-run) 성공. | **FIXED** | 사내 백신·프록시·실행 정책(AppLocker)에 따른 차단 여부 미확인. |

## 5. 53개 계정 지표 원장 (요약 — 전체 컬럼은 METRIC_LEDGER.csv)
단위 억원. 등급은 TS 2026 기준. 2031 범위는 결합 범위(QA-08).
| ID | 고객 | 근거 유형 | 출처 수준 | TS 2026 (범위) | 등급 | RAW 2026 | FPR 2026 | TS 2031 base (결합 범위) | FPR 2031 base | 정의상이 |
|---|---|---|---|---|---|---|---|---|---|---|
| KA01 | (주)엘지씨엔에스 | IT지출 공시값 | SECONDARY_PRESS | 4,933 (4,313~5,582) | HIGH | 987 | 257 | 6,545 | 404 |  |
| KA02 | 한국토요타자동차 | 산업 평균 적용 추정 | BENCHMARK | 126 (60~242) | LOW | 28 | 7 | 158 | 11 |  |
| KA03 | 국민은행 | IT지출 공시값 | SECONDARY_PRESS | 5,581 (4,879~6,314) | HIGH | 987 | 247 | 7,354 | 456 |  |
| KA04 | 신한카드(주) | 산업 평균 적용 추정 | BENCHMARK | 1,023 (826~1,084) | LOW | 181 | 45 | 1,348 | 84 |  |
| KA05 | 한국전력공사 | 산업 평균 적용 추정 | BENCHMARK | 5,904 (2,866~10,127) | LOW | 1,473 | 376 | 7,329 | 570 |  |
| KA06 | 구글클라우드 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 1,422 (974~1,932) | MED | 568 | 197 | 3,188 | 483 | Y |
| KA07 | 마이크로소프트 | 시나리오 | MIXED | 2,550 (1,275~3,825) | LOW | 1,019 | 353 | 5,718 | 866 | Y |
| KA08 | 아마존 | 시나리오 | MIXED | 14,000 (8,400~19,600) | LOW | 4,018 | 1,386 | 15,120 | 1,713 | Y |
| KA09 | (주)카카오 | 재무항목 재구성 추정 | SECONDARY_INPUTS | 8,885 (7,697~10,230) | MED | 3,046 | 883 | 14,111 | 1,690 |  |
| KA10 | 네이버클라우드 | 재무항목 재구성 추정 | SECONDARY_INPUTS | 8,190 (6,478~10,342) | MED | 2,998 | 944 | 16,384 | 2,198 |  |
| KA11 | (주)신세계아이앤씨 | IT지출 공시값 | SECONDARY_PRESS | 649 (535~776) | MED | 161 | 46 | 860 | 76 |  |
| KA12 | (주)에스원 | IT지출 공시값 | SECONDARY_PRESS | 608 (516~708) | HIGH | 175 | 47 | 748 | 70 |  |
| KA13 | 롯데이노베이트(주) | 산업 평균 적용 추정 | BENCHMARK | 544 (317~1,007) | LOW | 133 | 39 | 722 | 63 |  |
| KA14 | 삼성에스디에스(주) | 재무항목 재구성 추정 | SECONDARY_INPUTS | 5,990 (4,364~7,701) | MED | 1,284 | 265 | 12,227 | 1,096 |  |
| KA15 | 지에스네오텍(주) | 재무항목 재구성 추정 | PRIMARY_INPUTS | 166 (94~250) | LOW | 61 | 19 | 333 | 45 |  |
| KA16 | 지에스리테일 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 1,145 (834~1,571) | MED | 325 | 89 | 1,410 | 131 |  |
| KA17 | 현대엘리베이터 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 295 (213~404) | MED | 65 | 15 | 371 | 25 |  |
| KA18 | (주)신한은행 | IT지출 공시값 | SECONDARY_PRESS | 4,866 (4,254~5,505) | HIGH | 858 | 215 | 6,411 | 397 |  |
| KA19 | (주)우리은행 | 재무항목 재구성 추정 | SECONDARY_INPUTS | 4,198 (3,670~4,750) | MED | 754 | 187 | 5,532 | 345 |  |
| KA20 | (주)우리카드 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 725 (588~918) | MED | 126 | 32 | 955 | 59 |  |
| KA21 | (주)케이비국민카드 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 1,641 (1,332~2,079) | MED | 292 | 73 | 2,162 | 134 |  |
| KA22 | (주)하나은행 | IT지출 공시값 | SECONDARY_PRESS | 4,327 (3,783~4,896) | HIGH | 777 | 193 | 5,702 | 356 |  |
| KA23 | (주)한국스탠다드차타드은행 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 1,295 (1,051~1,641) | MED | 264 | 61 | 1,706 | 112 |  |
| KA24 | 농협은행 | 산업 평균 적용 추정 | BENCHMARK | 5,297 (4,280~5,615) | LOW | 919 | 233 | 6,979 | 430 |  |
| KA25 | 미래에셋증권(주) | 재무항목 재구성 추정 | PRIMARY_INPUTS | 2,205 (1,790~2,793) | MED | 466 | 105 | 2,905 | 194 |  |
| KA26 | 한국투자증권(주) | 재무항목 재구성 추정 | SECONDARY_INPUTS | 1,858 (1,625~2,103) | MED | 396 | 89 | 2,449 | 164 |  |
| KA27 | (주)비바리퍼블리카 | IT지출 공시값 | SECONDARY_PRESS | 2,138 (1,837~2,458) | HIGH | 506 | 130 | 3,462 | 268 |  |
| KA28 | 코람코자산운용 | 근거 없음(RESEARCH GAP) | - | — | GAP | — | — | — | — |  |
| KA29 | 쿠팡(주) | IT지출 공시값 | SECONDARY_PRESS | 27,526 (23,847~31,693) | HIGH | 9,473 | 2,725 | 43,717 | 5,228 |  |
| KA30 | 메르세데스벤츠코리아(주) | 재무항목 재구성 추정 | PRIMARY_INPUTS | 868 (626~1,191) | MED | 191 | 45 | 1,093 | 75 |  |
| KA31 | 씨제이올리브네트웍스(주) | IT지출 공시값 | SECONDARY_PRESS | 672 (571~782) | HIGH | 176 | 48 | 891 | 79 |  |
| KA32 | 주한미군 | 계약 기반(RAW만) | SECONDARY | — | GAP | 157 | 78 | — | 87 |  |
| KA33 | 케이지모빌리티 | IT지출 공시값 | SECONDARY_PRESS | 250 (216~282) | HIGH | 54 | 13 | 314 | 21 |  |
| KA34 | (주)아이비케이시스템 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 49 (28~70) | LOW | 12 | 3 | 65 | 6 |  |
| KA35 | (주)케이비손해보험 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 1,278 (1,038~1,619) | MED | 222 | 56 | 1,684 | 104 |  |
| KA36 | (주)코스콤 | 산업 평균 적용 추정 | BENCHMARK | 250 (146~464) | LOW | 61 | 18 | 332 | 29 |  |
| KA37 | 대신증권(주) | 재무항목 재구성 추정 | SECONDARY_INPUTS | 717 (522~922) | MED | 148 | 34 | 945 | 63 |  |
| KA38 | 새마을금고중앙회 | 시나리오 | MIXED | 1,561 (780~2,342) | LOW | 318 | 73 | 2,057 | 135 |  |
| KA39 | 엔에이치투자증권(주) | 재무항목 재구성 추정 | SECONDARY_INPUTS | 1,713 (1,248~2,203) | MED | 300 | 76 | 2,257 | 140 |  |
| KA40 | 한화시스템(주) | 산업 평균 적용 추정 | BENCHMARK | 1,623 (946~3,005) | LOW | 396 | 116 | 2,153 | 189 |  |
| KA41 | 신용협동조합 | 근거 없음(RESEARCH GAP) | - | — | GAP | — | — | — | — |  |
| KA42 | Fastly, Inc. | 근거 없음(RESEARCH GAP) | - | — | GAP | — | — | — | — |  |
| KA43 | Valve Corporation | 근거 없음(RESEARCH GAP) | - | — | GAP | — | — | — | — |  |
| KA44 | 차이나유니콤 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 110 (73~149) | MED | 79 | 31 | 136 | 39 |  |
| KA45 | 페이스북 | 시나리오 | MIXED | 359 (205~527) | LOW | 258 | 102 | 446 | 127 | Y |
| KA46 | 한국오라클 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 847 (508~1,186) | LOW | 339 | 117 | 1,900 | 288 | Y |
| KA47 | (주)가비아 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 227 (181~302) | MED | 83 | 26 | 454 | 61 |  |
| KA48 | (주)카카오페이 | 재무항목 재구성 추정 | SECONDARY_INPUTS | 1,261 (1,083~1,450) | MED | 305 | 77 | 2,041 | 159 |  |
| KA49 | 엔에이치엔클라우드(주) | 재무항목 재구성 추정 | PRIMARY_INPUTS | 609 (485~809) | MED | 224 | 70 | 1,219 | 163 |  |
| KA50 | 키암코인천도화동데이터센터일반부동산사모투자회사 | 근거 없음(RESEARCH GAP) | - | — | N/A(비적용) | — | — | — | — |  |
| KA51 | 토스뱅크 | IT지출 공시값 | SECONDARY_PRESS | 1,066 (905~1,241) | HIGH | 225 | 51 | 1,405 | 94 |  |
| KA52 | 토스증권 | 재무항목 재구성 추정 | PRIMARY_INPUTS | 725 (588~918) | MED | 156 | 35 | 955 | 64 |  |
| KA53 | 토스페이먼츠 | 재무항목 재구성 추정 | SECONDARY_INPUTS | 452 (388~520) | MED | 108 | 28 | 732 | 57 |  |

## 6. 아직 남아 있는 위험 (요약)
1. **IT 지출 1차 원문 미확인**(QA-02): HIGH 등급 10개 계정 포함 11개 계정이 KISA 공시값의 언론 인용. 사내망에서 KISA 정보보호공시 종합포털 원문 대조 필요.
2. **플랫폼 인건비 비중**(QA-05): 쿠팡·카카오 FPR이 최대 −37% 과대 가능 → 포트폴리오 FPR_2026의 최대 약 16%.
3. **비은행 금융 포괄률**(QA-06), **상한값 기준 계정**(QA-07), **업종 일률 성장 동인**(QA-10).
4. **사내 데이터 실검증 미실시**: 결합 기능은 합성 데이터로만 검증(INTERNAL_EXCEL_INTEGRATION_READINESS.md).
5. **Windows 실행 미검증**: 스크립트·의존성은 정적 검증·오프라인 의존성 해석까지만(WINDOWS_MIGRATION_CHECKLIST.md).
