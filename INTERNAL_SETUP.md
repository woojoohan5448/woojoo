# INTERNAL_SETUP — 사내 개발 환경 재현 가이드

> 대상: LG U+ Enterprise 53 Key Account Intelligence Platform · **Phase 3A 최종 기준선**(태그 `v3.0-phase3a-final`)
> 패키지: `KA_Dashboard_Phase3A_Handoff.zip`. 빌드 정보는 압축 루트의 `HANDOFF_BUILD_INFO.json`(브랜치·커밋·태그)과 `MANIFEST.json`(파일별 sha256)에 있습니다.
>
> 이 패키지에는 **외부 공개 데이터만** 들어 있습니다. 사내 원천 데이터(CR·영업 추정·목표·계약)와 비밀값(API 키 등)은 들어 있지 않습니다.

## 1. 프로젝트 폴더 구조
```
.
├─ CLAUDE.md · README.md · INTERNAL_SETUP.md · INTERNAL_INTEGRATION_HANDOFF.md · HANDOFF_BUILD_INFO.json · MANIFEST.json
├─ requirements.txt · .env.example · .gitignore
├─ setup_windows.bat · run_dashboard.bat · import_excel.bat      # Windows 실행 스크립트(CRLF, chcp 65001)
├─ Key_Account_Dashboard.html                                    # 최종 정적 HTML(단일 파일, 서버 없이 열람)
├─ backend/app.py                                                # FastAPI(데이터 API + frontend/dist 서빙)
├─ models/                                                       # Python 계산 엔진(Decimal)
│   ├─ build.py                 전체 재계산 진입점 → data/processed, frontend 데이터
│   ├─ common.py                경로·샌드박스(KAI_DATA_OUT)·공통 함수
│   ├─ spending/ts.py           ① TS 앵커 선택·2026 환산
│   ├─ addressability/raw.py    ② RAW = Σ TS_cat × Addressability
│   ├─ capture/fpr.py           ③ FPR = Σ RAW_cat × Capture ceiling
│   ├─ forecasting/bridge.py    2026→2031 브리지(자연 성장 + 증분 배분 + 계정별 인프라 동인)
│   ├─ validation/              불변식·이상 탐지(R01~R10)
│   ├─ internal/excel_io.py     사내 Excel Import(템플릿·preview·approve·status)
│   ├─ recon/contract.py        Phase 3A 데이터 계약 검증기
│   ├─ recon/ledger.py          Phase 3A 지표 원장·공식 출처 선택
│   ├─ strategy_actions.py      Phase 3A Opportunity-to-Action(3관점·과제·민감도)
│   ├─ audit.py · priority.py · export_xlsx.py · qa/final_audit.py
├─ config/                      가정·보정·정책(JSON). 원천 조사 정정은 여기서만
├─ contracts/phase3a_data_contract.v0.json   데이터 계약(초안 v0.1)
├─ data/
│   ├─ raw/research*/           외부 조사 원천(근거·출처). 수정 금지
│   ├─ processed/               엔진 산출(dashboard.json, intel.db, metric_history.csv)
│   ├─ exports/ · phase1/ · qa/ 내보내기·Phase 1 산출·QA 결과
│   └─ internal_inputs/templates/ + management_inputs.csv(빈 값)   # 사내 Excel 템플릿
├─ frontend/                    React 18 + TS + Vite + ECharts 5 + Tailwind (src/, public/, dist/ 빌드 포함)
├─ tests/                       pytest + e2e(playwright-core)
├─ tools/                       패키저·점검·합성 샌드박스
├─ reports/ · research/ · docs/ 보고서·조사 수집기·문서(docs/vnext/phase3a/ = Phase 3A 보고·검증 결과)
└─ wheels/                      Windows 오프라인 설치용 wheel(win_amd64, cp311·cp312·cp313)
```

## 2. 필요 버전
| 구성 | 버전 | 비고 |
|---|---|---|
| Python | **3.11 ~ 3.13**(검증: 3.13.16, Linux) | `wheels/`의 pydantic_core는 cp311·cp312·cp313 win_amd64만 포함 |
| Node.js | **20 LTS 이상**(검증: 22.22.0), npm 10 | 프런트엔드를 **다시 빌드할 때만** 필요. 대시보드 실행에는 불필요(`frontend/dist`·정적 HTML 포함) |
| 브라우저 | Edge·Chrome 최신 | 정적 HTML·대시보드 열람 |
| E2E(선택) | Chromium + `playwright-core`(devDependency) | 사내에 브라우저 바이너리가 없으면 `CHROMIUM` 환경변수로 경로 지정 |

Python 의존성은 `requirements.txt`에 고정돼 있습니다: fastapi 0.115.4, starlette 0.41.3, pydantic 2.13.5, uvicorn 0.53.0, python-multipart 0.0.32, openpyxl 3.1.5, colorama 0.4.6, pytest 9.1.1, httpx 0.28.1.
Node 의존성은 `frontend/package.json`과 `package-lock.json`에 고정돼 있습니다.

