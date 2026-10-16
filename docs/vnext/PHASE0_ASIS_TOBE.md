# vNext Phase 0 — AS-IS 분석 · TO-BE 설계 (Strategic Intelligence Dashboard)

> 2026-10-16 · 브랜치 `vnext-phase0` · 복구 태그 `v2.1-pre-vnext`(=`qa-final-audit` 최종 커밋) · data_version `20261016T051757Z`
> **이번 단계는 분석·설계만 수행했다. UI·계산 로직은 변경하지 않았다.** Phase 1 착수는 사용자 승인 후.

---

## 0. 요약 (Executive Summary)

| # | 핵심 판단 | 근거 |
|---|---|---|
| 1 | **①~⑧ 프레임워크는 데이터 모델에 거의 그대로 구현되어 있다.** 산식(C-SOW=CR/RAW, PCR=CR/FPR, Upside=FPR−CR, Target SOW=Target/RAW_2031)과 불변식 검증이 엔진·테스트에 존재 | §3 |
| 2 | 단, **⑧ Target**은 경영진 입력이 없으면 `FPR_2031 × 50%` 시나리오 값을 생성해 헤더 KPI(≈8,100억)와 포트폴리오 합계에 노출 → 마스터 기준("실제 Account Plan 목표", "추정 부분합을 확정 목표처럼 표시 금지")과 **충돌** | §3, 결정 D1 |
| 3 | **Strategic Opportunity Engine은 이미 사업영역 8개 × (RAW/FPR 2026·2031, CAGR, 고객 수, 신뢰도, 정성 역량 평가, 권고 유형, 점수)를 산출**한다. 재사용 가능 | §4 |
| 4 | 그러나 **사업영역별 FPR은 고객별 근거가 아니라 업종 기본 믹스(A-MIX, 분석가 판단)로 배분**된 값이다. 고객별 근거로 보정된 것은 보안 비중(KISA 공시 25개사)과 접근률 보정(16개사)뿐 → 마스터 기준 6.2("근거 없이 배분 금지")의 핵심 Gap | §4.2 |
| 5 | 그 결과 **'수요 고객 수'가 모든 영역에서 32~43개사로 거의 동일**(믹스가 모든 고객에 적용되기 때문)하고, **AI Infrastructure의 2031 TS 중 62%가 브리지 배분 가정(B-ALLOC)에서 생성** — 우선순위 2위의 상당 부분이 가정 산물 | §4.2 |
| 6 | 반면 **고객별 수요 신호(drivers 70건, 35개사)와 경쟁·기존 공급자 관찰(competitive 102건)**이 근거 ID와 함께 이미 수집되어 있으나 전략 엔진에 연결되지 않음 → Opportunity Pool의 **근거 축**으로 재활용 가능 | §4.3 |
| 7 | 신규 개발의 핵심은 ① 중앙 용어사전·IA 개편, ② 2026→2031 성장 궤적 차트(중간연도는 Illustrative), ③ **Opportunity → Capability Gap → Initiative → Priority → Action** 데이터 계층과 양방향 Drill-down | §5~7 |

**승인 요청 결정 사항 5건은 §10**에 있다(D1 Target 표시, D2 RAW 영문 표기, D3 전략과제 후보 초안 범위, D4 우선순위 가중치 처리, D5 Strategic Overview 첫 화면 지정).

---

## 1. AS-IS 구조

### 1.1 전체 구조도
```
[조사 원천]  data/raw/research/*.json (v1, 불변) + research_p1/ + research_p2/ (보충)
     │        facts(재무 사실·VERIFIED/SECONDARY) · evidence · drivers(수요 신호) · competitive(기존 공급자)
     ▼
[가정·보정]  config/model_parameters.json (A-MIX 업종 믹스, C-ADDR 접근률, C-CAP 포획상한, B-BRIDGE 성장, B-ALLOC 증분 배분)
            config/account_overrides.json (계정별 앵커·보정) · strategy_capabilities.json (영역별 정성 역량 평가)
     ▼
[계산 엔진]  models/build.py ── spending/ts.py → addressability/raw.py → capture/fpr.py → forecasting/bridge.py
            → validation/checks.py → grading → reconcile(사내) → aggregate/by_dimension → strategy_engine
     ▼        ▲ models/internal/excel_io.py ← data/internal_store (CR·영업추정·목표·Account Plan, 승인 레이어)
[산출물]     data/processed/dashboard.json (단일 계약) · intel.db(SQLite) · exports(CSV/XLSX)
     ▼
[표현]       backend/app.py (FastAPI: /api/dashboard·import·export)  ──┐
            frontend/src (React+TS+ECharts+Tailwind)                    ├→ frontend/dist (API 모드)
            frontend/src/data/dashboard.json (번들 내장)                 └→ dist-single → Key_Account_Dashboard.html (정적·조회 전용)
```

