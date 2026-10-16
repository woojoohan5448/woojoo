# METHODOLOGY — 53 Key Account IT Spending & Full Potential Revenue Model (v1.0)

> 기준일 2026-10-16 · 통화 KRW · 표시 단위 **억원** · 회계연도 FY = 1~12월(예외는 계정별 표기)

## 1. 데이터 레이어 분리
| Layer | 내용 | 예시 | 상태 라벨 |
|---|---|---|---|
| A. Verified Facts | 원천에서 직접 확인한 재무·운영 사실 | DART API 매출액, 자산총계 | VERIFIED |
| B. Evidence-Based Estimates | 확인된 사실 + 명시적 산식·파라미터 | TS_2026, TS_2031 브리지 | DERIVED / ESTIMATED |
| C. Competitive & Addressability Assumptions | 접근률, 포획 상한, 계정별 보정 | C-ADDR, C-CAP | ESTIMATED / SCENARIO |
| D. Strategic Management Targets | 2031 Target Revenue | 경영진 입력 또는 D-TGT 시나리오 | SCENARIO |
| E. Implications | 사업영역 우선순위·권고 | Strategy Engine | (정성, 근거 링크) |

**지표 상태 5종**: VERIFIED(원천 직접 확인) · DERIVED(확인값의 결정적 산식) · ESTIMATED(복수 자료+모델) · SCENARIO(전략적 가정) · UNKNOWN(근거 부족).
**사실(fact) 수준 검증 상태**: VERIFIED / DERIVED / SECONDARY_UNCONFIRMED(검색 결과 인용, 원문 페이지 미열람).

## 2. 환경 제약과 그 영향 (중요)
- 이 실행 환경에서 dart.fss.or.kr·opendart·isds.kisa.or.kr 및 모든 언론사에 대한 **직접 접속(curl/WebFetch)은 DNS/프록시 차단**되었다.
- 사용 가능 경로: PlayMCP OpenDART(재무·기업정보) → **Tier 1 VERIFIED**, WebSearch(검색 요약 인용) → **Tier 2 SECONDARY_UNCONFIRMED**.
- WebSearch는 세션 턴당 200회 한도가 있어 병렬 조사 중 소진되었다. 이후 배치는 DART 재무 위주로 수집됨 → 다수 고객이 매출 대비 IT 집약도(Tier 3) 추정으로 남음.
- 따라서 KISA 정보보호 공시 수치(대부분의 TS 앵커)는 **원문 미확인 보도 인용**이며, 신뢰도 상한 70을 적용한다. KISA 포털 원문 대조 시 VERIFIED로 승격된다.

## 3. Customer Total IT Spending (TS)
**정의(전 고객 공통)**: 해당 연도에 고객 법인(별도 기준)이 소비한 IT/ICT 비용. KISA 정보보호 공시의 '정보기술부문 투자액' 정의를 준용한다 — 연간 **비용 기준**(IT 자산 감가상각비 + IT 인건비 + 외주·유지보수·서비스 비용 등), 토지·건물 제외. 근거: `_KISA_DEFINITION.json`.
- 신규 자산 취득액(CAPEX)과 감가상각을 **중복 합산하지 않는다**. TS_CAPEX 성분 = 감가상각, TS_OPEX = 나머지로 해석.
- 다년 계약·다년 투자 총액은 연간값으로 쓰지 않는다(기간으로 나누어 연평균화하고 산식에 명시).
- 재판매 목적 구매(SI/MSP의 클라우드 재판매 원가, 매출원가)는 TS에서 제외 — 자체 소비만.

**앵커 우선순위** (`models/spending/ts.py`)
1. DIRECT_IT_BUDGET — 회사 발표 FY2026 전사 IT 예산 (KISA 앵커의 50% 미만이면 기각: 파일럿 COR-001 교훈)
2. KISA_IT_INVESTMENT — 최신 FY 정보기술부문 투자액
3. KISA_DERIVED — 정보보호 투자액 ÷ (정보보호/IT 비율)
4. ACCOUNT_SPECIFIC — 하이퍼스케일러·특수 법인 등 계정별 분석가 모델(`config/account_overrides.json`)
5. REVENUE_INTENSITY — 별도 매출 × 산업 IT 집약도. **집약도는 본 프로젝트의 KISA 실측 고객으로 산업군별 중앙값을 보정(n≥2)**, 부족 시 사전값. 신뢰도 상한 35.
6. UNKNOWN — 위 어느 것도 불가 시. 0으로 대체하지 않음.

**FY2026 환산**: TS_2026 = Anchor_FY × (1+g)^(2026−FY), g = B-G26(산업군 low/base/high).
**불확실성 범위**: 앵커 방법별 폭(B-RANGE: KISA ±10%, 매출집약도는 실측 min~max 또는 사전 low~high, 계정별 ±40%) × 성장률 low/high.

## 4. Realistically Addressable Wallet (RAW)
RAW_y = Σ_i TS_{i,y} × Addressability_{i,y}
- TS를 10개 카테고리(CONNECTIVITY, DC_COLO, CLOUD, AI_INFRA, SECURITY, SI_BUILD, IT_OPS, SW_LICENSE, HW_DEVICE, INTERNAL_LABOR)로 분해(A-MIX, 산업군별 사전 구성비).
- **계정 실측 보정**: KISA 정보보호/IT 비율이 있으면 SECURITY 비중을 실측으로 대체, 나머지 비례 조정.
- 카테고리는 상호 배타(합계=TS)이므로 중복이 없다.
- Addressability(C-ADDR): 2026 / 2031_base(현 포트폴리오 자연 확장) / 2031_expansion(M&A·신규투자 전제, Strategic Expansion Case). 계정별 보정(캡티브 SI, 자가 DC 구축 등)은 `addressability_modifiers`.