## 3. 의존성 설치
**Windows(권장 — 스크립트)**
```bat
setup_windows.bat
```
- 사용자 venv(`.venv`)를 만듭니다.
- `wheels\`가 있으면 오프라인으로, 없으면 사내 PyPI 미러에서 설치합니다.
- 설치 후 `python -m models.build`까지 실행합니다.

**수동(Windows/Linux 공통)**
```bash
python -m venv .venv
.venv\Scripts\activate            # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt   # 오프라인(Windows): pip install --no-index -f wheels -r requirements.txt
cd frontend && npm ci             # 프런트 재빌드가 필요할 때만 (사내 npm 레지스트리/프록시 설정 필요)
```

## 4. 백엔드 실행
```bash
python -m models.build                                      # 모델 재계산 → data/processed/*, frontend/src/data, frontend/public/data
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```
- Windows에서는 `run_dashboard.bat [포트]`로 실행하면 브라우저가 자동으로 열립니다.
- 주요 API: `/api/health`, `/api/dashboard`, `/api/accounts`, `/api/evidence/{id}`, `/api/import/*`, `/api/export/xlsx|csv`
- `frontend/dist`가 있으면 `/`에서 대시보드를 서빙합니다.
- 외부 네트워크 호출은 없습니다(DART 수집기는 개발용이며 기본 경로에서 실행되지 않음).

## 5. 프런트엔드 실행·빌드
```bash
cd frontend
npm run dev        # 개발 서버 http://localhost:5173 (백엔드 8000이 있으면 API 모드, 없으면 번들 데이터)
npm run build      # tsc 검사 + frontend/dist (FastAPI가 서빙)
npm test           # vitest (= npx vitest run)
```
- 화면 데이터는 `models.build`가 `frontend/src/data/dashboard.json`과 `frontend/public/data/dashboard.json`에 기록합니다.
- 모델을 재계산한 뒤 프런트를 다시 빌드해야 정적 산출물에 반영됩니다.

## 6. 정적 HTML 생성
```bash
cd frontend && npm run build:single && cp dist-single/index.html ../Key_Account_Dashboard.html
# Windows: copy /Y dist-single\index.html ..\Key_Account_Dashboard.html
```
- 결과는 단일 파일 HTML이며, 서버 없이 더블클릭으로 열 수 있습니다(정적 모드, 번들 데이터 사용).
- **사내 데이터가 반영된 상태로 만든 HTML은 외부로 반출하면 안 됩니다.** `meta.contains_internal_data=true`이면 `tools/make_release.py`가 패키징을 차단합니다.

## 7. Excel Import 실행 경로
| 방법 | 명령 |
|---|---|
| 웹 | 대시보드 ⑤ 데이터·운영 관리 → 관리자 입력·Excel Import(템플릿 다운로드 → 미리보기 → 승인) |
| CLI | `python -m models.internal.excel_io template` → `preview <xlsx>` → `approve <batch_id> --approver 이름` → `status`, 이후 `python -m models.build` |
| Windows | `import_excel.bat template / preview 파일.xlsx / approve 배치ID 승인자 / status` |

- 템플릿 위치는 `data/internal_inputs/templates/KeyAccount_Internal_Input_Template.xlsx`입니다. 시트는 INTERNAL_ACTUAL, SALES_ESTIMATE, MANAGEMENT_TARGET, ACCOUNT_PLAN이며 세부는 `docs/INTERNAL_EXCEL_SPEC.md`에 있습니다.
- 승인 레이어 저장 위치는 `data/internal_store/`(기본) 또는 `INTERNAL_STORE_DIR`입니다. **Git·외부 전송 금지**이며 `.gitignore`에 등록돼 있습니다.
- Phase 3A 대사 저장소는 `INTERNAL_STORE_DIR/recon/records.json`과 `selections.json`입니다.
  - 현재 이 파일들을 만드는 Excel Import는 **없습니다**(Phase 3B 구현 대상).
  - 합성 데이터 시험은 반드시 별도 샌드박스에서 합니다(8장).

## 8. 테스트 실행
```bash
python -m pytest -q                                   # 68 tests(엔진 기준선·Import·QA·계약·원장·전략과제)
cd frontend && npx tsc --noEmit && npx vitest run     # 18 tests(끝값=엔진 954건, ② 집계, 원장)
# E2E(백엔드 8000 기동 후, Chromium 필요)
node tests/e2e/dashboard.e2e.mjs                      # 46항목(정적: node tests/e2e/dashboard.e2e.mjs file:///<절대경로>/Key_Account_Dashboard.html)
node tests/e2e/phase3a.e2e.mjs [url] [out.json]       # 6개사 × 1280/1440/1920, ②③④ (316항목)
node tests/e2e/strategy_evidence_check.mjs [url]      # ③④ 근거 3관점·자동 승인 0 (59항목)
node tests/e2e/screen_verify.mjs [url] [outDir] [tag] # 6개사 끝값·툴팁·근거 패널
node tests/e2e/trajectory_overlap.mjs [url]           # 53개사 × 3 해상도 라벨 겹침
# 합성 데이터 샌드박스(사내 저장소와 분리)
python tools/phase3a_synthetic_sandbox.py <sandbox_store>
set INTERNAL_STORE_DIR=<sandbox_store> & set KAI_DATA_OUT=<sandbox_out> & set KAI_RECON_MODE=test & python -m models.build
python -m uvicorn backend.app:app --port 8001         # 같은 환경변수로 실행 → SYNTH=1 node tests/e2e/phase3a.e2e.mjs http://127.0.0.1:8001/
# 이관 패키지 점검
python tools/make_release.py && python tools/check_release.py
```
pytest와 e2e의 사내 데이터 시나리오는 모두 `INTERNAL_STORE_DIR`와 `KAI_DATA_OUT` 샌드박스에서만 실행됩니다.

## 9. 환경변수(실제 비밀값 없음)
| 변수 | 기본값 | 용도 |
|---|---|---|
| `INTERNAL_STORE_DIR` | `data/internal_store` | 사내 승인 레이어·대사 저장소 위치(사내 보안 위치로 지정 권장) |
| `KAI_DATA_OUT` | (없음 = 운영 출력) | 지정하면 산출물을 샌드박스로 분리(테스트·시험 계산용). 프런트 번들은 갱신하지 않음 |
| `KAI_RECON_MODE` | `production` | `test`는 합성 레코드만 허용, `production`은 합성 레코드 차단 |
| `KAI_ENABLE_LEGACY_INPUT` | (비활성) | 레거시 CSV 직접 입력 API 허용(권장하지 않음, 기본 차단) |
| `PORT` | 8000 | `run_dashboard.bat` 포트 |
| `DART_API_KEY` | (빈 값) | 개발용 외부 DART 수집기 전용. **사내 실행에는 불필요.** 값은 `.env`에만 두고 패키지·Git에 넣지 않음 |
| `PYTHONUTF8` / `PYTHONIOENCODING` | 1 / utf-8 | Windows 한글 처리(bat에서 설정) |
| `CHROMIUM` | `/opt/pw-browsers/...` | E2E 브라우저 경로(사내 PC에서는 Chrome/Edge 실행 파일 경로 지정 가능) |
| `SYNTH`, `WIDTHS`, `ACCS` | — | `phase3a.e2e.mjs` 옵션(합성 샌드박스, 해상도·고객 목록) |

## 10. Windows 사내 PC 점검 사항
1. **Python 3.11~3.13 64bit**를 씁니다. 3.14 이상은 `wheels`에 맞는 pydantic_core가 없어 온라인 설치나 사내 미러가 필요합니다.
2. **경로**: 한글·공백이 없는 짧은 경로(예: `C:\KAI\`)를 권장합니다. OneDrive 동기화 폴더는 피하십시오(.venv와 SQLite 잠금 문제).
3. **인코딩**: bat 파일은 `chcp 65001`과 `PYTHONUTF8=1`을 씁니다. PowerShell에서 직접 실행할 때도 같은 환경변수를 설정하십시오.
4. **포트·방화벽**: 127.0.0.1:8000만 사용하며, 외부 바인딩(0.0.0.0)은 쓰지 않습니다.
5. **백신·DLP**: `.venv`와 `wheels` 설치가 차단되면 보안 담당자에게 예외를 요청하십시오. 사내 Excel 업로드 경로는 DLP 정책을 확인하십시오.
6. **Excel 파일 잠금**: Excel에서 연 상태로 preview·approve를 실행하면 읽기 오류가 날 수 있으니 파일을 닫고 실행하십시오.
7. **사내 데이터 위치**: `INTERNAL_STORE_DIR`를 보안 드라이브로 지정하십시오. 사내 데이터가 반영된 `dashboard.json`·HTML·`intel.db`는 외부 반출 금지입니다.
8. **Node 미설치 PC**: 대시보드 실행에는 Node가 필요 없습니다(`frontend/dist`·정적 HTML 포함). 재빌드할 때만 설치하십시오.
9. **E2E**: `playwright-core`는 브라우저를 내려받지 않습니다. 사내 Chrome·Edge 경로를 `CHROMIUM`으로 지정하십시오. 미검증 항목입니다.
10. **미검증**: 이 기준선은 Linux(Python 3.13, Node 22)에서만 검증했습니다. **Windows 실행은 미검증**이므로 첫 설치 때 이 장의 1~9번과 `docs/DEPLOYMENT_GUIDE.md` §3(오류 복구)·§4(보안 체크리스트)를 함께 수행하십시오. `requirements.txt` 주석에 있는 `docs/WINDOWS_MIGRATION_CHECKLIST.md`는 **현재 패키지에 없습니다.** 그 역할은 이 장이 대신합니다.