### 1.2 소스 ↔ 번들 HTML 관계
| 항목 | 내용 |
|---|---|
| 원본 소스 | **존재함** — `frontend/src` (TS/TSX 1,648줄), `models/` (Python 약 3,000줄), `backend/app.py` |
| 번들 HTML | `Key_Account_Dashboard.html` = `npm run build:single`(vite-plugin-singlefile) 결과물을 복사. JS·CSS·`dashboard.json` 전부 인라인(약 2.9MB) |
| 데이터 로딩 | `lib/data.ts`: `/api/dashboard` 응답이 JSON이면 **API 모드**, 아니면 번들 데이터로 **정적 모드** |
| 결론 | HTML을 직접 수정하지 않는다. 소스 수정 → 빌드 → HTML 재생성 |

### 1.3 데이터 스키마 (계정 1건, `dashboard.json.accounts[]`)
| 블록 | 키 | 비고 |
|---|---|---|
| 식별 | account_id, original_name, segment, family, entity, overlap_groups, aggregate_class | 53개 |
| 2026 | `m.2026.{TS,RAW,FPR,CR,CSOW,PCR,UPSIDE}` | 각 레코드: value·low·high·status·grade·confidence·formula·inputs·evidence_ids·assumption_ids·notes·**by_cat(10개 카테고리)** |
| 2031 | `m.2031.{low,base,high}.{TS,RAW_base,RAW_expansion,FPR_base,FPR_expansion,FPR_const_capability,TS_CAGR,RAW_CAGR,FPR_CAGR,bridge}` | 시나리오 3 × 접근성 케이스 2 |
| 목표 | `m.target.{TARGET,TARGET_SOW,UPSIDE_2031,TARGET_INCREMENT}` | |
| 근거 | anchor, evidence[], facts[], **drivers[]**, **competitive[]**, research_log, open_questions, evidence_basis, na_class | |
| 사내 | reconciliation (영업 추정 비교) | 사내 데이터 있을 때만 |
| 전사 | `portfolio.{aggregate, by_segment, by_family, overlap_groups}`, `strategy[]`(사업영역 8개) | |
| **중간연도(2027~2030)** | **없음** | Phase 2에서 보간 필요 |

### 1.4 카테고리 → 사업영역 매핑 (기존 스키마, 유지 대상)
| 카테고리(by_cat) | 사업영역(biz_area) |
|---|---|
| CONNECTIVITY | Connectivity |
| DC_COLO | Data Center / IDC |
| CLOUD | Cloud |
| AI_INFRA | AI Infrastructure |
| SECURITY | Security |
| SI_BUILD | AI Transformation / SI (≈ 마스터 예시의 AX / AI Solutions) |
| IT_OPS | SI / Managed Services |
| SW_LICENSE, HW_DEVICE | 기타 |
| INTERNAL_LABOR | 접근 불가(RAW 0) |

### 1.5 빌드·테스트 명령 (회귀 기준선)
| 구분 | 명령 | 현재 결과 |
|---|---|---|
| 모델 | `python3 -m models.build` | 53개, ERROR 0 |
| 감사 | `python3 -m models.audit current` · `models.qa.final_audit` | 커버리지 90.8%, 추적성 286/286 |
| 백엔드·모델 테스트 | `python3 -m pytest -q` | **36 통과** |
| 프런트 단위 | `cd frontend && npx tsc --noEmit && npx vitest run` | **6 통과** |
| E2E | 서버 기동 후 `node tests/e2e/dashboard.e2e.mjs` | **16 통과** |
| 빌드 | `npm run build && npm run build:single` | dist + 단일 HTML |
| 패키지 | `python3 tools/make_release.py && python3 tools/check_release.py` | 문제 0건 |

---

## 2. 실제 구현 기능 목록 (= 보존 대상, 회귀 테스트 항목)

| 영역 | 기능 | 위치 | 보존 방식 |
|---|---|---|---|
| 헤더 | KPI 9개(분석 고객, 2026/2031 TS·RAW·FPR, 2031 Target, 합산 제외, 외부 커버리지), 버전·모드·테마 | Header.tsx | Strategic Overview로 이전·재구성 |
| Account Opportunity | 고객 검색·필터·정렬 사이드바, 2026 vs 2031 비교 차트(가로 막대·수염·빗금), Low/Base/High·Base/Expansion 전환, 표 보기, 로그 축, C-SOW·PCR·Upside·Target SOW 타일, FPR 2031 증가 분해, 카테고리 차트, 브리지 차트, 서술형 분석, 근거 유형 배지, Reconciliation 패널, Research Gap 배너 | AccountView.tsx, Sidebar.tsx, charts.ts | 유지 + 성장 궤적 차트 추가 |
| Evidence & Calculation Inspector | 선택 지표의 값·범위·등급·원천 입력·추정 여부·산식·가정·대체 근거·충돌·불확실성, 근거 원문 링크 | Inspector.tsx | **그대로 유지**(Drawer 전환 시에도 동일 컴포넌트) |
| Executive Portfolio | 산업별 RAW·FPR, 기회 규모×성장률 버블, 성장 동인 합계, 중복 위험 표, Top 리스트 4종 | PortfolioView.tsx | '전사 기회 분석'으로 이전 |
| Strategic Opportunity | 사업영역별 FPR 차트, 우선순위 점수 표, 영역별 카드(포지션·경쟁·필요 역량·Gap·투자·난이도·권고·주의) | StrategyView.tsx + build.strategy_engine | '전략과제 우선순위'의 Opportunity Pool로 재사용 |
| Data Quality | 상태 분포, N/A 분류(기준선 대비), 이슈 목록 | QualityView.tsx | '데이터·운영 관리' 하위 |
| 관리자 입력 | Excel 템플릿·업로드·미리보기·승인, 레거시 간이 입력(기본 비활성), CSV 내보내기 | AdminView.tsx | 하위 메뉴 |
| Methodology | 파라미터·근거 맵·벤치마크 | MethodologyView.tsx | ①~⑧ 개념 설명 추가 |
| 모드 | API 모드 / 정적 HTML 모드 자동 판별 | lib/data.ts | 유지 |
| 거버넌스 | 등급 체계, N/A 7종 표시, 정의 상이 합계 제외, 중복 위험, 사내 데이터 포함 경고, 릴리스 차단 | build·audit·tools | 유지 |

