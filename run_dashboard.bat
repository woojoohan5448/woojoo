@echo off
REM 로컬 대시보드 + 데이터 API (http://127.0.0.1:8000). 외부 네트워크 호출 없음. 브라우저에서 접속.
cd /d %~dp0
call .venv\Scripts\activate.bat
if not exist frontend\dist\index.html (
  echo [INFO] frontend\dist 없음 — 정적 파일 Key_Account_Dashboard.html 로 조회만 가능. 빌드 PC에서 dist 포함 패키지를 받으세요.
)
start "" http://127.0.0.1:8000
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
