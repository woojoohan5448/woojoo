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
python3 -m pytest -q                         # 27 tests (모델·API·Excel import 샌드박스·릴리스 가드)
cd frontend && npx tsc --noEmit && npx vitest run && npm run build && npm run build:single
uvicorn backend.app:app --port 8000 ; node tests/e2e/dashboard.e2e.mjs   # E2E 14 checks
python3 tools/make_release.py                # 이관 패키지(사내 데이터 감지 시 차단)
```

## 조사 방법 (MCP 우선)
- `docs/RESEARCH_PROTOCOL.md` §6~7, `docs/MCP_SOURCE_REGISTRY.md`. 8개 PlayMCP 서버 정상(2026-10-16 진단, `docs/MCP_DIAGNOSTICS.md`).
- MyDART `download_document(rcept_no, find=[...])`로 비상장 감사보고서 IT 비용 항목 발췌 → L2 재구성. WebSearch는 턴당 200회 공유 한도.
- 세션 시작 시 PlayMCP 도구가 일부만 보이면 첫 호출 후 갱신될 수 있음 — 재진단 후 진행.

## 파일 지도
`config/` 가정·보정 · `models/` 엔진(spending·addressability·capture·forecasting·validation·internal·audit·priority·build) · `backend/` FastAPI · `frontend/` React · `data/phase1/` Phase 1 산출물 · `docs/` 문서 · `reports/` 보고서 · `tools/` 패키저 · `tests/`

## Git
작업 브랜치 `phase1-4-na-recovery` (main=v1.0, 태그 `v1.0-checkpoint`). 원격: github.com/woojoohan5448/woojoo — push는 사용자 요청 시에만.
