# WINDOWS MIGRATION CHECKLIST — 사내 클라우드 PC 이관 (STEP 6)

> data_version `20261016T051757Z` · 브랜치 `qa-final-audit` · 안전 체크포인트 태그 `v2.0-phase1-4-checkpoint` · 생성: `python3 -m models.qa.final_audit && python3 -m reports.final_qa_reports`
> 이 보고서의 모든 수치는 `data/qa/*.csv`에서 재계산 가능하다. 사내 데이터는 포함되지 않았다(contains_internal_data=False).

> ⚠ **이 환경(Linux)에서는 Windows 실행을 검증할 수 없었다.** 아래 '검증 완료'는 정적 점검·오프라인 의존성 해석·Linux 실행 결과이며, Windows 실행 항목은 이관 시 체크해야 한다.

## 1. 패키지 점검 결과 (`tools/make_release.py`)
| 항목 | 결과 |
|---|---|
| 패키지 | `dist_release/KeyAccountIntel_20261016T051757Z.zip` · 파일 289개 · 16.5MB · MANIFEST(SHA-256) 포함 |
| 사내 데이터 포함 여부 | 사내 데이터 0건 (internal_store·uploads 없음, management_inputs 값 0행, 번들 내 contains_internal_data=true 0건) |
| 비밀 파일(.env·키) | .env·키 파일 0건 (.env.example만 포함) |
| 필수 구성 | 17/17 포함 |
| 오프라인 wheel | 26개, pydantic_core cp311, cp312, cp313 win_amd64 |
| Windows 스크립트 | 3종 모두 CRLF + chcp 65001 |

### 검사 규칙(강화됨)
- 차단: `data/internal_store/`·`uploads/` 파일, management_inputs.csv 사내 값, 대시보드 번들 4종·`frontend/dist/*.js`의 `contains_internal_data:true`, `intel.db` management_inputs 사내 값, **허용 경로 밖 xlsx/xls/csv**.
- 제외: `.env`, `*.pem/*.key/*.p12/*.pfx`, node_modules, .venv, dist-single, dist_release.

## 2. 발견·수정 사항
| ID | 심각도 | 발견 사항 | 조치 | 상태 | 잔여 위험 |
|---|---|---|---|---|---|
| QA-P1 | HIGH | **패키저가 .env(비밀키) 파일을 포함할 수 있었음** — EXCLUDE_DIRS만 있고 파일 제외 규칙 없음 — 루트에 .env가 있으면 DART_API_KEY가 zip에 포함. | .env·*.pem·*.key·*.p12·*.pfx 제외 + 테스트. | **FIXED** | 없음. |
| QA-P2 | HIGH | **허용 폴더 밖 Excel(사내 원본 가능)·내장 대시보드의 사내 데이터 미검사** — internal_store·uploads·management_inputs.csv·data/processed/dashboard.json만 검사. 루트 등에 둔 사내 xlsx, Key_Account_Dashboard.html·frontend 번들·intel.db의 사내 값은 미검사. | 스프레드시트 허용 경로 화이트리스트, 번들 4종·dist JS·intel.db management_inputs 검사 추가 + 테스트. | **FIXED** | 파일 내용 기반 PII 스캔은 미구현. |
| QA-W1 | HIGH | **.bat 스크립트가 LF 줄바꿈·UTF-8(코드페이지 미지정)** — cmd.exe는 LF 전용 파일에서 레이블(goto) 탐색 오류 가능, 한글 cp949 콘솔에서 깨짐. import_excel.bat은 괄호 블록 내 %errorlevel% 즉시 확장 문제. | CRLF 변환, chcp 65001, PYTHONUTF8=1, python/py 런처 자동 감지, 버전 확인, wheels 오프라인 설치 자동 사용, goto 구조로 오류 코드 전달. | **FIXED** | 실제 Windows PC에서 실행 검증 전(이 환경은 Linux). |
| QA-W2 | MEDIUM | **의존성 일부 미고정·Windows 전용 의존성 누락** — python-multipart·requests 범위 지정, colorama(Windows에서 click·pytest 필요)는 pip download 시 호스트 마커 평가로 누락. | 테스트 통과 버전으로 전부 고정, colorama 명시, research 전용 requests 제외. Python 3.11/3.12/3.13 win_amd64 wheel 26개 확보 및 오프라인 의존성 해석(dry-run) 성공. | **FIXED** | 사내 백신·프록시·실행 정책(AppLocker)에 따른 차단 여부 미확인. |