---

## 3. ①~⑧ 프레임워크 ↔ 기존 데이터 모델 일치 검증

| # | 판서자 정의 | 현재 구현 | 일치 | 조치 |
|---|---|---|---|---|
| ① TS | 고객 전체 IT 지출(판매 불가 영역 포함) | `m.2026.TS` — 내부 IT 인건비(INTERNAL_LABOR) 포함, 10개 카테고리 분해 | ✅ | 하이퍼스케일러·메타 5개사는 정의 상이(국내 인프라 지출·망 이용대가 환산)로 합계 제외 — 유지 |
| ② RAW | TS 중 현실적 공략 가능 영역, RAW ≤ TS | Σ(TS_i × 접근률_i), 인건비 0·SW/HW 저접근률·캡티브 SI 50% 하향 | ✅ | 영문 표기 **'Realistically' → 'Realistical'**(판서자 원문) 변경 필요(D2). 필드명 `RAW` 불변 |
| ③ FPR | RAW 중 최대 확보 가능, FPR ≤ RAW | Σ(RAW_i × 포획상한_i) — 이중망·멀티벤더 반영 | ✅ | 경쟁사·기존 공급자는 상한 파라미터로만 반영(고객별 경쟁 관찰 102건 미연결) → Phase 3 |
| ④ CR | 사내 실적, 없으면 N/A, 추정 대체 금지 | 사내 Excel 승인 레이어 → CR, 미입력 NULL(0 아님) | ✅ | 53개 모두 현재 NULL(외부 환경) |
| ⑤-1 C-SOW | CR / RAW | `CSOW = CR/RAW_2026`, 검증 규칙 CSOW_FORMULA | ✅ | — |
| ⑤-2 PCR | CR / FPR, 분모 0·미확인 시 미산출 | `PCR = CR/FPR_2026`, safe_div | ✅ | — |
| ⑥ Upside | FPR − CR, 같은 기준연도, 음수를 0으로 바꾸지 않음 | `UPSIDE = FPR_2026 − CR_2026`, 절삭 없음, CR>FPR 경고 | ✅ | 음수 시 '가정 검증 필요' 문구를 UI에 명시(Phase 1) |
| ⑦ 2031 TS/RAW/FPR | 외부 근거+사업 가정, 실제/추정 구분, 시나리오별 과정 | 브리지(성장 동인 7종) × Low/Base/High × Base/Expansion, 결합 범위, 산식·가정 ID | ✅ | 중간연도 없음(Phase 2), 역량 확대 효과 분리 표시 존재 |
| ⑧ Target / Target SOW | 실제 Account Plan 목표, Target ≤ FPR_2031, Target SOW = Target/RAW_2031, Target SOW > C-SOW는 '검토 사항' | 산식·검증 존재(TARGET_GT_FPR ERROR, TARGET_SOW_NOT_ABOVE **WARN**) | ⚠️ | ① 미입력 시 **FPR×50% 시나리오 목표 생성·헤더 KPI·합계 노출** → 기준과 충돌(D1). ② TARGET_SOW_NOT_ABOVE는 '데이터 오류'가 아닌 '목표 적정성 검토'로 분류 변경 필요 |
| 시점 분리 | 2026 CR과 2031 Target을 한 시계열로 혼동 금지 | 차트에서 "CR/Target" 한 행에 2026=CR, 2031=Target 표시 | ⚠️ | 성장 궤적 차트에서 CR(실적 점)과 Target(목표 마커)을 별도 계열로 분리(Phase 2) |

---

## 4. 기존 Strategic Opportunity Engine 분석

### 4.1 실제 수행 범위
| 단계 | 구현 | 입력 |
|---|---|---|
| 영역 집계 | 카테고리 by_cat → 8개 사업영역별 RAW/FPR 2026·2031, Expansion, High 합계 | 계정별 by_cat (정의 상이 계정은 '별도 수요'로 분리) |
| 성장 | FPR CAGR 2026→2031 | 합계 |
| 수요 폭 | `n_accounts` = FPR_2031 ≥ 1억인 고객 수 | by_cat |
| 수요 신뢰도 | FPR 가중 평균 신뢰도 | 지표 confidence |
| 상위 고객 | FPR_2031 상위 5개사 | by_cat |
| 정성 역량 평가 | lgu_position, entry_feasibility, competition, required_capabilities, capability_gap, investment_need, difficulty, recommendation(_type), evidence_refs, caveats | `strategy_capabilities.json` (ANALYST_JUDGMENT, 시장 벤치마크 MB 참조) |
| 점수 | **35×규모 + 20×성장률 + 15×수요 고객 수 + 15×진입 가능성 + 15×수요 신뢰도 − 난이도(0/4/8)** (상대값, 0~100) | 위 항목 |

