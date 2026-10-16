# LG U+ Enterprise — 53 Key Account IT Spending & Full Potential Revenue Intelligence Platform (2026–2031)

53개 Key Account의 2026·2031 **TS → RAW → FPR → CR/Target** 구조를 추정하고, 모든 수치의 산식·가정·출처·신뢰도를 추적하는 경영진용 분석 시스템.

## 빠른 실행
```bash
# 0) 의존성
pip install fastapi==0.115.4 uvicorn httpx pytest openpyxl
cd frontend && npm install && cd ..

# 1) 모델 빌드 (조사 JSON + config + 관리자 입력 → SQLite/JSON/CSV)
python3 -m models.build
python3 -m models.export_xlsx            # data/exports/key_account_intelligence.xlsx
python3 -m reports.generate_reports      # 보고서 재생성

# 2-A) API 모드 (권장: 관리자 입력 저장·재계산 가능)
cd frontend && npm run build && cd ..
uvicorn backend.app:app --host 0.0.0.0 --port 8000   # http://localhost:8000

# 2-B) 개발 모드
uvicorn backend.app:app --port 8000 &  ;  cd frontend && npm run dev   # http://localhost:5173 (/api 프록시)

# 2-C) 단일 HTML (오프라인 공유용, 데이터 번들 포함·관리자 저장 불가)
cd frontend && npm run build:single      # frontend/dist-single/index.html

# 3) 테스트
python3 -m pytest -q                     # 모델·API (20)
cd frontend && npx vitest run            # 포맷·차트·지표 해석 (6)
node tests/e2e/dashboard.e2e.mjs         # 브라우저 E2E (서버 실행 상태, 14)
```

## 정적 빌드 vs 데이터 API
| | 정적(단일 HTML / dist) | API(FastAPI) |
|---|---|---|
| 데이터 | 빌드 시점 `dashboard.json` 번들 | 요청 시 최신 `data/processed` |
| 관리자 입력 | CSV 내보내기 → 파일 저장 → `models.build` 재실행 | 화면에서 저장 → 자동 재계산·검증 |
| 배포 | 파일 1개, 서버 불필요 | 사내 서버/컨테이너 |
| 보안 | 키 없음 | `DART_API_KEY`는 서버 환경변수로만, 프론트 미노출 |

## 디렉터리
```
config/            파라미터·가정(model_parameters), 계정 보정(account_overrides), 원천 보정(research_corrections),
                   중복 그룹, 전략 평가, 파라미터 근거 맵, 53개 seed
data/raw/research  고객별 조사 원본(불변) + 시장 벤치마크 + KISA 정의
data/internal_inputs  사내 CR·Target 입력 템플릿
data/processed     intel.db(SQLite), dashboard.json, metric_history.csv, ACCOUNT_MASTER.csv
data/exports       CSV/XLSX
research/          수집기(DART), 파서(조사 파일 검증)
models/            spending · addressability · capture · forecasting · validation · build · export
backend/           FastAPI + schema.sql
frontend/          React + TS + Vite + ECharts + Tailwind
reports/           QUALITY_REPORT · RESEARCH_GAPS · STRATEGIC_SYNTHESIS (+ 생성기)
docs/              METHODOLOGY · DATA_DICTIONARY · RESEARCH_PROTOCOL · ENTITY_RESOLUTION_REPORT · PROJECT_PLAN · ACCOUNT_MASTER.csv
tests/             pytest · e2e
```

## 데이터 갱신 절차
1. 조사: `docs/RESEARCH_PROTOCOL.md` 스키마로 `data/raw/research/KAxx.json` 갱신 → `python3 -m research.parsers.validate_research --summary`
2. (선택) DART 원문 수집: `DART_API_KEY=... python3 -m research.collectors.dart_collector KA03`
3. 오분류 보정은 원본 수정 대신 `config/research_corrections.json`에 이력과 함께 추가
4. `python3 -m models.build` → 검증 이슈 확인(Data Quality 탭) → 보고서 재생성

## 핵심 원칙
- 숫자는 VERIFIED / DERIVED / ESTIMATED / SCENARIO / UNKNOWN으로 구분, UNKNOWN·미입력은 0이 아님
- 추정치는 유효숫자 2자리·'≈' 표기, 범위 병기
- 값은 조용히 수정하지 않고 data_quality_issues로 기록
- 상품별 LG U+ 매출 배분은 이번 단계 범위 밖(확장 포인트만)
