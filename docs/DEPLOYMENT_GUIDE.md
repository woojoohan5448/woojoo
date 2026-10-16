# DEPLOYMENT GUIDE — 사내 클라우드 PC 이관 (Windows)

> ⚠ 아래 절차는 이 개발 환경(Linux)에서 작성·검증되었다. **Windows 사내 PC에서의 실행은 아직 검증되지 않았다** (Python 설치 권한, 사내 PyPI 미러, 포트 정책, 백신 정책 확인 필요).

## 0. 패키지
- 개발 환경에서 `python3 tools/make_release.py` → `dist_release/KeyAccountIntel_<version>.zip` (외부 데이터만, `MANIFEST.json`에 파일별 SHA-256). 사내 데이터가 감지되면 생성 거부.
- 조회만 필요하면 `Key_Account_Dashboard.html` 단일 파일(오프라인, 데이터 내장)로 충분.

## 1. 설치 (방식 B)
1. zip 압축 해제 (예: `C:\work\kai`)
2. `python --version` (3.11+) 확인. 없으면 사내 소프트웨어 센터 요청
3. `setup_windows.bat` 실행 → `.venv` 생성, `requirements.txt` 설치, 모델 빌드
   - 인터넷 차단 환경: 개발 PC에서 `pip download -r requirements.txt -d wheels` → 함께 반입 → `pip install --no-index -f wheels -r requirements.txt`
4. `run_dashboard.bat` → 브라우저 `http://127.0.0.1:8000`
   - `frontend/dist`는 패키지에 포함(빌드된 정적 파일). Node.js는 사내 PC에 필요 없음.

## 2. 사내 Excel 반영
- 대시보드 → 관리자 입력 → 템플릿 다운로드 → 작성 → 업로드 → 미리보기 검토 → 승인자 입력 → 승인 (자동 재계산)
- 또는 CLI: `import_excel.bat preview 파일.xlsx` → `import_excel.bat approve <배치ID> 홍길동`
- 명세: `docs/INTERNAL_EXCEL_SPEC.md`

## 3. 오류 복구
| 증상 | 조치 |
|---|---|
| `python` 인식 불가 | PATH 확인 또는 `py -3.11` 사용 |
| pip 설치 실패(프록시) | 사내 pip.ini(index-url, trusted-host) 설정 또는 wheels 오프라인 설치 |
| 포트 8000 사용 중 | `run_dashboard.bat`의 `--port` 변경 |
| 모델 빌드 ERROR | `python -m models.build` 출력과 Data Quality 탭 확인. 원천 파일 수정 금지, config로 보정 |
| 잘못 승인한 Excel | `data/internal_store/<LAYER>.json`의 `history`에 이전값 보존 — 해당 값으로 수정 Excel을 재업로드·승인(감사추적 유지). 직접 JSON 편집 비권장 |
| 대시보드 값이 갱신 안 됨 | 브라우저 새로고침, 헤더의 data_version 확인, `/api/health` 확인 |
| 사내 데이터 포함 표시 | 정상(사내 데이터 반영 상태). 외부 반출·공유 금지 |

## 4. 보안 체크리스트 (이관 전 필수)
- [ ] 사내 AI 도구/LLM에 사내 데이터를 전달하는 경우 데이터 처리·로깅·보관 정책 승인
- [ ] `data/internal_store/` 접근 권한(폴더 ACL) 설정
- [ ] 업로드·승인·내보내기 권한 분리(SSO 연동은 방식 C에서)
- [ ] Git 원격 저장소에 사내 데이터·원본 Excel 미포함 확인 (`git status`, .gitignore)
- [ ] 백업 정책(internal_store, processed)