### 4.2 정량 진단 — 재사용 전 반드시 해결할 한계
| 사업영역 | 모델상 수요 고객 | **고객별 수요 신호(drivers) 보유** | 경쟁 관찰 보유 | FPR 2026→2031(억) | CAGR | 점수 |
|---|---|---|---|---|---|---|
| Connectivity | 43 | 0 | 23 | 3,354 → 5,007 | 8.3% | 73.3 |
| AI Infrastructure | 40 | 15 | 4 | 652 → 3,426 | 39.3% | 63.4 |
| Data Center / IDC | 42 | 10 | 15 | 2,648 → 4,101 | 9.1% | 63.3 |
| Cloud | 40 | 2 | 6 | 507 → 1,581 | 25.5% | 47.2 |
| Security | 39 | 12 | 4 | 537 → 1,187 | 17.2% | 39.6 |
| AI Transformation / SI | 35 | 3 | 11 | 119 → 319 | 21.8% | 24.9 |
| SI / Managed Services | 32 | 3 | 17 | 166 → 282 | 11.2% | 22.2 |
| 기타 | 24 | 0 | 1 | 216 → 264 | 4.2% | 20.3 |

(수요 신호 매핑: DC_BUILD→IDC·AI Infra, AI_INVESTMENT→AI Infra, REGULATORY_SECURITY→Security, CLOUD_MIGRATION→Cloud, NEXT_GEN_CORE→SI. 'OTHER' 19건은 미분류)

| 한계 | 내용 | 영향 |
|---|---|---|
| L1 배분 근거 | 영역별 FPR = 계정 TS × **업종 기본 믹스(A-MIX)** × 접근률 × 포획상한. 고객별 근거 보정은 보안 비중(KISA 25개사)·접근률(16개사)뿐 | 영역 간 비교가 고객 데이터가 아닌 가정에 좌우 |
| L2 수요 폭 왜곡 | 믹스가 모든 고객에 적용되어 '수요 고객 수'가 영역마다 32~43으로 거의 동일 → 점수의 15점 항목이 변별력 없음 | 점수 신뢰도 저하 |
| L3 성장 가정 | 2031 증가분을 B-ALLOC(분석가 판단)으로 카테고리에 배분. **AI_INFRA 2031 TS의 62%가 배분 가정에서 생성**(비교 가능 계정 합, 자연 성장분 6,709억 vs 가정 증분 10,959억) | AI Infra 우선순위 2위가 가정 민감 |
| L4 역량 평가 | 8개 영역 정성 평가 1벌(분석가 판단). '미확인'과 '부족'의 구분 없음(예: Security Gap=HIGH, 권고 M&A_REVIEW) | 마스터 기준 6.3 위반 소지 |
| L5 과제 단위 | 결과 단위가 '사업영역'이며 '전략과제(Initiative)'·실행과제·상태 개념 없음 | Opportunity-to-Action 미구현 |
| L6 연결성 | 영역 → 고객 drill-down은 상위 5개사만, 고객 → 영역/과제 역방향 연결 없음. drivers·competitive 근거 미연결 | 추적성 부족 |
| L7 가중치 | 가중치가 코드 상수로 확정되어 있고 민감도·순위 안정성 미제시 | 마스터 기준 6.5(가중치 임의 확정 금지) |

### 4.3 재사용 자산
- 영역 집계·정의 상이 분리·Expansion/High 합계 로직 → **Opportunity Pool의 '모델 기반 규모' 축**으로 그대로 사용
- `strategy_capabilities.json` → **Capability Gap 초기값**(상태 = 분석가 가설, 검증 필요)
- drivers(70건/35개사), competitive(102건), overlap_groups → **근거 기반 수요·경쟁·중복 축**
- `FPR_const_capability` → '고객 지출 성장 vs U+ 역량 확대 가정' 분해(이미 구현)

---

## 5. Gap 분석 (마스터 요구 → 현황 → 대응)