## 3. 의존성
| 구분 | 내용 | 검증 |
|---|---|---|
| Python | 3.11 이상(3.11·3.12·3.13 wheel 확보) | Linux 3.13에서 전체 테스트 통과 |
| 런타임 | fastapi 0.115.4, starlette 0.41.3, pydantic 2.13.5, uvicorn 0.53.0, python-multipart 0.0.32, openpyxl 3.1.5, colorama 0.4.6 | `pip install --dry-run --no-index -f wheels --platform win_amd64` 해석 성공(3.11·3.13, 24개 패키지) |
| 테스트 | pytest 9.1.1, httpx 0.28.1 | 동일 |
| Node.js | **불필요** — `frontend/dist` 빌드 포함 | 패키지에 dist/index.html 포함 확인 |
| 데이터베이스 | SQLite 파일(`data/processed/intel.db`) — 별도 DB 서버 불필요 | 포함 확인 |
| 설정 | `config/*.json`(파라미터·보정), `.env.example`(DART 키는 선택) | 포함 확인 |
| 제외 | `research/collectors`(외부 수집, requests 필요) — 사내 PC에서 실행하지 않음 | — |

## 4. 이관 체크리스트
### A. 반입 전 (개발 환경)
- [x] `python3 -m pytest -q`(36), `npx vitest run`(6), E2E(16) 통과
- [x] `python3 tools/make_release.py` 성공(사내 데이터 감지 0건)
- [x] `wheels/`(win_amd64, cp311~cp313) 생성 후 패키지 포함
- [ ] 보안팀 반입 승인(zip SHA-256: MANIFEST.json과 함께 제출)

### B. 설치 (사내 Windows PC) — **미검증, 이관 시 수행**
- [ ] `python --version` 또는 `py -3 --version` ≥ 3.11
- [ ] 압축 해제 경로에 한글·공백이 없는 위치 권장(예: `C:\work\kai`) — 스크립트는 따옴표 처리했으나 미검증
- [ ] `setup_windows.bat` → `.venv` 생성, `wheels`에서 오프라인 설치, `models.build` 완료 메시지
- [ ] 콘솔 한글 정상 출력(chcp 65001 적용 확인)
- [ ] `run_dashboard.bat` → 3초 후 브라우저 `http://127.0.0.1:8000` 자동 열림, 포트 충돌 시 `run_dashboard.bat 8010`
- [ ] Windows Defender/백신이 `.venv\Scripts\*.exe`(uvicorn 등) 차단하지 않는지, AppLocker·스크립트 실행 정책 확인
- [ ] 방화벽: 127.0.0.1 바인딩만 사용(외부 노출 없음)

### C. 기능 확인
- [ ] 대시보드 탭 5종 표시, 계정 선택·차트 클릭→근거 패널 연동
- [ ] `python -m pytest -q` 사내 PC에서 재실행(36 통과 기대)
- [ ] 관리자 입력 → 템플릿 다운로드 → 1개 계정 업로드 → 미리보기 → 승인 → 재계산
- [ ] `import_excel.bat status|template|preview|approve` CLI 동작 및 오류 코드 반환
- [ ] 레거시 간이 입력 저장 버튼이 410 안내를 표시(기본 비활성)
- [ ] 사내 데이터 반영 후 헤더 '사내 데이터 포함' 표시, `python tools\make_release.py` 차단(exit 2)

### D. 보안·운영
- [ ] `data/internal_store/` 폴더 ACL(업로드·승인 담당자만)
- [ ] 사내 Git 사용 시 `.gitignore` 확인 + `data/internal_inputs/management_inputs.csv` 커밋 금지(pre-commit 훅 권장)
- [ ] 백업: `data/internal_store/`(이력 포함), `data/processed/`
- [ ] 사내 AI 도구와 연동하려면 데이터 처리·로깅·보관 정책 승인 선행

## 5. 남은 위험
- Windows 실제 실행, 사내 백신·프록시·실행 정책과의 충돌 여부 **미검증**.
- 압축 해제 경로의 한글·공백, OneDrive 동기화 폴더에서의 파일 잠금 미검증.
- `frontend/dist`는 개발 환경에서 빌드된 정적 파일 — 화면 수정 시 Node.js가 있는 PC에서 재빌드 필요.
