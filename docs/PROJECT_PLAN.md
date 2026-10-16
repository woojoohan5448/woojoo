# PROJECT PLAN & STATUS — 53 Key Account IT Spending & FPR Intelligence Platform

기준일 2026-10-16

## 1. 환경 점검 결과 (STEP 1)
| 항목 | 결과 |
|---|---|
| 작업 디렉터리 | 빈 디렉터리에서 신규 구축 (`/home/user/project`) |
| 런타임 | Python 3.13, Node 22, npm 10, Chromium(Playwright 사전설치) |
| DART | `DART_API_KEY` 없음. 직접 접속 차단 → **PlayMCP OpenDART(MCP) 사용 가능**(기업정보·주요계정·전체 재무·공시검색) |
| KISA 정보보호 공시 포털 | 직접 접속 DNS 차단 → 언론 보도 인용으로 대체(SECONDARY) |
| WebSearch | 사용 가능, **턴당 200회 한도** — 병렬 조사 중 소진 |
| WebFetch | 언론·위키 등 전 호스트 DNS 실패 → 원문 본문 확인 불가 |
| 나라장터(PlayMCP) | 최근 7일 계약만 — 장기 계약 확인 용도로 부적합 |
| 경영진 판서 이미지 | **제공되지 않음** — 프롬프트의 구조(TS→RAW→FPR→CR/Target, 2026 vs 2031) 서술을 기준으로 시각화 설계. 원본 이미지 제공 시 레이아웃 재검토 권장 |

## 2. 단계별 진행
| 단계 | 상태 | 산출물 |
|---|---|---|
| STEP 1 Architecture & Entity | 완료 | PROJECT_PLAN, ACCOUNT_MASTER.csv, ENTITY_RESOLUTION_REPORT, DATA_DICTIONARY, METHODOLOGY, RESEARCH_PROTOCOL |
| STEP 2 Pilot (5개 유형) | 완료 | 국민은행(은행)·LG CNS(SI)·아마존(하이퍼스케일러)·KG모빌리티(제조)·주한미군(특수). 모델 결함 6건 발견·수정(QUALITY_REPORT §3) |
| STEP 3 53 Account Pipeline | 완료(부분 커버리지) | 53개 조사 파일, 상태 관리, RESEARCH_GAPS |
| STEP 4 Dashboard | 완료 | React/TS/Vite/ECharts/Tailwind + FastAPI + SQLite, 단일 HTML 빌드 |
| STEP 5 QA & Synthesis | 완료 | QUALITY_REPORT, STRATEGIC_SYNTHESIS, 테스트 40개(pytest 20·vitest 6·E2E 14) |

## 3. 다음 단계 (권장)
1. 사내 CR·계약·목표 입력 → C-SOW/Upside 산출 및 FPR 가정 보정 (관리자 화면/CSV)
2. `DART_API_KEY` 발급 + KISA 포털 원문 대조 → VERIFIED 승격 (`research/collectors/dart_collector.py` 사용)
3. 후속 세션에서 WebSearch 한도 내 RESEARCH_GAPS 상위 20개사 재조사(프로토콜 동일)
4. 접근률·포획 상한을 사업부 워크숍으로 검증(Layer C)
5. 하이퍼스케일러 MW 수요 계정팀 인터뷰 → DC 투자 판단