| 요구 | 현황 | 구분 | 대응 Phase |
|---|---|---|---|
| IA 5개 메뉴(전략 인사이트·고객별·전사 기회·전략과제·데이터운영) | 기능 중심 6탭 | 개편 | P1 |
| 핵심 용어 영문 보존 + 한글 병기, 중앙 용어 사전 | METRIC_LABEL 일부, 'Realistically' 표기, 용어 분산 | 신규 | P1 |
| Tooltip(정의·목적·산식·주의) Hover/Click/Focus, 3단계 온보딩 | 일부 title 속성만 | 신규 | P1 |
| Strategic Overview 첫 화면 | 없음(헤더 KPI만) | 신규 | P1 |
| 2026~2031 성장 궤적(TS/RAW/FPR/CR/Target, 중간연도 Illustrative) | 2026·2031 2시점 가로 막대 | 신규(기존 차트 유지·병행) | P2 |
| 전사 합산 전환, 계열 Show/Hide, 클릭→Inspector | 고객 단위만 | 확장 | P2 |
| RAW 대비 FPR·Target 비율, 2026/2031 구조 비교 | C-SOW·Target SOW 타일, % 라벨 | 확장 | P2 |
| Opportunity Pool(영역별 RAW/FPR, 증가·CAGR, 고객 수, 상위 고객, 경쟁, 신뢰도, 커버리지, 중복 위험) | 엔진에 대부분 존재. 근거 기반 고객 수·경쟁·커버리지·중복 없음 | 확장 | P3 |
| 근거 없는 배분 금지 → Data Gap 표시 | 믹스 배분값을 그대로 표시 | **신규 거버넌스** | P3 |
| Capability Gap 8개 진단 항목 + '검증 필요' 상태 | 정성 평가 6개 항목, 상태 구분 없음 | 확장 | P3 |
| 전략과제 후보·WHY/GAP/OPTION/PRIORITY/ACTION 상세 | 영역 카드 + 권고 문장 | 신규 | P3 |
| 우선순위(9개 평가요소, 가중치 미확정·민감도) | 5요소 고정 가중치 | 확장 | P3 |
| 과제 상태 5단계, 자동 승인 금지 | 없음 | 신규 | P3 |
| 양방향 Drill-down(과제↔고객↔근거) | 영역→상위 5개사 | 신규 | P3 |
| Target 정의 준수(D1), Target SOW 검토 분류 | 시나리오 목표 노출, WARN | 수정(승인 필요) | P1 |
| 회귀(기존 KPI·53개 고객·시나리오·Evidence·정적/API) | 테스트 36/6/16 | 확장 | P4 |

---

## 6. TO-BE 정보구조(IA)와 화면 설계

### 6.1 메뉴 구조
```
┌ ① 전략 인사이트 (Strategic Overview)        ← 첫 화면(D5)
├ ② 고객별 사업기회 (Account Opportunity)     ← 기존 AccountView + 성장 궤적
├ ③ 전사 기회 분석 (Opportunity Portfolio)    ← 기존 PortfolioView + 영역×산업
├ ④ 전략과제 우선순위 (Strategic Priorities)  ← 기존 StrategyView → Opportunity-to-Action
└ ⑤ 데이터·운영 관리
     ├ 데이터 신뢰도 (Data Quality)
     ├ 분석 기준·산식 (Methodology, ①~⑧)
     ├ 관리자 입력 · Excel Import
     └ 근거 및 산식 관리 (evidence/assumption 목록)
[공통] 수치 산출 근거 (Evidence & Calculation Inspector) — 우측 조절형 패널 ↔ Drawer(좁은 화면)
```

### 6.2 화면별 구성 (KPI → 시각화 → 인사이트 → 근거)
| 화면 | 상단 KPI | 핵심 시각화 | 인사이트·액션 | 근거 진입 |
|---|---|---|---|---|
| ① 전략 인사이트 | 분석 대상 53 / 유효 분석 고객 수, 2031 RAW, 2031 FPR, 2031 Target(**사내 입력 고객 수와 함께**; 미입력 시 'INTERNAL INPUT REQUIRED'), 외부 커버리지, 우선 검토 과제 후보 수 | 전사 성장 궤적(부분합·커버리지 표기), 사업영역 기회 집중도(근거 기반/모델 배분 구분), 산업별 상위 기회 | 최우선 검토 과제 후보 3~5개(상태 배지), 검증 필요사항 Top 5 | 각 카드 클릭 → ③/④/Inspector |
| ② 고객별 사업기회 | TS/RAW/FPR/CR/Target, C-SOW, PCR, Upside, Target SOW | **성장 궤적 차트(신규)** + 기존 2시점 비교 차트(탭 전환) + 카테고리·브리지 | 고객 주요 사업기회(drivers), **연결된 전략과제 후보** | 지표 클릭 → Inspector |
| ③ 전사 기회 분석 | 집계 고객 수·커버리지, 정의 상이·중복 제외 | 영역×산업 히트맵(RAW/FPR), 2026→2031 성장 기여 워터폴, 시나리오 차이, 고객 집중도(상위 5개 비중) | 중복 위험·부분합 경고 | 셀 클릭 → 고객 목록 |
| ④ 전략과제 우선순위 | 과제 후보 수(상태별), 근거 보강 필요 수 | Opportunity Pool 표 → Capability Gap 매트릭스(수요 × 역량) → 과제 후보 카드 → 우선순위(점수 + 가중치 민감도 범위) | WHY/GAP/OPTION/PRIORITY/ACTION 상세 | 과제 → 관련 고객 → 지표 → 근거 |
| ⑤ 데이터·운영 | — | 기존 화면 그대로 | — | — |

