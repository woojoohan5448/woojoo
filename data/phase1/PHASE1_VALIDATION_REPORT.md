# PHASE 1 VALIDATION REPORT

data_version 20261016T051757Z

## 1. 무결성
- 모델 검증 이슈: {'ERROR': 0, 'WARN': 20, 'INFO': 167}
- 자동 테스트: 36 passed, 1 warning in 11.01s
- 프론트엔드 동기화 오류: 0건
- 불변식 0 ≤ FPR ≤ RAW ≤ TS, Target ≤ FPR_2031, CR NULL≠0: tests/test_model.py 통과 시 보장

## 2. 오류 재검증 규칙 결과 (DATA_CONFLICTS.csv)

| 규칙 | 심각도 | 건수 |
|---|---|---|
| R02_IT_RATIO_OUTLIER | WARN | 3 |
| R06_PLAN_VS_ACTUAL | WARN | 1 |
| R08_YEAR_AMBIGUITY | INFO | 2 |
| R08_YEAR_AMBIGUITY | WARN | 2 |
| R09_SOURCE_CONFLICT | WARN | 11 |
| R10_DEFINITION_MISMATCH | INFO | 5 |

### 해석
- **R02 (IT/판관비 이상치)**: KB국민카드·대신증권·토스증권은 판관비 계정에 인건비가 빠지거나(별도 계정) 범위가 달라 은행 기준 보정 비율과 정의 불일치 → 카드·증권사에 판관비 집약도 방식이 부적합함을 확인, 감사보고서 IT 비용 항목(L2) 또는 KISA 근거로 대체.
- **R09 (근거 충돌)**: 구글(그룹 매출 6,831억→법인 2,052억), 한국오라클(글로벌 분기 수치→국내 법인 1.1조) 등 기존 범위 오류 정정. 신한카드는 판관비 방식(≈1,000억)이 역산 IT 예산(≈2,200억, 저신뢰)과 충돌 → 과소추정 가능성 경고 유지.
- **R06**: 삼성SDS 2031 인프라 증분(계획 기반)이 TS2031의 41% → 계획 실현 리스크 표시.

## 3. 추정치 변경 요약 (MODEL_CHANGE_LOG.csv)
- 변경 유형: {'REVISED': 78, 'RECOVERED': 70}
- 주요 TS_2026 변경(v1→현재, 억원):
  - KA04 신한카드(주): 1021.25 → 1,023 (REVENUE_INTENSITY → REVENUE_INTENSITY)
  - KA06 구글클라우드: N/A → 1,422 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA07 마이크로소프트: N/A → 2,550 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA11 (주)신세계아이앤씨: 350.69 → 649 (REVENUE_INTENSITY → KISA_IT_INVESTMENT)
  - KA12 (주)에스원: 353.46 → 608 (REVENUE_INTENSITY → KISA_IT_INVESTMENT)
  - KA15 지에스네오텍(주): N/A → 166 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA16 지에스리테일: 1508.92 → 1,145 (KISA_SEC_SCALED → AUDIT_IT_COMPONENTS)
  - KA17 현대엘리베이터: 133.71 → 295 (REVENUE_INTENSITY → AUDIT_IT_COMPONENTS)
  - KA18 (주)신한은행: 4450.5 → 4,866 (DIRECT_IT_BUDGET → KISA_IT_INVESTMENT)
  - KA20 (주)우리카드: 393.73 → 725 (REVENUE_INTENSITY → AUDIT_IT_COMPONENTS)
  - KA21 (주)케이비국민카드: 637.11 → 1,641 (REVENUE_INTENSITY → AUDIT_IT_COMPONENTS)
  - KA22 (주)하나은행: 4350.82 → 4,327 (REVENUE_INTENSITY → KISA_IT_INVESTMENT)
  - KA23 (주)한국스탠다드차타드은행: 1389.86 → 1,295 (REVENUE_INTENSITY → AUDIT_IT_COMPONENTS)
  - KA24 농협은행: N/A → 5,297 (UNKNOWN → REVENUE_INTENSITY)
  - KA25 미래에셋증권(주): 1811.85 → 2,205 (REVENUE_INTENSITY → AUDIT_IT_COMPONENTS)
  - KA30 메르세데스벤츠코리아(주): 514.87 → 868 (REVENUE_INTENSITY → AUDIT_IT_COMPONENTS)
  - KA31 씨제이올리브네트웍스(주): N/A → 672 (UNKNOWN → KISA_IT_INVESTMENT)
  - KA34 (주)아이비케이시스템: N/A → 49 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA35 (주)케이비손해보험: N/A → 1,278 (UNKNOWN → AUDIT_IT_COMPONENTS)
  - KA36 (주)코스콤: N/A → 250 (UNKNOWN → REVENUE_INTENSITY)
  - KA38 새마을금고중앙회: N/A → 1,561 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA44 차이나유니콤: N/A → 110 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA45 페이스북: N/A → 359 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA46 한국오라클: N/A → 847 (UNKNOWN → ACCOUNT_SPECIFIC)
  - KA47 (주)가비아: 298.89 → 227 (REVENUE_INTENSITY → AUDIT_IT_COMPONENTS)
  - KA48 (주)카카오페이: 1130.58 → 1,261 (REVENUE_INTENSITY → KISA_IT_INVESTMENT)
  - KA49 엔에이치엔클라우드(주): N/A → 609 (UNKNOWN → AUDIT_IT_COMPONENTS)
  - KA52 토스증권: N/A → 725 (UNKNOWN → AUDIT_IT_COMPONENTS)
  - KA53 토스페이먼츠: 1526.42 → 452 (REVENUE_INTENSITY → KISA_IT_INVESTMENT)

