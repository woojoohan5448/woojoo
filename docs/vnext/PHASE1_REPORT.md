# vNext Phase 1 결과 보고 — UX·정보구조 개선

> 2026-10-16 · 브랜치 `vnext-phase1`(기점 `vnext-phase0`, 복구 태그 `v2.1-pre-vnext` 보존) · **원격 push 안 함**
> 승인 근거: 사용자 Phase 0 승인(D1~D5 권고안 + 보완조건 A~D)

## 1. 변경된 메뉴·화면 구성
| 단계 | 메뉴(한국어 중심) | 원어 | 비고 |
|---|---|---|---|
| 1 | 전략 인사이트 | Strategic Overview | **신규 첫 화면**(D5) |
| 2 | 고객별 사업기회 | Account Opportunity | 기존 화면 유지 + D1 Target 규칙, 근거 패널 명칭 |
| 3 | 전사 기회 분석 | Opportunity Portfolio | 기존 Executive Portfolio |
| 4 | 전략과제 우선순위 | Strategic Priorities | 기존 Strategic Opportunity Engine + 근거 수준·가정 의존도(점수와 분리) |
| 5 | 데이터·운영 관리 → 데이터 신뢰도 / 분석 기준·산식 / 관리자 입력 · Excel Import | — | 기존 3개 탭을 하위 메뉴로 |
| 공통 | 수치 산출 근거 (Evidence & Calculation Inspector) | — | 기능 동일, 명칭 병기 |

내부 탭 ID·데이터 키·API 스키마는 변경하지 않았다. 첫 방문은 전략 인사이트, 재방문은 마지막 사용 화면을 기억한다.

## 2. 전략 인사이트 첫 화면
- **메시지**: 분석 대상 53개사 / 수치 산출 48개사(TS 비교 합산 42 · 정의 상이 5 · 계약 기반 RAW만 1) / 수치 없음 5 · "부분합 추정치이며 확정 목표 아님" · CR 0/53 · 승인 Target 0/53
- **KPI 6개**: 분석 대상/유효 분석 고객, 2026 TS(→2031), 2031 RAW, 2031 FPR(Low~High), 2031 Target Revenue(**INTERNAL INPUT REQUIRED**), 사업영역 근거 수준(충분 2·일부 4·부족 2)
- **경영진 5대 질문**: ①~⑤ 각각 현재 답할 수 있는 수준(④는 사내 데이터 필요, ⑤는 Phase 3에서 확정)
- **사업영역별 기회 집중도**: FPR 2026→2031, **근거 구성 막대(Evidence-based / Model-estimated / Unverified)**, 수요 고객 모델/관측 신호, 공급자 관찰, **근거 수준**, **가정 의존도**, 전략 점수(v1), 권고 성격(근거 충분이 아니면 "검토 가설")
- **검증 필요사항**: 사내 데이터, KISA 원문 대조, 가정 의존 영역(AI Infra 74%·Cloud 77%·Security 60%·AI Transformation/SI 71%), 집중도(쿠팡·네이버클라우드 45%), RESEARCH GAP 5개사(클릭 → 고객 화면), 정의 상이 5개사
- **전사 2026→2031 성장 표**(차트 재설계는 Phase 2), **산업별 주요 기회**, **역량 격차(분석가 가설·사내 검증 필요)**

## 3. 용어·Tooltip·온보딩
| 항목 | 구현 |
|---|---|
| 중앙 용어 사전 | `frontend/src/lib/glossary.ts` — ①~⑧ 10개 항목(번호·영문·약어·한국어·정의·목적·산식·주의·데이터 필드) + 보조 용어 7개(근거 수준·Evidence Tier·가정 의존도·전략 점수·수요 고객·추정 등급·부분합) |
| 판서자 용어 보존 | `② Realistical Addressable Wallet (RAW) (LGU+ 공략 가능 시장)` 등 원문 유지·한국어 병기(D2). `termLabel(code, 'full' \| 'kpi' \| 'short')`로 개념 화면/KPI/범례 표기 규칙 통일 |
| 단일 소스 | KPI·Tooltip·분석 기준·산식 ①~⑧ 표·Inspector 지표명(METRIC_LABEL)이 동일 사전 사용 |
| Tooltip | `TermTip` — Hover·Click(고정)·Keyboard Focus 지원, Esc로 닫기, `role=tooltip`·`aria-describedby`. 내용 순서: 원어+한국어 → 정의 → 목적 → 산식·기준 → 해석 주의 |
| 온보딩 | 첫 방문 3단계 안내(목적 / TS→RAW→FPR 관계 / 53개 분석→전략과제 흐름), Esc·←→ 키, 헤더 '가이드'로 재열람 |

