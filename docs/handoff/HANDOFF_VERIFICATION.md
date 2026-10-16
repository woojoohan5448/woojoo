# 인계 전 검증 결과 — KA_Dashboard_Phase3A_Handoff.zip

> 2026-10-16. 검증 대상: 기준선 태그 `v3.0-phase3a-final`(커밋 `1d87624`)로 만든 ZIP. 원시 결과는 `docs/handoff/verification/`에 있습니다.
> 최종 ZIP은 이 문서를 포함하기 위해 태그 `v3.0-phase3a-handoff`에서 다시 만들었습니다. 코드·데이터 파일의 sha256이 검증본과 같다는 것은 §5에서 확인합니다.

## 1. ZIP 구성 점검 (`tools/check_handoff.py`)
| 항목 | 결과 |
|---|---|
| 파일 수 / 크기 | 391개 / 25.6MB(검증본 기준) |
| 필수 파일 | **63/63**: 프런트 소스·dist, 엔진·API, Import·Reconciliation, 계약·문서, 정적 HTML, 테스트, 스크립트, 의존성, CLAUDE·HANDOFF·INTERNAL_* |
| 제외 대상 | node_modules · .venv · `__pycache__` · .pytest_cache · .git · dist_release · dist-single · *.pyc · *.zip · docs 밖 로그 → **0건** |
| 비밀정보 패턴(개인키·AWS·sk-·ghp_·DART crtfc_key·DART_API_KEY 값·password) | **0건**. `.env`는 없고 `.env.example`(빈 값)만 있음. 개발 중 받은 OpenDART 키는 저장소·패키지 어디에도 없음 |
| 사내 데이터 | internal_store·uploads 없음, management_inputs 값 0행, 번들 `contains_internal_data=true` 0건, recon 사내 레코드 0건 |
| 불필요한 원천자료 | `data/raw/dart/`(원문 다운로드) 제외. `data/raw/research*`(근거·출처, 1.5MB)는 필수 근거 레지스트리라 포함 |
| 데이터 버전 일치 | data/processed · frontend/src · frontend/public · frontend/dist · 정적 HTML 모두 `20261016T205848Z` |

## 2. 깨끗한 별도 디렉터리 재현 (Linux, Python 3.13.16, Node 22.22.0)
| 단계 | 결과 |
|---|---|
| 압축 해제 → `python -m venv` → `pip install -r requirements.txt` | 성공(fastapi 0.115.4, uvicorn 0.53.0, openpyxl 3.1.5, pydantic 2.13.5) |
| pytest(동봉 데이터) | **68 passed** |
| `python -m models.build` 재계산 → 동봉 값과 비교 | **TS/RAW/FPR/CR/Target 1,060개 값 차이 0**(53개사 × 2026 4개 + 2031 3 시나리오 × 5개 + Target) |
| 전략 점수 | 73.3 / 63.4 / 63.3 / 47.2 / 39.6 / 24.9 / 22.2 / 20.3 **동일** |
| 전략과제 | **8건 완전 동일**. 상태는 검증 필요·분석 가설, 승인 0 |
| 전사 집계 · 원장 | 동일. 출처 전환 0, 사내 레코드 0, contains_internal_data=false |
| 재계산 후 pytest | **68 passed** |
| `npm ci` → tsc → vitest | 246 패키지 설치, tsc 통과, **vitest 18 passed** |
| `npm run build` / `build:single` | 성공(정적 HTML 3.5MB) |
| API 실행(uvicorn :8002) | `/api/health` ok, 53개사 |
| E2E `dashboard.e2e.mjs` | API **46/46**, 동봉 정적 HTML **46/46**, 재빌드 정적 HTML **46/46** |
| E2E `phase3a.e2e.mjs`(6개사 × 1280/1440/1920 + ②③④) | API **316/316**, 정적 **316/316**, 라벨 겹침 0(차트 48) |
| `strategy_evidence_check.mjs` | **59/59** |
| Excel Import CLI(샌드박스 `INTERNAL_STORE_DIR`) | template · preview(빈 템플릿, 오류 0) · status 정상 |
| 계약 검증기(합성 데이터) | 25건, 오류 0, 경고 2(의도된 것) |

## 3. 개발 환경에서만 실행한 검증 (깨끗한 디렉터리에서는 재실행 안 함)
- 53개사 × 3 해상도 라벨 겹침 전수 검사(차트 288개, 0건)
- 합성 데이터 샌드박스 E2E(120/120)
- `screen_verify.mjs`(104/104)

→ `docs/vnext/phase3a/qa/`, `PHASE3A_REPORT.md` §3

## 4. 검증하지 못한 항목
1. **Windows 실행 전체**: `setup_windows.bat`, `run_dashboard.bat`, `import_excel.bat`, `wheels/` 오프라인 설치(win_amd64 wheel은 Linux에서 설치 시험 불가). wheel 구성(cp311·cp312·cp313)과 bat 파일 형식(CRLF, chcp 65001)만 정적으로 점검했습니다.
2. **Python 3.11·3.12, Node 20**: 3.13과 22에서만 실행했습니다.
3. **사내 네트워크 조건**: 사내 PyPI·npm 미러, 프록시, 백신·DLP.
4. **사내 Chrome·Edge로 실행하는 E2E**: Chromium headless만 사용했습니다.
5. **1280 미만 해상도·다크 모드·접근성(스크린리더)**.
6. **실제 사내 데이터 연동**: 금지 사항이라 하지 않았습니다. Phase 3B는 Blocker 해소 후 진행합니다.

## 5. 최종 ZIP과 검증본의 동일성
- 최종 ZIP(`v3.0-phase3a-handoff`)과 검증본(`v3.0-phase3a-final`)의 MANIFEST(sha256)는 최종 ZIP 생성 직후 비교했습니다. 결과는 종료 보고에 기록합니다(이 문서는 ZIP 안에 들어가므로 결과 파일을 ZIP 안에 다시 넣지 않습니다).
- 허용하는 차이는 이 문서와 `docs/handoff/verification/*`, `tools/make_handoff.py`(ZIP 권한 비트 설정), CLAUDE.md·docs/HANDOFF.md 기록 갱신, 빌드 정보 파일로 한정됩니다.
