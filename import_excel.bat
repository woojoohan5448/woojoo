@echo off
REM 사내 Excel 가져오기 (CLI). 사용법: import_excel.bat preview 파일.xlsx  |  import_excel.bat approve 배치ID 승인자  |  import_excel.bat status
cd /d %~dp0
call .venv\Scripts\activate.bat
if "%1"=="preview" python -m models.internal.excel_io preview "%2"
if "%1"=="approve" (python -m models.internal.excel_io approve %2 --approver "%3" && python -m models.build)
if "%1"=="status" python -m models.internal.excel_io status
if "%1"=="template" python -m models.internal.excel_io template