## 5. U+ Full Potential Revenue (FPR)
FPR_y = Σ_i RAW_{i,y} × Capture_Ceiling_{i,y}
- 포획 상한(C-CAP): 이중망 정책(통신 0.45), 콜로 0.35, AI 인프라 0.25~0.30, 클라우드 0.15~0.18, 보안 0.15~0.18, SI/ITO 0.10~0.12.
- 불변식: 0 ≤ FPR ≤ RAW ≤ TS (자동 검증).
- FPR은 '연간 매출 상한'이며 수주액·목표와 다르다.
- 본 단계에서는 **고객별 상품 매출 배분을 하지 않는다**(§11 확장 포인트). 카테고리 분해는 FPR 계산과 포트폴리오 사업영역 분석을 위한 내부 모델이다.

## 6. Current Revenue 및 파생 지표
- CR_2026: 사내 데이터만 사용(`data/internal_inputs/management_inputs.csv` 또는 관리자 API). **미입력=NULL(0 아님)**.
- C-SOW = CR/RAW, Potential Capture Rate = CR/FPR, Upside_2026 = FPR−CR. CR NULL이면 모두 N/A.
- CR > FPR이면 경고(FPR 가정 재검토).

## 7. FY2031 Forecast (Driver-Based Bridge)
TS_2031 = TS_2026 + Organic + Digital/Cloud + AI + Infra(계정별) + Regulatory − Efficiency − Substitution ± Other
- Organic = TS_2026 × ((1+g_org)^5 − 1); 나머지는 TS_2026 대비 5년 누적 비율(B-BRIDGE, 산업군·시나리오별).
- 증감분은 B-ALLOC 규칙으로 카테고리에 배분 → 2031 카테고리 구성이 AI_INFRA·CLOUD·SECURITY 쪽으로 이동.
- 계정별 인프라 증설(발표된 DC/AI 투자)은 `infra_drivers`(연환산 억원, 근거 ID)로 추가.
- 시나리오: Low / Base / High. 시장 성장률(MB), 고객 IT 지출 성장률(TS CAGR), LG U+ 매출 성장률(FPR/Target)은 별개 개념으로 구분 표기.
- 파라미터 근거: `config/parameter_evidence.json` (Gartner 2026, 과기정통부 클라우드 실태조사, KDCC, KISIA 등).

## 8. 2031 Target Revenue (Layer D)
- 경영진 입력이 있으면 사용(0 ≤ Target ≤ FPR_2031 검증).
- 없으면 **시나리오 표시값** = FPR_2031(base) × 0.5 (D-TGT), 상태 SCENARIO, "경영진 의사결정 필요".
- Target_SOW = Target/RAW_2031. Target_SOW > C-SOW 여부는 CR 미확인 시 "확인 불가".
- Estimated_Upside_2031 = FPR_2031(base) − CR_2026, Target 증분 = Target_2031 − CR_2026 (CR 미확인 시 N/A).

## 9. 신뢰도 점수 (0–100, 분석 품질 평가 점수 — 확률 아님)
TS 앵커 점수 = 공식성(30/18/8) + 법인 일치(15/10/4) + 지표 직접성(20/15/8/5) + 최신성(15/10/5) + 일관성(10/5/4)
- 상한: 원문 미확인(SECONDARY) 70, 매출집약도 35.
- 차감: TS_2026 −5(연도 환산), RAW −15, FPR −25, TS_2031 −20, RAW_2031 −30, FPR_2031 −40, Target(시나리오) ≤25.

## 10. 무결성 검증 (`models/validation/checks.py`)
RAW≤TS, FPR≤RAW, CR≤FPR(경고), Target≤FPR(base는 오류·Low는 경고), C-SOW·PCR·Upside·Target SOW·CAGR 재계산, 음수, NULL/0 구분, 산식·출처 계보 누락, KISA 연간 변동 30% 초과, 예산-KISA 교차검증. **값은 조용히 수정하지 않고 data_quality_issues로만 기록.**

## 11. 중복집계 방지
- TS는 법인 별도(KISA 공시 단위) → 연결 중복 원칙적 배제.
- `config/overlap_groups.json`: 연결(토스·카카오), 계열 공동 IT, 공급자-구매자(GS, MSP-하이퍼스케일러, DC 펀드-임차인, 금융 IT 인프라).
- 합산 분류: COMPARABLE / OVERLAP_RISK(합산하되 표시) / DEFINITION_MISMATCH(하이퍼스케일러 국내 투자 기준 등 → 합계 제외, 별도 표시) / EXCLUDED_UNKNOWN.

## 12. 산업별 특수 모델
- 금융: KISA(2027 금융권 의무화 예정) 우선, 캡티브 SI로 SI/ITO 접근률 제한.
- IT 서비스/SI: 자체 소비만(매출원가·재판매 제외), 그룹 캡티브 비중 표시.
- 하이퍼스케일러/글로벌: 글로벌 CAPEX 미사용. 국내 투자 발표액 연평균(정의 상이 플래그).
- 공공·국방: 예산·계약 기반. 주한미군은 TS UNKNOWN + 계약 상한 기반 RAW 하한 시나리오.
- DC 펀드: 시설 운영·연결 지출 모델(DC_FUND 구성비).

## 13. 알려진 한계
1. 원문 미열람(SECONDARY) 수치 다수 — KISA 포털·DART 원문 대조 필요.
2. 접근률·포획 상한은 분석가 판단 — 사내 수주/점유 데이터로 보정 필요.
3. 매출집약도 추정 고객은 ±40% 이상 불확실.
4. CR·Target·계약 정보 부재로 SOW·Upside 산출 불가(관리자 입력 대기).
