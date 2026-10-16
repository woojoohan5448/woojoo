@echo off
REM LG U+ Key Account Intelligence — Windows 최초 설치 (사내 클라우드 PC). 관리자 권한 불필요(사용자 venv).
REM 사전: Python 3.11+ 설치 확인(python --version). 사내 PyPI 미러 사용 시 pip.ini 설정 필요.
cd /d %~dp0
python -m venv .venv || goto :err
call .venv\Scripts\activate.bat
python -m pip install -r requirements.txt || goto :err
python -m models.build || goto :err
echo [OK] 설치 및 모델 빌드 완료. run_dashboard.bat 실행
goto :eof
:err
echo [ERROR] 설치 실패 — docs\DEPLOYMENT_GUIDE.md "오류 복구" 참조
exit /b 1
