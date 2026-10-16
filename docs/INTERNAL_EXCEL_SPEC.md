# INTERNAL EXCEL SPEC (Phase 3/4)

템플릿: `data/internal_inputs/templates/KeyAccount_Internal_Input_Template.xlsx` (`python3 -m models.internal.excel_io template` 또는 대시보드 관리자 화면 → 템플릿 다운로드)

## 시트·컬럼
| 시트 | 저장 레이어 | 필수 | 선택 | 키 |
|---|---|---|---|---|
| INTERNAL_ACTUAL | INTERNAL_ACTUAL | account, fiscal_year, period_type(YTD/FORECAST/ACTUAL_FULL_YEAR), revenue, unit | as_of(YTD 필수), product_line, contract_id, source_system, note | account·FY·period_type·product_line·contract_id |
| SALES_ESTIMATE | SALES_ESTIMATE | account, fiscal_year(2026/2031), metric(TS/RAW/FPR), value, unit, sales_rep | as_of, rationale, confidence | account·FY·metric |
| MANAGEMENT_TARGET | MANAGEMENT_TARGET | account, fiscal_year(2031), target_revenue, unit, approver | as_of, basis | account·FY |
| ACCOUNT_PLAN | APPROVED_ACCOUNT_PLAN | account, assumption_key, value | unit, fiscal_year, owner, note | account·assumption_key |

- **unit**: 원/천원/백만원/억원/조원 → 억원으로 환산. 통화는 KRW만.
- **fiscal_year**: 2025~2031.
- **상품/계약 단위 행**: 원래 정의를 유지해 저장하고, CR은 FORECAST(또는 ACTUAL_FULL_YEAR) 행 합계로 계산(YTD는 별도 표시).

## 고객 매핑 규칙 (`models/internal/excel_io.py`)
1. 정규화: 소문자화, `(주)·㈜·주식회사·유한회사·Co.,Ltd·Inc·Corp·코리아/Korea·공백·구두점` 제거
2. 별칭 색인: account_id, 원본 고객명, 국문·영문 법인명, DART corp_code, 종목코드 + `config/account_aliases.json`(수동 추가)
3. 정확 일치 1건 → MAPPED, 다건 → **AMBIGUOUS**(예: "토스" → 비바리퍼블리카/토스뱅크/토스증권/토스페이먼츠)
4. 유사도(difflib) ≥ 0.88 이고 차순위와 0.05 이상 차이 → MAPPED(needs_review 경고), 그 외 UNMAPPED/AMBIGUOUS → **오류(승인 불가)**

## 워크플로
1 파일 선택 → 2 형식·필수 컬럼 검사 → 3 고객 매핑 → 4 연도·단위·통화·음수·YTD 기준일 검증 → 5 기존 승인값 비교(NEW/CHANGED/UNCHANGED) → 6 오류·경고·파일 내 중복 키 보고 → 7 **승인자 입력 후 승인**(행 선택 가능) → 8 레이어별 `current` 갱신 + 이전값 `history` 보존(배치 ID·승인자·원본 파일 SHA-256·Excel 행 번호) → 9 `models.build` 재계산 → 10 대시보드 갱신
- 오류가 있는 행은 저장되지 않는다. UNCHANGED 행은 재저장하지 않는다. 거부(reject)도 기록한다.

## 모델 반영 규칙
- INTERNAL_ACTUAL 2026 FORECAST/ACTUAL → CR_2026 (C-SOW, PCR, Upside 재계산). CR > FPR이면 경고(값 유지).
- MANAGEMENT_TARGET 2031 → Target (Target > FPR_2031 → ERROR, Target SOW 재계산).
- SALES_ESTIMATE → **외부 추정을 덮어쓰지 않음**. Reconciliation(±20% 이내 ALIGNED, 초과 REVIEW_SALES_HIGHER/LOWER)으로 표시 → 차이 원인 검토 후 승인된 Account Plan 값으로 확정.
- 사내 데이터가 반영되면 `meta.contains_internal_data=true` → 대시보드 헤더 "사내 데이터 포함 · 외부 반출 금지", 릴리스 패키저 차단.

## 보안
- 저장: `data/internal_store/`(INTERNAL_STORE_DIR로 변경 가능), 업로드 원본: `data/internal_store/uploads/` — 모두 .gitignore.
- 이 모듈은 네트워크 호출이 없다. 외부 MCP/LLM 전송 경로 없음. 사내 AI 도구 연동 전 데이터 처리·로깅·접근권한 정책 확인 필수.
- 권한 분리(권장): 업로드(영업기획) / 승인(관리자) / 내보내기(관리자) — 현재 승인자 이름 기록만 구현, 사내 SSO 연동은 이관 후 과제.
