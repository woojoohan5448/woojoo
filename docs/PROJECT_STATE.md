# PROJECT STATE (2026-10-16, 브랜치 phase1-4-na-recovery)

## 지표 (`data/phase1/current_coverage.json`)
| 지표 | v1.0 기준선 | 현재 |
|---|---|---|
| External Estimable Coverage | 63.5% (202/318) | **90.8% (286/315)** |
| 외부 결측(RESEARCH GAP) | 116 | **29** |
| N/A Recovery Rate | — | **72.4% (84/116, NOT_APPLICABLE 3 포함)** |
| Internal Required Count | 318 | 318 (사내 입력 전 정상) |
| 등급 분포(외부 필드) | HIGH 13·MED 53·LOW 136 | HIGH 10·MED 53·LOW 223 |
| VALIDATION ERROR | 0 | 0 |
| 근거 항목(evidence) | — | 632 |

## TS 앵커 방법 분포 (53개)
KISA_IT_INVESTMENT 17 · AUDIT_IT_COMPONENTS 11 · ACCOUNT_SPECIFIC 9 · REVENUE_INTENSITY 7 · KISA_SEC_SCALED 3 · UNKNOWN 6

## 잔존 RESEARCH GAP
KA28(6) · KA41(6) · KA42(6) · KA43(6) · KA32(2026·2031 TS 2) · KA50(2031 3) = 29

## 주요 정정 (Phase 1~2)
- 토스페이먼츠 TS 1,526 → 452억 (PG 통과매출 제외)
- 신한은행 4,450(추정 예산) → 4,866억 (KISA FY25 4,634 앵커)
- 구글 그룹매출 6,831 → 구글클라우드코리아 법인 기준, 오라클 글로벌 → 한국법인
- KA45 메타: UNKNOWN → 망 이용대가 동등가치 342억(LOW, 정의 상이) — P2

## 산출물 위치
`data/processed/dashboard.json`·`intel.db` · `data/exports/*.csv|xlsx` · `data/phase1/*` · `reports/*` · `Key_Account_Dashboard.html`(단일 HTML) · `dist_release/*.zip`

## 테스트
pytest 36 · vitest 6 · E2E 16 (2026-10-16 최종 QA 후)

## 최종 QA
`reports/final_qa/` — 값 변경 0건, 표시·상태·범위·추적성·사내 결합 로직 수정. 근거 유형: IT지출 공시값 11 · 재무항목 재구성 25 · 산업 평균 7 · 시나리오 4 · 계약 RAW 1 · 근거 없음 5