## 4. Completion Gate

| 산출물 | 상태 |
|---|---|
| data/phase1/NA_BASELINE_AUDIT.csv | 생성 |
| data/phase1/NA_RECOVERY_PLAN.csv | 생성 |
| data/phase1/EVIDENCE_RECOVERY_LOG.csv | 생성 |
| data/phase1/DATA_CONFLICTS.csv | 생성 |
| data/phase1/CORRECTIONS.json | 생성 |
| data/phase1/SOURCE_COVERAGE_REPORT.md | 생성 |
| docs/MCP_SOURCE_REGISTRY.md | 생성 |

## 5. 미해결 (INSUFFICIENT_EVIDENCE) — 원인과 후속 조치

| 고객 | 필드 | 원인 | 후속 조치 |
|---|---|---|---|
| KA28 코람코자산운용 | 2026|TS, 2026|RAW, 2026|FPR, 2031|TS, 2031|RAW, 2031|FPR | 앵커 UNKNOWN — 코람코자산운용: DART 감사보고서만, 데이터센터 펀드 정보 미수집 → UNKNOWN | DC 운영위탁 수수료·연결비 단가(사내 IDC 사업부 자료) 확보 시 용량 모델 적용 (가산 26MW는 LG U+ 운영) |
| KA32 주한미군 | 2026|TS, 2031|TS | 앵커 UNKNOWN — 주한미군은 일반 재무제표 모델 비적용. TS(전체 IT 예산) 공개자료 없음 → UNKNOWN | TS(USFK IT 예산) 공개 불가 — 계약 상한 기반 RAW만 유지. SAM.gov 계약 실집행액 확인 |
| KA41 신용협동조합 | 2026|TS, 2026|RAW, 2026|FPR, 2031|TS, 2031|RAW, 2031|FPR | 앵커 UNKNOWN — Phase1: 신협 차세대 3,500억원대(2027~2029, 보도·예산 미확정) — 2026 TS 근거 부족, 2027 이후 드라이버로만 | 신협중앙회 감사보고서/경영공시(MyDART 미등록) 및 차세대 예산 확정 공고 모니터링(KR-BID) |
| KA42 Fastly, Inc. | 2026|TS, 2026|RAW, 2026|FPR, 2031|TS, 2031|RAW, 2031|FPR | 앵커 UNKNOWN — Fastly: 글로벌 매출만 확인. 서울 POP 호스팅 IDC 미확인 → TS UNKNOWN | Fastly 서울 POP 호스팅 IDC·트랜짓 계약(사내 영업 자료) 필요 |
| KA43 Valve Corporation | 2026|TS, 2026|RAW, 2026|FPR, 2031|TS, 2031|RAW, 2031|FPR | 앵커 UNKNOWN — Valve: 비상장, 국내 법인 없음. Steam CDN 캐시 일부 LG U+ 망 관찰(보도) → TS UNKNOWN | Valve 국내 캐시·피어링 계약(사내 영업 자료) 필요 |
| KA50 키암코인천도화동데이터센터일반부동산사모투자회사 | 2031|TS, 2031|RAW, 2031|FPR | 앵커 UNKNOWN — 키암코인천도화동DC 펀드: 운용사 산은인프라자산운용(DART). 용량·임차인·투자비 미수집 → UNKNOWN | 2031: DC 준공·임차인 확정 후 용량 모델 적용 (KR-BID/뉴스 모니터링) |