### 6.3 핵심 그래프 — 2026~2031 Opportunity Growth (Phase 2 설계)
| 구성 | 설계 |
|---|---|
| A. 성장 궤적(메인) | X=2026~2031, Y=억원(선형, 공통축). TS(Blue)·RAW(Green)·FPR(Magenta)은 **비누적 선 + 반투명 범위 밴드**(2026 추정 범위 ↔ 2031 결합 범위). 2026·2031은 실점(●), **2027~2030은 점선 + 'Illustrative Projection' 음영**(CAGR 보간, 클라이언트 계산·저장하지 않음) |
| CR / Target | CR = 2026 단일 주황 점(사내 실적 있을 때만; 없으면 'INTERNAL INPUT REQUIRED' 라벨). Target = 2031 주황 계열 **별도 목표 마커(◆)**. 두 점을 선으로 잇지 않음(시계열 혼동 방지). 연도별 Target 미생성 |
| B. 비율 패널(소형) | RAW 대비 FPR %, RAW 대비 CR %(C-SOW), RAW 대비 Target %(Target SOW) — 2026 vs 2031 막대 쌍. 이중축 없음 |
| C. 구조 비교 | 기존 2026 vs 2031 가로 막대(포함 관계 옅은 막대) 유지 |
| 전환 | 고객 ↔ 전사 부분합(커버리지 n/53 표기, 정의 상이 제외), Low/Base/High, Base/Expansion, 계열 표시/숨김, 로그축(A만) |
| 연결 | 점 클릭 → Inspector(2026/2031 레코드). 보간 점 클릭 → "보간값 — 근거 없음, 산식만" 안내 |

### 6.4 UX Writing 규칙 (중앙 용어 사전 `frontend/src/lib/glossary.ts` 신설)
| 위치 | 표기 예 |
|---|---|
| 개념 소개·Methodology | `② Realistical Addressable Wallet (RAW) (LGU+ 공략 가능 시장)` |
| KPI 카드 | `RAW (LGU+ 공략 가능 시장)` |
| 좁은 범례 | `RAW` |
| Tooltip | 원어 + 한국어 뜻 + 정의 + 목적 + 산식 + 해석 주의 |
| 메뉴 | 한국어 중심(고객별 사업기회 등) |
| 데이터 키·API | **변경하지 않음**(RAW, FPR_base, TARGET_SOW 등) |

사전 항목 스키마: `{ no: '②', code: 'RAW', en: 'Realistical Addressable Wallet', ko: 'LGU+ 공략 가능 시장', definition, purpose, formula, caution, fieldKeys: ['m.2026.RAW', ...] }` — KPI·Tooltip·Methodology·Inspector가 동일 소스 사용.

---

## 7. Opportunity-to-Action 데이터 연결 구조

### 7.1 계층과 근거 등급
```
Account(53) ──by_cat──► OpportunityPool(영역 8)          [MODEL_ALLOCATED: A-MIX 배분 | EVIDENCE_BACKED: 고객별 근거로 보정/확인]
   │  └─ drivers(수요 신호) ──┐                              ▲ demand_signals[], competitive_obs[], overlap_risk
   │  └─ competitive(기존 공급자)┤                            │
   └──────────────────────────┴──► DemandSignal ───────────┘
OpportunityPool ──► CapabilityAssessment(영역 × 8 진단항목)   [status: PUBLIC_EVIDENCE | ANALYST_HYPOTHESIS | NEEDS_INTERNAL_VALIDATION | CONFIRMED_INTERNAL]
                 └─► StrategicInitiative(후보) ◄─ 근거: pool_ids, account_ids, signal_ids, evidence_ids, assumption_ids
                        ├─ PriorityAssessment(요소별 점수·결측·가중치 세트별 순위 범위)
                        ├─ Options(자체개발/파트너십/인프라투자/신규상품화/GTM)
                        └─ Actions(추가조사·검증·의사결정; owner=확인된 경우만)
                        status: 1 분석 가설 → 2 근거 보강 필요 → 3 사내 역량 검증 필요 → 4 검토 준비 완료 → 5 승인된 추진과제(사람 승인만)
```

### 7.2 엔터티 정의 (dashboard.json 추가 블록 `opportunity_to_action`, 기존 키 불변)
| 엔터티 | 주요 필드 | 생성 규칙 |
|---|---|---|
| OpportunityPool | area, categories, RAW/FPR 2026·2031(base/expansion/high), FPR_increase, CAGR, **n_accounts_model**, **n_accounts_evidence**, evidence_share(근거 보강 계정의 FPR 비중), top_accounts, competitive_summary(incumbent별 관찰 수), overlap_risk(그룹·공급자-구매자), confidence, coverage(n/53), mismatch_separate, **allocation_basis** | 기존 strategy_engine 결과 + 근거 축 결합. 근거 계정 0이면 `DATA_GAP` 플래그 |
| DemandSignal | signal_id(=driver_id), account_id, area, type, description, amount, period, direction, evidence_ids | drivers 매핑 규칙(설정 파일 `config/demand_signal_map.json`). 'OTHER'는 분석가 분류 전까지 미매핑 |
| CapabilityAssessment | area, dimension(상품 보유·기술 경쟁력·인프라/운영·영업/GTM·파트너십 필요성·경쟁/전환 장벽·투자 필요성·난이도/리드타임), rating, **status**, basis_text, evidence_refs | 초기값 = strategy_capabilities.json을 차원별로 분해, status=ANALYST_HYPOTHESIS. 미확인은 rating=null + NEEDS_INTERNAL_VALIDATION(‘부족’ 단정 금지) |
| StrategicInitiative | initiative_id, title, hypothesis, area_ids, why{accounts, pool_size, growth}, gap{capability_ids}, options[], priority{}, actions[], status, owner(nullable), linked_account_ids, evidence_ids, assumption_ids, created_by(ANALYST/RULE), approved_by(nullable) | **설정 파일 `config/strategic_initiatives.json`(분석가 초안, 사람 편집)** + 엔진이 수치·근거를 채움. 자동 생성 과제는 status=1 고정 |
| PriorityAssessment | factors{size, growth, demand_certainty, competition_barrier, capability_fit, gap_difficulty, investment_cost, time_to_revenue, data_confidence} 각 {value, source, missing}, weight_sets[], rank_range, tier(우선 검토 후보 / 추가 검증 필요) | 결측 요소가 2개 이상이면 단일 순위 대신 '추가 검증 필요' |
| Action | action_id, initiative_id, type(조사·검증·의사결정·실행), description, dependency, owner(nullable), due(nullable), status | 분석가 입력 |

