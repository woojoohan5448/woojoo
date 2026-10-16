@echo off
chcp 65001 >nul
setlocal
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
REM 사내 Excel 가져오기 (CLI). 사용법: import_excel.bat preview 파일.xlsx / approve 배치ID 승인자 / status / template
if not exist .venv\Scripts\activate.bat (echo [ERROR] setup_windows.bat 를 먼저 실행하세요& exit /b 1)
call .venv\Scripts\activate.bat
if /i "%~1"=="preview" goto :preview
if /i "%~1"=="approve" goto :approve
if /i "%~1"=="status" goto :status
if /i "%~1"=="template" goto :template
echo 사용법: import_excel.bat preview 파일.xlsx / approve 배치ID 승인자 / status / template
exit /b 1
:preview
python -m models.internal.excel_io preview "%~2"
exit /b %errorlevel%
:approve
python -m models.internal.excel_io approve "%~2" --approver "%~3" || exit /b 1
python -m models.build
exit /b %errorlevel%
:status
python -m models.internal.excel_io status
exit /b %errorlevel%
:template
python -m models.internal.excel_io template
exit /b %errorlevel%