## 4. 승인 결정 반영
| 결정 | 구현 |
|---|---|
| D1 Target | 계정별 `target_source`(MANAGEMENT_APPROVED / SCENARIO_FPR_ATTAINMENT) 추가. 공식 합계 `aggregate.TARGET` = 승인 목표만(없으면 null), 시나리오 합계는 `TARGET_scenario`로 분리. 화면 기본값 INTERNAL INPUT REQUIRED, 헤더 '시나리오 목표 보기'를 켤 때만 "시나리오 참고값"으로 표시(저장 안 함). 계산 로직 불변 |
| D2 RAW 표기 | 위 3항. 필드·API 불변 |
| D3 전략과제 후보 | Phase 3 대상 — 이번에는 데이터 연결 키만 설계·생성(§6) |
| D4 가중치 | 기존 점수 그대로 표시 + "v1 기준 점수 · 가중치 확정은 경영진 의사결정" 명시, 근거 수준·가정 의존도를 별도 열로 표시(민감도 순위 범위는 Phase 3) |
| D5 첫 화면 | 전략 인사이트 |
| 보완 A | 금액(value_basis)과 근거 상태(evidence tier)를 별도 필드로 분리(§6) |
| 보완 B | 수요 신호·경쟁 관찰 → 계정×사업영역 관측 ID로 연결, 모델 수요 고객 수 vs 관측 신호 고객 수 분리 표시. 신호 없음 ≠ 기회 0 |
| 보완 C | 사업영역별 가정 의존도(성장분 중 B-ALLOC 배분 비중) 표시, 50% 초과 시 경고색·검증 필요사항 노출 |
| 보완 D | 전략 점수와 근거 수준을 다른 열·다른 용어로 표시. 근거 충분이 아니면 권고를 "검토 가설"로 표기 |

## 5. 보존된 기능 (회귀 확인)
고객 검색·필터·정렬, 2026 vs 2031 비교 차트(막대 클릭→Inspector), Low/Base/High·Base/Strategic Expansion 전환, 표 보기·로그 축, C-SOW·PCR·Upside·Target SOW 타일, 카테고리·브리지 차트, 근거 유형 배지, FPR 2031 증가 분해, Reconciliation 패널, Research Gap 표시, Executive Portfolio 차트·중복 위험, Strategic Opportunity 차트·영역 카드, Data Quality, Methodology 파라미터·벤치마크, Excel 템플릿·업로드·미리보기·승인, 레거시 입력 차단, API 모드/정적 HTML 모드 자동 판별, 다크 모드.

## 6. 데이터 모델 추가 (가산형, 기존 값 불변)
```
accounts[].area_evidence[<사업영역>] = {
  tier: EVIDENCE_BASED | MODEL_ESTIMATED | UNVERIFIED,          # 근거 상태 (우선 적용 규칙: 위에서부터 첫 일치)
  value_basis: ACCOUNT_SPECIFIC_SHARE | MODEL_ALLOCATED,        # 금액 비중 산정 방식 (근거 상태와 별개)
  evidence_types: [DEMAND_SIGNAL, ACCOUNT_SPECIFIC_SHARE, INCUMBENT_OBSERVED],
  observation_ids: { DEMAND_SIGNAL: [driver_id...], INCUMBENT_OBSERVED: ["KAxx-Cnn"...], ACCOUNT_SPECIFIC_SHARE: [...] },
  FPR_2031 }
strategy[].evidence = { n_accounts_model, n_accounts_signal, n_accounts_incumbent_obs, n_accounts_specific_share,
  fpr2031_by_tier, accounts_by_tier, evidence_share, evidence_level(SUFFICIENT/PARTIAL/INSUFFICIENT),
  signals[{account_id, signal_id, type, description, period, evidence_ids}], assumption_dependency, recommendation_mode }
m.target.{TARGET,TARGET_SOW,TARGET_INCREMENT}.target_source
portfolio.aggregate.<key>.{TARGET(approved only|null), TARGET_scenario, n_target_approved, n_target_scenario}
```
- **근거 상태 규칙**: ① 해당 영역 관측 1건 이상(수요 신호 = research driver, 고객별 비중 = KISA 보안 비율·계약 카테고리·계정 인프라 동인, 기존 공급자 관찰 = competitive) → Evidence-based ② 관측 없음 + 고객 TS가 자체 근거(공시·재무 재구성) → Model-estimated ③ 그 외 → Unverified. **Evidence-based도 금액은 모델 추정치**.
- **매핑 설정**: `config/demand_signal_map.json` (DC_BUILD→DC_COLO·AI_INFRA, AI_INVESTMENT→AI_INFRA, REGULATORY_SECURITY→SECURITY, CLOUD_MIGRATION→CLOUD, NEXT_GEN_CORE→SI_BUILD·IT_OPS, OVERSEAS_EXPANSION→CONNECTIVITY). OTHER 등 방향 불명 유형은 미매핑.
- **Phase 3 연결 키**: `signal_id(=driver_id)`·`account_id`·`area`·`observation_ids` → StrategicInitiative.why/evidence에 그대로 참조.
- 참고: Phase 0 표의 수요 신호 보유 고객 수(AI 15 등)는 정의 상이 계정 포함 전수 기준, Phase 1 엔진 값(AI 9 등)은 **비교 가능 계정·FPR>0 기준**이다.

