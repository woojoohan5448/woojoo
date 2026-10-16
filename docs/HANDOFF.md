# HANDOFF — 새 세션 인수인계

읽는 순서: `CLAUDE.md` → 이 문서 → `docs/PHASE_STATUS.md` → `docs/NEXT_ACTIONS.md`

## 1. 지금 어디까지 왔나
- v1.0(53개 계정 TS/RAW/FPR 모델·대시보드)은 `main`/태그 `v1.0-checkpoint`.
- 4-Phase 작업은 브랜치 `phase1-4-na-recovery`(로컬 커밋, **원격 push는 사용자 요청 시에만**).
- Phase 1·2 완료, Phase 3 구현(Windows 미검증), Phase 4 구현·합성 데이터 테스트만 완료. 상세는 PHASE_STATUS.md.
- 마지막 세션(2026-10-16): MCP 재진단 결과를 레지스트리에 반영 → 잔여 GAP 7개 계정 간접 근거 재조사 → KA45 복구 → 문서·재빌드·테스트.

## 2. 이미 끝난 조사 (반복 금지)
- 계정별 시도 수준: `data/raw/research_p1/<ID>.json`의 `recovery_levels_tried`, P2 보충은 `data/raw/research_p2/`.
- 근거 복구 이력: `data/phase1/EVIDENCE_RECOVERY_LOG.csv`, 모델 변경: `MODEL_CHANGE_LOG.csv`.
- 차단되어 못 한 조사: `docs/MCP_SOURCE_REGISTRY.md` §3 재시도 표.

## 3. 새 근거를 넣는 방법
1. 원천 파일은 수정하지 않는다. 새 사실/근거는 `data/raw/research_p2/<ID>.json`(facts·evidence·research_log·open_questions·recovery_levels_tried 형식, evidence_id `<ID>-P2-Exx`)로 추가 — build가 자동 병합.
2. 계정 모델 변경은 `config/account_overrides.json`(ts_anchor: value_eok·fiscal_year·status·grade·formula·inputs·evidence_ids·definition_note), L2 화이트리스트는 `config/model_parameters.json::component_model.accounts`.
3. `python3 -m models.build && python3 -m models.audit current && python3 -m models.validation.anomaly && python3 -m reports.phase1_reports && python3 -m reports.generate_reports && python3 -m models.export_xlsx`
4. 프런트: `cd frontend && npm run build && npm run build:single && cp dist-single/index.html ../Key_Account_Dashboard.html`
5. 테스트: `python3 -m pytest -q`, `npx vitest run`, 서버 기동 후 `node tests/e2e/dashboard.e2e.mjs`

## 3-1. 최종 QA 결과(이어서 할 일)
- `reports/final_qa/FINAL_DATA_QUALITY_AUDIT.md`부터 읽는다. OPEN 항목: QA-05(플랫폼 인건비 믹스), QA-06(비은행 포괄률), QA-07(상한값 기준), QA-10(계정별 성장 동인), QA-I5(Account Plan 미반영), QA-02(KISA 원문 대조).
- QA 재실행: `python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports` (수정 전 기준선: `data/qa/before/`).
- Windows wheel: `pip download -r requirements.txt -d wheels --platform win_amd64 --python-version 3.11 --only-binary=:all:` (3.12·3.13 반복) 후 make_release.

## 4. 주의
- WebSearch 턴당 200회 공유 한도, WebFetch·해외 공공 API는 프록시 차단.
- `pkill -f uvicorn` 금지(자기 셸 종료) → `pgrep -f "[u]vicorn backend"`로 PID 확인 후 kill.
- 사내 데이터 테스트는 반드시 `INTERNAL_STORE_DIR`·`KAI_DATA_OUT` 샌드박스.
- 필요한 키: `DART_API_KEY`(환경변수, 선택 — PlayMCP 경유 시 불필요). 사내 데이터는 Excel 업로드로만.

## 5. vNext (Strategic Intelligence Dashboard) — 진행 상태
- 마스터 기준: 사용자 [MASTER PROMPT] vNext(①~⑧ 판서자 프레임워크, Opportunity-to-Action). **Phase 0 승인(D1~D5+보완 A~D), Phase 1(UX/IA) 완료 — Phase 2 착수는 사용자 승인 대기.**
- 산출물: `docs/vnext/PHASE0_ASIS_TOBE.md` (AS-IS·①~⑧ 검증·엔진 진단·Gap·TO-BE IA·데이터 구조·Phase 계획·결정 D1~D5).
- 브랜치 `vnext-phase0`, 복구 태그 `v2.1-pre-vnext`(로컬; 태그 push는 프록시 403으로 불가).
- Phase 1: 브랜치 `vnext-phase1`(로컬 커밋, **push 금지 — 사용자 결정 대기**). 결과 `docs/vnext/PHASE1_REPORT.md`, 화면 캡처 `docs/screenshots/vnext/`.
  - 변경 파일: backend `models/build.py`(target_source·aggregate D1·opportunity_evidence), `models/validation/checks.py`(TARGET_SOW 검토 분류), `config/demand_signal_map.json`(신규); frontend `lib/glossary.ts`·`components/Term.tsx`·`components/Onboarding.tsx`·`views/OverviewView.tsx`(신규), `App.tsx`·`Header.tsx`·`lib/data.ts`·`lib/format.ts`·`types.ts`·`views/{Account,Strategy,Methodology,Portfolio,Quality}View.tsx`·`components/{Inspector,charts}`; tests `test_vnext_baseline.py`·`fixtures/vnext_baseline.json`·`core.test.ts`·`e2e/dashboard.e2e.mjs`.
  - 테스트: pytest 40 · vitest 9 · E2E 29(API) + 29(정적 HTML).
  - 재개: Phase 2(성장 궤적 차트) 착수 전 PHASE1_REPORT §9 검토사항 확인.
- Correction(2026-10-16): 브랜치 `vnext-correction`(push 금지 — 사용자 결정 대기). 결과 `docs/vnext/CORRECTION_REPORT.md`, 캡처 `docs/screenshots/vnext/correction/`.
  - Step A(커밋 48e6de5): 메뉴 AS-IS→TO-BE 재배치·목적 문구·결측 문구 한국어 단축·③ 도출 흐름·④ 옵션/의사결정.
  - Step B: 성장 궤적 차트(`lib/trajectory.ts`·`components/trajectoryChart.ts`), 고객 화면 A~F 재구성, 근거 패널 접이식, ECharts MarkArea·LabelLayout 등록.
  - 테스트: pytest 40 · vitest 13 · E2E 46(API)+46(정적) · 라벨 겹침 0/144.
  - 선행 재조사: OpenDART 직접 API는 프록시 403 → PlayMCP로 KA28 DC PFV 감사보고서 확보(값 생성 없음), KA41·KA50 공시 0건, KA42·KA43 국내 법인 없음.
