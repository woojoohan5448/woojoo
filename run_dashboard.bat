@echo off
chcp 65001 >nul
setlocal
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
REM 로컬 대시보드 + 데이터 API (http://127.0.0.1:8000). 외부 네트워크 호출 없음.
if not exist .venv\Scripts\activate.bat (echo [ERROR] setup_windows.bat 를 먼저 실행하세요& exit /b 1)
call .venv\Scripts\activate.bat
set PORT=8000
if not "%1"=="" set PORT=%1
if not exist frontend\dist\index.html echo [INFO] frontend\dist 없음 - Key_Account_Dashboard.html 로 조회만 가능
start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:%PORT%"
python -m uvicorn backend.app:app --host 127.0.0.1 --port %PORT%
