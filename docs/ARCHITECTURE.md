# ARCHITECTURE

```
 외부 공개정보 ─┐  PlayMCP(MyDART·OpenDART·KR-BID·KOSIS·IT뉴스·주식·saaskr·나라장터) + WebSearch
               ▼
 data/raw/research/*.json (v1, 불변)  +  data/raw/research_p1/*.json (Phase1 보충, 불변)  +  _MARKET/_DC 벤치마크
               │
 config/  (model_parameters · account_overrides · research_corrections · overlap_groups · not_applicable · strategy · parameter_evidence)
               │
 models/build.py ── spending/ts.py (앵커: DIRECT·KISA·KISA_SEC·ACCOUNT_SPECIFIC·AUDIT_IT_COMPONENTS·EMPLOYEE·INTENSITY)
               │   addressability/raw.py · capture/fpr.py · forecasting/bridge.py · validation/checks.py · grading · reconcile
               │   ▲ models/internal/excel_io.py ← data/internal_store/ (사내 승인 레이어: INTERNAL_ACTUAL·SALES_ESTIMATE·MANAGEMENT_TARGET·APPROVED_ACCOUNT_PLAN)
               ▼
 data/processed/ (intel.db SQLite, dashboard.json, metric_history.csv) · data/exports (CSV/XLSX) · frontend/src/data/dashboard.json
               │
     ┌─────────┴───────────┐
 backend/app.py (FastAPI)   frontend (React+TS+Vite+ECharts+Tailwind)
  /api/dashboard ·accounts    ├ dist/  (API 모드: 업로드·승인·재계산 가능)
  /api/import/* (preview·     └ dist-single/index.html (오프라인 단일 HTML: 조회 전용)
   approve·reject·template)
  /api/management-inputs · /api/export/*
               │
 models/audit.py · models/validation/anomaly.py · reports/*  → data/phase1/*, docs/*, reports/*
 tools/make_release.py → dist_release/*.zip (사내 데이터 감지 시 차단)
```

## 데이터 레이어
| 레이어 | 위치 | 성격 |
|---|---|---|
| EXTERNAL_FACT | research/*.json facts (VERIFIED/SECONDARY) | 공개 원천 사실 |
| EXTERNAL_ESTIMATE | data/processed (TS/RAW/FPR, 등급) | 근거 기반 추정 |
| INTERNAL_ACTUAL | internal_store/INTERNAL_ACTUAL.json | 사내 실적 매출 |
| SALES_ESTIMATE | internal_store/SALES_ESTIMATE.json | 영업 추정 (외부 추정 덮어쓰기 금지) |
| MANAGEMENT_TARGET | internal_store/MANAGEMENT_TARGET.json | 경영진 목표 |
| APPROVED_ACCOUNT_PLAN | internal_store/APPROVED_ACCOUNT_PLAN.json | 승인된 Account Plan 가정 |

## 실행 방식 비교 (사내 클라우드 PC)
| 방식 | 조회 | Excel 업로드·승인·재계산 | 필요 권한 |
|---|---|---|---|
| A. 단일 HTML (`Key_Account_Dashboard.html`) | O | X (CSV 내보내기만) | 브라우저만 |
| B. 로컬 Python + 브라우저 (`run_dashboard.bat`) | O | O | Python 3.11+ 실행·로컬 포트 8000 |
| C. 사내 서버 배포 (uvicorn/컨테이너) | O | O (다중 사용자) | 서버·SSO·접근통제 (이관 후 과제) |
CLI 대안: `import_excel.bat` (서버 없이 Excel 처리 + `models.build`).