### 7.3 우선순위 요소 매핑 (기존 엔진 재사용 여부)
| 마스터 평가요소 | 현재 엔진 | TO-BE 원천 |
|---|---|---|
| 기회 규모 | ✅ FPR_2031 상대값 | 동일 + evidence_share 병기 |
| 성장성 | ✅ FPR CAGR | 동일 + 가정 기여분(B-ALLOC) 분리 |
| 수요 확실성 | △ 신뢰도 가중 | **근거 기반 고객 수·수요 신호 수**로 대체(L2 해소) |
| 경쟁·진입 장벽 | △ entry_feasibility | competitive 관찰 + 정성 평가 |
| LGU+ 보유 역량 | △ capability_gap | CapabilityAssessment(상태 포함) |
| 역량 보완 난이도 | ✅ difficulty | 동일 |
| 투자·운영 비용 | △ investment_need(점수 미반영) | 반영(정성 등급) |
| 매출 확보 시점 | ❌ | 수요 신호 period + 리드타임(분석가) — 없으면 결측 |
| 데이터 신뢰도 | ✅ demand_confidence | 동일 + 근거 등급 |

가중치: 기존 식을 **'v1 기준 가중치'**로 보존하고, 대안 가중치 세트 2~3개(규모 중심·실행가능성 중심·균등)로 **순위 범위**를 함께 표시. 확정 가중치는 사용자/경영진 결정(D4).

### 7.4 양방향 Drill-down 경로
| 출발 | 경로 |
|---|---|
| 전략과제 | 과제 → 관련 영역 Pool → 관련 고객(근거 기반/모델 배분 구분) → 고객 화면 → 지표 → Inspector(근거 원문) |
| 고객 | 고객 화면 '연결된 전략과제' 패널 → 과제 상세(WHY에 해당 고객 기여 표시) |
| 근거 | Inspector의 driver/competitive 근거 → 이를 사용하는 과제 목록 |

---

## 8. Phase 1~4 실행 계획

| Phase | 범위 | 주요 산출물 | 완료 기준(검증) | 예상 규모 |
|---|---|---|---|---|
| **1 UX/IA** | 메뉴 5개 재구성, 중앙 용어사전·Tooltip(hover/click/focus)·3단계 온보딩, 전략 인사이트 첫 화면(기존 데이터만), 용어 영문 보존 표기, D1·D2 반영 | glossary.ts, OverviewView, Nav/Drawer, Methodology ①~⑧ | 기존 KPI 값 동일(스냅샷 비교), 기존 E2E 16 + 신규(메뉴·Tooltip 키보드), 정적/API 모드 | 中 |
| **2 성장 궤적** | 고객·전사 궤적 차트, 비율 패널, 보간(Illustrative), CR/Target 분리 마커, 시나리오·Inspector 연결 | GrowthChart, interpolate 유틸(단위 테스트) | 2026·2031 점 = 엔진 값 일치(53개 전수), 보간 표기, 결측 고객 처리, 시나리오 전환 | 中 |
| **3 Opportunity-to-Action** | 근거 축 결합 Pool, Capability 차원 분해·상태, 과제 후보 설정·엔진, 우선순위 요소·가중치 민감도, 상세(WHY~ACTION), 양방향 Drill-down, 데이터 Gap 관리 | build.opportunity_to_action, config 3종(demand_signal_map·initiatives·capability 차원), PrioritiesView | 수치 추적성(과제→근거 100%), 자동 승인 0건, 근거 0 영역 DATA_GAP 표시, 기존 strategy[] 값 불변 | 大 |
| **4 검증·최종화** | 기존 KPI 비교, 53개 전수 점검, 시나리오·결측·중복, Evidence 연결, 반응형·접근성, 정적/API, 패키지 | 회귀 리포트, HANDOFF 갱신, 단일 HTML·릴리스 | pytest·vitest·E2E 전체 통과, 값 diff 0(의도 변경 제외), check_release 문제 0 | 中 |