## 7. 회귀 테스트 결과
| 검증 | 결과 |
|---|---|
| 기준선 고정 | `tests/fixtures/vnext_baseline.json`(Phase 1 착수 전, 53개 × 2026·2031 전 레코드 값·범위·상태·등급·신뢰도·산식, 포트폴리오 합계, 전략 엔진 결과) |
| 기존 KPI 의도치 않은 변경 | **0건** (`tests/test_vnext_baseline.py`) |
| 의도된 변경(승인) | ① `aggregate.TARGET` 8,084억(시나리오 합) → null(승인 0건), 동일 값은 `TARGET_scenario`로 보존 [D1] ② 화면 Target 기본 표시 INTERNAL INPUT REQUIRED [D1] ③ 검증 규칙 TARGET_SOW_NOT_ABOVE: WARN → INFO "목표 적정성 검토"(현재 발생 0건, ⑧ 정의) ④ RAW 영문 표기 Realistical [D2] ⑤ 화면·차트 라벨 한국어 병기 ⑥ CSV 내보내기에 `TARGET_2031_source` 열 추가 |
| TS/RAW/FPR/CR 산식 | 불변(기준선 산식 문자열 일치) |
| pytest | **40 통과**(기존 36 + 기준선 4) |
| vitest | **9 통과**(기존 6, D1 기대값 갱신 + 용어·D1·근거 분리 3) |
| E2E (API 모드) | **29 통과**(기존 16 경로 + 신규 13: 온보딩·첫 화면·D1 KPI·유효 고객 구분·근거 표·Tooltip 키보드·D1 토글·5단계 메뉴·하위 메뉴·①~⑧ 표·관리자 입력 보존) |
| E2E (정적 HTML `Key_Account_Dashboard.html`) | **29 통과** |
| 페이지 오류 | 0 |
| 화면 확인 | 라이트·다크·모바일(390px) 캡처 `docs/screenshots/vnext/` |

## 8. 추가 확인이 필요한 데이터·UX 사항
1. **근거 수준 임계값**(충분: Evidence-based 비중 ≥50% 그리고 근거 고객 ≥5, 일부 ≥25%)은 Phase 1 표시 규칙 — 경영진·PM 합의 필요(`config/demand_signal_map.json`에서 조정).
2. **기존 공급자 관찰을 근거로 볼지**: 현재 '지출이 관측됨'으로 Evidence-based에 포함(Connectivity 18개사, SI/Managed 16개사). 수요 신호(신규 투자 의사)와 성격이 다르므로 분리 기준 유지 여부 확인 필요.
3. **수요 신호 'OTHER' 19건**과 EFFICIENCY·RESTRUCTURING 미매핑 — 분석가 분류 필요.
4. **가정 의존도 음수**(SI/Managed·기타: 효율화·대체로 감소) 표기는 "감소 가정"으로 처리 — 표현 적정성 확인.
5. 헤더 KPI 줄과 첫 화면 KPI의 역할 분리: 첫 화면에서는 헤더 KPI를 숨기고 다른 화면에서는 유지.
6. 모바일(390px)에서 표는 가로 스크롤 — PC 중심 원칙에 따라 유지.

## 9. Phase 2 착수 전 검토사항
- 성장 궤적 차트 중간연도 보간 방식: TS·RAW·FPR 각각 2026→2031 **CAGR 기하 보간**(Illustrative) 승인 여부.
- 전사 궤적의 집계 범위: 비교 합산(정의 상이 제외) 고정, 커버리지 n/53 상시 표기.
- CR(2026 점)·Target(2031 승인 목표 마커) 분리 표시와 시나리오 목표 토글 연동 방식 확인.
- 기존 2시점 가로 막대 차트는 유지(탭/토글 병행) — 제거 여부 결정.
- 비율 패널(RAW 대비 FPR·CR·Target) 구성 확인.
