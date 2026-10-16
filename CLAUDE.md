# CLAUDE.md — LG U+ Enterprise 53 Key Account Intelligence Platform

새 세션은 **이 파일 → docs/HANDOFF.md → docs/NEXT_ACTIONS.md** 순으로 읽고 이어서 작업한다.

## 프로젝트 한 줄
53개 Key Account의 FY2026·FY2031 **TS → RAW → FPR → CR/Target**을 검증 가능한 근거와 재현 가능한 모델로 산출하고, 사내 매출·영업 추정 Excel을 승인 절차로 통합하는 대시보드/데이터 플랫폼 (4-Phase).

## 절대 규칙
1. **숫자를 만들지 않는다.** 근거 없는 값은 `INSUFFICIENT_EVIDENCE`(RESEARCH GAP)로 둔다. 0으로 채우지 않는다.
2. 추정값은 반드시 등급(ESTIMATED_HIGH/MEDIUM/LOW)·산식·근거 ID와 함께 표시한다. 추정을 VERIFIED로 표시하지 않는다.
3. 원천 조사 파일(`data/raw/research/*.json`, `data/raw/research_p1/*.json`)은 **수정 금지** — 정정은 `config/research_corrections.json`(사실)·`config/account_overrides.json`(계정 모델)·`config/model_parameters.json`(파라미터)로만, 변경 전후는 `data/phase1/MODEL_CHANGE_LOG.csv`에 남는다.
4. 불변식: 0 ≤ FPR ≤ RAW ≤ TS, Target ≤ FPR_2031, CR 미입력=NULL. 위반 시 값을 바꾸지 말고 data_quality_issues로 기록.
5. **사내 데이터**(CR·영업 추정·목표·계약)는 외부 MCP·외부 LLM·Git으로 보내지 않는다. 사내 저장소 `data/internal_store/`, 업로드 Excel은 .gitignore. 테스트는 `INTERNAL_STORE_DIR`·`KAI_DATA_OUT` 샌드박스로만.
6. 상품별 LG U+ 매출 배분·통신 3사 점유율은 이번 범위 밖(확장 포인트만).

## 핵심 명령
```bash
python3 -m models.build                      # 전체 재계산 (raw+p1 보충+config+사내 승인 레이어 → data/processed, frontend/src/data)
python3 -m models.audit current              # N/A 분류·커버리지 (data/phase1/NA_CURRENT_AUDIT.csv, current_coverage.json)
python3 -m models.validation.anomaly         # 오류 재검증 규칙 R01~R10 (DATA_CONFLICTS.csv, CORRECTIONS.json, MODEL_CHANGE_LOG.csv)
python3 -m reports.phase1_reports            # Phase 1 게이트 보고서
python3 -m reports.generate_reports          # 엔터티·품질·갭·전략 보고서
python3 -m models.export_xlsx                # Excel 내보내기
python3 -m models.internal.excel_io template|preview <xlsx>|approve <batch> --approver 이름|status
python3 -m pytest -q                         # 68 tests (vNext 기준선 4 + Phase 3A 계약 18·원장 6·전략과제 4 포함) (모델·API·Excel import·QA 결합 재검증 샌드박스·릴리스 가드)
cd frontend && npx tsc --noEmit && npx vitest run && npm run build && npm run build:single
uvicorn backend.app:app --port 8000 ; node tests/e2e/dashboard.e2e.mjs   # E2E 46 checks; 라벨 겹침: node tests/e2e/trajectory_overlap.mjs (API·정적 HTML 둘 다: node tests/e2e/dashboard.e2e.mjs file:///…/Key_Account_Dashboard.html)
python3 tools/make_release.py && python3 tools/check_release.py   # 이관 패키지(사내 데이터·비밀·허용경로 밖 Excel 차단) + 내용 검사
python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports   # 최종 QA 감사 → reports/final_qa/*.md
```

## 조사 방법 (MCP 우선)
- `docs/RESEARCH_PROTOCOL.md` §6~7, `docs/MCP_SOURCE_REGISTRY.md`. 8개 PlayMCP 서버 정상(2026-10-16 진단, `docs/MCP_DIAGNOSTICS.md`).
- MyDART `download_document(rcept_no, find=[...])`로 비상장 감사보고서 IT 비용 항목 발췌 → L2 재구성. WebSearch는 턴당 200회 공유 한도.
- 세션 시작 시 PlayMCP 도구가 일부만 보이면 첫 호출 후 갱신될 수 있음 — 재진단 후 진행.

## 파일 지도
`config/` 가정·보정 · `models/` 엔진(spending·addressability·capture·forecasting·validation·internal·audit·priority·build) · `backend/` FastAPI · `frontend/` React · `data/phase1/` Phase 1 산출물 · `docs/` 문서 · `reports/` 보고서 · `tools/` 패키저 · `tests/`