### 회귀 테스트 계획
- **값 스냅샷 테스트(신규, P1 착수 전 생성)**: 53개 × 2026/2031 × TS/RAW/FPR/Target·포트폴리오 합계·strategy[] 값을 `tests/fixtures/vnext_baseline.json`으로 고정 → 매 Phase 비교(의도된 변경만 화이트리스트).
- 기존 테스트 36/6/16 유지 + Phase별 신규 E2E(메뉴 이동, Tooltip 키보드 포커스, 궤적 차트 클릭→Inspector, 과제→고객→근거 경로).

---

## 9. 위험 요소

| 위험 | 영향 | 대응 |
|---|---|---|
| R1 영역별 FPR이 믹스 배분 가정 | 전략과제 우선순위가 가정 산물이 될 수 있음 | 근거 기반/모델 배분 분리 표기, 근거 0 영역 DATA_GAP, 과제 status ≤ 2 유지 |
| R2 AI Infra 성장의 62%가 B-ALLOC 가정 | AI 과제 과대평가 | 가정 기여분 분리, 민감도(배분 0.3~0.5) 표시 |
| R3 CR·Target·Account Plan 모두 미입력(외부 환경) | ④⑤⑥⑧ 화면이 대부분 'INTERNAL INPUT REQUIRED' | 합성 데이터 데모 모드(명시 표기)로 화면 검증, 실데이터는 사내 환경 |
| R4 역량 평가가 공개정보 기반 분석가 판단 | 'Gap'을 사실로 오인 | 차원별 상태 표기, 사내 역량 진단 템플릿(Excel 레이어 확장) 제안 |
| R5 상위 2개사 집중(비교 가능 FPR_2026의 약 45%: 쿠팡·네이버클라우드 — Phase 1 재계산으로 정정. 쿠팡·카카오는 44%) | 영역 집계 왜곡 | 집중도 표기(전략 인사이트 검증 필요사항), 상위 고객 제외 민감도 |
| R6 IA 대개편에 따른 회귀 | 기존 기능 손실 | 값 스냅샷 테스트, 기존 컴포넌트 재사용(이동 위주) |
| R7 번들 크기 증가(현 2.9MB) | 정적 HTML 로딩 | 차트 컴포넌트 공유, 데이터 중복 저장 금지(보간은 런타임 계산) |
| R8 Windows·사내 실데이터 미검증(기존) | 이관 리스크 | 기존 체크리스트 유지 |

---

## 10. 승인 요청 — 결정 필요 사항

| # | 결정 사항 | 선택지 | 권고 |
|---|---|---|---|
| **D1** | 경영진 목표 미입력 시 Target 표시 | (a) 현행 유지: FPR×50% 시나리오 목표를 값으로 표시·합산 / (b) **기본은 'INTERNAL INPUT REQUIRED', 시나리오 목표는 토글로만 표시하고 KPI·합계에서 제외** | **(b)** — ⑧ 정의(실제 Account Plan 목표)와 "추정 부분합을 확정 목표처럼 표시 금지" 준수. 계산 로직은 보존(표시·합계 규칙만 변경) |
| **D2** | RAW 영문 표기 | (a) **'Realistical Addressable Wallet'(판서자 원문)** / (b) 'Realistically …' 유지 | (a) — 마스터 기준 7.1. 필드·API 키 불변 |
| **D3** | 전략과제 후보 초안 | (a) **분석가가 근거 기반 후보 5~7개를 설정 파일로 초안 작성(status=분석 가설)** / (b) 엔진이 영역별 자동 1개씩 생성 | (a) — 자동 생성은 영역 나열에 그침. 모든 후보는 status 1~2로 시작 |
| **D4** | 우선순위 가중치 | (a) **기존 식을 v1 기준으로 보존 + 대안 세트 순위 범위 병기, 확정은 경영진** / (b) 새 가중치 확정 | (a) |
| **D5** | 첫 화면 | (a) **전략 인사이트(신규)** / (b) 고객별 사업기회(현행) | (a) — 단, 마지막 사용 탭 기억 기능 유지 |

**승인 시 Phase 1부터 착수하며, 각 Phase 종료 시 변경 내용·검증 결과·남은 문제·다음 단계 조건을 보고한다.**

---

## 11. 승인 결과 및 Phase 1 반영 (2026-10-16)
- **승인**: D1~D5 권고안 승인 + 보완조건 A(근거 수준 3분류·금액과 분리) · B(수요 신호 70건·경쟁 관찰 102건 연결 키 사전 설계, 모델 수요 vs 관측 신호 구분) · C(AI Infrastructure 가정 의존도 표시) · D(전략 점수와 근거 신뢰도 분리, 근거 불충분 시 확정 투자 권고 금지).
- **Phase 1 결과**: `docs/vnext/PHASE1_REPORT.md` (브랜치 `vnext-phase1`). 근거 수준·가정 의존도 정의와 데이터 구조는 같은 문서 §6.
- **§7 설계 갱신**: OpportunityPool의 `n_accounts_evidence`·`allocation_basis`는 Phase 1에서 `strategy[].evidence`(n_accounts_signal·fpr2031_by_tier·evidence_level·assumption_dependency)와 `accounts[].area_evidence`(tier·value_basis·observation_ids)로 구현됨. DemandSignal 매핑은 `config/demand_signal_map.json`.
