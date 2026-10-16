@echo off
chcp 65001 >nul
setlocal
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
REM LG U+ Key Account Intelligence - Windows 최초 설치 (사내 클라우드 PC). 관리자 권한 불필요(사용자 venv).
REM 사전: Python 3.11+ (python 또는 py 런처). 사내 PyPI 미러 사용 시 pip.ini 설정. 오프라인: wheels 폴더가 있으면 자동 사용.
set PY=python
where python >nul 2>&1 || set PY=py -3
%PY% -c "import sys; assert sys.version_info >= (3, 11), sys.version" || goto :err_py
if not exist .venv\Scripts\python.exe (%PY% -m venv .venv || goto :err)
call .venv\Scripts\activate.bat
if exist wheels (python -m pip install --no-index -f wheels -r requirements.txt || goto :err) else (python -m pip install -r requirements.txt || goto :err)
python -m models.build || goto :err
echo [OK] 설치 및 모델 빌드 완료. run_dashboard.bat 실행
exit /b 0
:err_py
echo [ERROR] Python 3.11 이상이 필요합니다. 사내 소프트웨어 센터에 요청하세요.
exit /b 1
:err
echo [ERROR] 설치 실패 - docs\DEPLOYMENT_GUIDE.md "오류 복구" 참조
exit /b 1