## vNext
- Phase 0 설계: `docs/vnext/PHASE0_ASIS_TOBE.md` (D1~D5 승인). Phase 1: `docs/vnext/PHASE1_REPORT.md`. **Correction(메뉴 AS-IS→TO-BE·판서형 성장 궤적) 완료**: `docs/vnext/CORRECTION_REPORT.md`, 브랜치 `vnext-correction`(push 안 함). 다음 작업은 사용자 승인 후.
- 메뉴: ① 고객별 사업기회(첫 화면) ② 전사 기회 분석 [AS-IS] → ③ 전략과제 도출 ④ 전략적 시사점 [TO-BE] → ⑤ 데이터·운영 관리. 핵심 차트 = 2026–2031 Opportunity Growth Trajectory(`lib/trajectory.ts`, `components/trajectoryChart.ts`): 끝값 = 엔진 값, 중간연도 = CAGR 보간(Illustrative), CR·Target 비연결, 이중축·누적 금지.
- 데이터 키·API 키는 표기 변경으로 바꾸지 않는다. 핵심 용어는 `frontend/src/lib/glossary.ts`(①~⑧ 판서자 원문, "Realistical" 유지)만 사용.
- D1: 공식 Target = 경영진 승인(`target_source=MANAGEMENT_APPROVED`)만. 시나리오 목표는 토글 시 참고값, KPI·합계 제외.
- 사업기회 근거 상태(`area_evidence.tier`)와 금액 산정 방식(`value_basis`)은 별개 필드. 전략 점수와 근거 수준을 섞지 않는다.
- 회귀 가드: `tests/test_vnext_baseline.py`(Phase 1 착수 전 53개 수치 고정, 의도 변경은 화이트리스트).
- **Phase 3A 준비(2026-10-16, 브랜치 `vnext-phase3a-prep`, push 안 함) — 판정 '조건부 가능', 사용자 승인 대기.** 문서 `docs/vnext/phase3a/`(SCREEN_VERIFICATION·DATA_CONTRACT·PHASE3A_READINESS). 성장 궤적은 경로 전체 점선 + 원천 기반 끝점만 채운 마커.
- 사내–외부 대사 계약: `contracts/phase3a_data_contract.v0.json`(초안) + `tools/contract_validate.py`(읽기 전용, 엔진·Import 미변경). 사내 SAM/RAW는 비교 전용, 공식 슬롯(CR·Target·매출 계획)은 APPROVED만, 정의 미확정이면 판정 보류, Target Case 자동 승격 금지, 원본값 정확 보존. 합성 데이터만: `python3 -m tests.phase3a_synthetic`.
- 화면 검증: `node tests/e2e/screen_verify.mjs [url] [outDir] [tag]`, 전략 근거 표시: `node tests/e2e/strategy_evidence_check.mjs`. 사내 연동 전 Blocker B1·B2·B3·B4·B6·B8(PHASE3A_READINESS §2).

## Git
작업 브랜치 `phase1-4-na-recovery` (main=v1.0, 태그 `v1.0-checkpoint`). 원격: github.com/woojoohan5448/woojoo — push는 사용자 요청 시에만.

## 최종 QA (2026-10-16)
- 브랜치 `qa-final-audit`, 안전 체크포인트 태그 `v2.0-phase1-4-checkpoint`. 결과·잔여 위험: `reports/final_qa/` 5종, 발견 목록 `data/qa/QA_FINDINGS.json`.
- "VERIFIED"는 원천 재무 사실에만 쓴다. 계정의 TS 근거 유형은 `evidence_basis`(IT지출 공시값/재무항목 재구성/산업 평균/시나리오). IT 지출을 1차 원문에서 확인한 계정은 현재 0개.

## Phase 3A (2026-10-16, 브랜치 `vnext-phase3a`, push 안 함 — 완료, 사용자 승인 대기)
- 보고서 `docs/vnext/phase3a/PHASE3A_REPORT.md`. 보존 태그 `v2.2-pre-phase3a`.
- 원장·공식 출처: `models/recon/ledger.py` + `config/official_source_policy.json`. 외부 모델 = 기본 출처(영구 공식값 아님). 전환은 레코드 APPROVED + 정의 DIRECT + 출처 선택 승인(직무 분리)일 때만, 자동 전환 금지. 원천 `INTERNAL_STORE_DIR/recon/records.json` 불변, 선택은 `selections.json` 별도.
- 전략: `models/strategy_actions.py` — Market / Demand / Capture 3관점(기존 공급자 관찰·KISA 비율·감소 신호는 수요 아님), 과제 상태 분석 가설 / 검증 필요 / 추진 검토 후보, approval 항상 PROPOSED, 우선순위 점수 불변(민감도만 추가).
- ② 통합 궤적 `frontend/src/lib/portfolioTrajectory.ts`(동일 고객 집합, n/53, 0 대체 금지), FPR 확대 보조 차트(별도 축), ① 대사 패널 `components/ReconPanel.tsx`.
- 테스트: `node tests/e2e/phase3a.e2e.mjs [url] [out.json]`(6개사 × 1280/1440/1920), 합성 샌드박스 `python3 tools/phase3a_synthetic_sandbox.py <dir>` → `INTERNAL_STORE_DIR=<dir> KAI_DATA_OUT=<out> KAI_RECON_MODE=test` build + uvicorn :8001 + `SYNTH=1`.
- 다음: 사내 Excel Import·Phase 3B는 Blocker B1·B2·B3·B4·B6·B8 해소 후 별도 승인.

## 최종 인계 (2026-10-16) — 외부 개발 종료
- 기준선 태그 `v3.0-phase3a-final`(코드 기준선, 커밋 1d87624) · 인계 태그 `v3.0-phase3a-handoff`(검증 문서 포함)(브랜치 `vnext-phase3a`). 이후 사내 개발 환경에서 이어서 진행.
- 인계 패키지 `KA_Dashboard_Phase3A_Handoff.zip` = `python3 tools/make_handoff.py` → `python3 tools/check_handoff.py`.
- 사내 재현 `INTERNAL_SETUP.md`, 통합 작업 인계 `INTERNAL_INTEGRATION_HANDOFF.md`, 인계 검증 결과 `docs/handoff/HANDOFF_VERIFICATION.md`.
