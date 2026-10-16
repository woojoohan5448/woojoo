# Research Protocol — Account Evidence Collection (v1.0)

이 문서는 53개 Key Account 조사 에이전트(사람/AI)가 따라야 하는 **단일 규칙**이다.
산출물은 `data/raw/research/{account_id}.json` 1개 파일이며, 아래 스키마를 엄격히 따른다.

## 0. 절대 원칙
1. **숫자를 만들지 않는다.** 원문에서 직접 확인한 숫자만 `reported_value`에 넣는다.
   못 찾으면 해당 항목을 비워두고 `research_log`에 "NOT_FOUND"로 기록한다.
2. 원문 문장(또는 표 행)을 `quoted_statement`에 **그대로** 옮긴다(최대 300자). 기사 요약 문장을 원문처럼 쓰지 않는다.
   WebSearch 요약만 보고 URL 본문을 확인하지 못한 경우 `verification_status`는 최대 `SECONDARY_UNCONFIRMED`로 둔다.
3. 법인 범위를 명시한다. 그룹/지주/글로벌 수치를 한국 법인 수치로 쓰지 않는다(쓸 경우 `scope`에 명시).
4. 로그인·유료벽·봇 차단을 우회하지 않는다. 실패는 `research_log`에 원인과 함께 기록한다.
5. 추정·해석은 `analyst_interpretation`에만 쓴다. 사실 필드와 섞지 않는다.

## 1. 접근 가능한 수단(2026-10 환경 점검 결과)
| 수단 | 상태 | 용도 |
|---|---|---|
| PlayMCP OpenDART (`opendart-find_company`, `get_company_info`, `get_financial_account`, `get_full_financial_statement`, `search_disclosures`) | 사용 가능 | 법인 식별, FY2023~FY2025 재무 |
| WebSearch | 사용 가능 | 정보보호 공시 보도, IT 예산·투자 보도, 사업계획 |
| WebFetch | 일부 가능 | 기사 본문 확인(언론사 사이트) |
| dart.fss.or.kr / opendart.fss.or.kr / isds.kisa.or.kr 직접 접속 | **차단** | — |
| PlayMCP 나라장터(koreaProcurement-*) | 사용 가능(최근 7일 한정) | 공공 계약 확인 |

## 2. 우선 수집 항목 (순서대로)
A. **법인 식별**: 공식 법인명(국/영문), DART corp_code, stock_code, 모회사·그룹, 결산월, 한국 법인 여부.
B. **기본 재무(FY2025, 없으면 FY2024)**: 매출액(또는 영업수익/순영업수익), 영업비용, 영업이익, 자산총계. 금융사는 영업수익과 함께 판관비 확인. OpenDART `get_financial_account` 사용(CFS·OFS 구분 기록).
C. **IT 지출 직접 근거 (최우선)**:
   - **KISA 정보보호 공시**: `정보기술부문 투자액`(A), `정보보호부문 투자액`(B), 비율(B/A), 정보기술부문 인력, 정보보호 인력. 공시 연도와 대상 회계연도를 구분(2026년 6월 공시 = FY2025 실적).
     검색어 예: "{회사명} 정보보호 공시 정보기술부문 투자액", "{회사명} 정보보호 투자액 2025", "보안공시 해부 {회사명}".
     비율과 정보보호 투자액만 있으면 IT 투자액은 DERIVED로 계산해 `analyst_interpretation`에 산식 기재.
   - 금융사: 전산운영비/전산비/IT 예산 보도, 경영공시상 전산 관련 비용, 디지털 투자 계획.
   - 데이터센터·클라우드·AI 인프라 투자 발표(금액, 기간, 장소, MW).
D. **성장 동인(2026~2031)**: 공식 발표된 데이터센터 신설, 차세대 시스템, 클라우드 전환, AI 투자, 해외 확장, 효율화·구조조정. 금액·연도·기간을 가능한 정량화.
E. **경쟁·조달 구조**: 캡티브 SI(예: 우리FIS, 하나INS, 신한DS, KB데이타시스템), 주요 통신·IDC·클라우드 공급사, 멀티벤더 여부, LG U+와의 공개된 거래(보도자료).
F. **중복 위험**: 같은 그룹 내 다른 53개 고객과의 관계(지주·자회사, 공급자-구매자).

## 3. 출력 JSON 스키마
```json
{
  "account_id": "KA03",
  "original_name": "국민은행",
  "research_date": "2026-10-16",
  "researcher": "agent:pilot-bank",
  "entity": {
    "legal_name_ko": "주식회사 국민은행",
    "legal_name_en": "Kookmin Bank",
    "corp_code": "00000000 또는 null",
    "stock_code": null,
    "business_reg_no": null,
    "parent_group": "KB금융지주",
    "related_key_accounts": ["KA21", "KA35"],
    "industry_detail": "시중은행",
    "is_korean_entity": true,
    "fiscal_year_end": "12",
    "dart_available": true,
    "economic_scope": "국민은행 별도(OFS) 기준. 지주 및 계열사 제외",
    "exclusions": "KB국민카드, KB손해보험 등 계열사",
    "entity_status": "CONFIRMED | PROBABLE | UNCERTAIN",
    "entity_notes": "매핑 근거·불확실성"
  },
  "facts": [
    {
      "fact_id": "KA03-F01",
      "metric": "revenue | operating_revenue | operating_expense | sga | operating_income | total_assets | employees | kisa_it_investment | kisa_security_investment | kisa_security_ratio | kisa_it_staff | it_budget | it_opex | it_capex | dc_investment | ai_investment | cloud_spend | other",
      "fiscal_year": 2025,
      "value": 433,
      "unit": "억원 | 원 | 백만원 | % | 명 | USD_mn | MW",
      "scope": "법인 별도 | 연결 | 그룹 | 글로벌",
      "evidence_ids": ["KA03-E01"],
      "verification_status": "VERIFIED | DERIVED | SECONDARY_UNCONFIRMED",
      "analyst_interpretation": "선택. 파생 산식 등"
    }
  ],
  "drivers": [
    {
      "driver_id": "KA03-D01",
      "type": "DC_BUILD | CLOUD_MIGRATION | AI_INVESTMENT | NEXT_GEN_CORE | REGULATORY_SECURITY | OVERSEAS_EXPANSION | EFFICIENCY | RESTRUCTURING | OTHER",
      "description": "무엇을, 언제, 얼마나",
      "amount": 1000,
      "unit": "억원",
      "period": "2025-2027",
      "direction": "UP | DOWN",
      "evidence_ids": ["KA03-E03"]
    }
  ],
  "competitive": [
    {
      "category": "CONNECTIVITY | DC_COLO | CLOUD | AI_INFRA | SECURITY | SI_BUILD | IT_OPS | SW_LICENSE | HW_DEVICE",
      "observation": "예: 계열 캡티브 SI(KB데이타시스템)가 운영 담당",
      "incumbent": "회사명 또는 null",
      "lgu_relationship": "공개 보도된 LG U+ 거래 사실 또는 null",
      "evidence_ids": []
    }
  ],
  "evidence": [
    {
      "evidence_id": "KA03-E01",
      "tier": 1,
      "source_type": "DART_API | DART_FILING | KISA_DISCLOSURE_VIA_PRESS | COMPANY_IR | PRESS_RELEASE | NEWS | GOV_DATA | RESEARCH_REPORT | BENCHMARK",
      "source_title": "기사/문서 제목",
      "publisher": "디지털데일리",
      "source_url": "https://...",
      "document_id": "DART rcept_no 등 또는 null",
      "publication_date": "2026-07-03",
      "accessed_at": "2026-10-16",
      "fiscal_period": "FY2025",
      "page_or_section": "본문 3문단 / 손익계산서 매출액 행",
      "quoted_statement": "원문 그대로",
      "reported_value": "433",
      "reported_unit": "억원",
      "verification_status": "VERIFIED | SECONDARY_UNCONFIRMED",
      "notes": ""
    }
  ],
  "research_log": [
    {"step": "KISA 공시 검색", "target": "isds.kisa.or.kr", "result": "BLOCKED | NOT_FOUND | OK", "detail": "DNS 실패", "retryable": true}
  ],
  "open_questions": ["추가 확인 필요 사항"]
}
```

### Tier 정의
- Tier 1: DART(API/공시), 회사 공식 IR·보도자료, KISA 공시 원문, 공공기관 공시, 정부 예산서
- Tier 2: 공신력 있는 언론(KISA 공시를 인용한 기사 포함), 증권사 리서치, 시장조사기관
- Tier 3: 벤치마크, 해설, 미검증 전망 — 단독 확정 근거 불가

### DART API 근거 작성법
`source_type: DART_API`, `source_url`: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}`,
`document_id`: rcept_no, `page_or_section`: "{fs_nm} {sj_nm} {account_nm} 당기", `quoted_statement`: "account_nm=매출액, thstrm_amount=8,099,147,815,086 (원)".

## 4. 품질 체크리스트(제출 전)
- [ ] 모든 fact에 evidence_id가 있고 그 evidence에 해당 숫자가 실제로 있음
- [ ] 단위(원/백만원/억원) 원문 그대로 기록
- [ ] FY(회계연도)와 공시연도 구분
- [ ] 법인 범위(scope) 기록
- [ ] 찾지 못한 핵심 항목은 research_log와 open_questions에 기록

## 5. 파일럿(5개사) 교훈 — v1.1 추가 규칙 (2026-10-16)
1. **WebFetch는 이 환경에서 전 언론사 DNS 실패.** 시도는 1회만 하고 로그에 남긴 뒤 WebSearch 결과(검색 요약·인용)로 진행한다. 이 경우 status는 `SECONDARY_UNCONFIRMED`.
2. **메트릭 혼동 금지**: 정보보호 예산/투자는 `security_budget`/`kisa_security_investment`. `it_budget`은 **전사 IT 예산 총액**에만 사용(파일럿에서 정보보호 예산을 it_budget로 넣은 오류 발생).
3. KISA 공시 연도 표기: "2026년 공시"는 FY2025 실적, "2025년 공시"는 FY2024 실적이다. 기사 표현이 모호하면 `analyst_interpretation`에 판단 근거를 적고 open_questions에 추가.
4. 다년도 투자/계약 총액은 `period`(예: "2023-2027")를 반드시 기록하고 `scope`에 "다년 누적"을 명시. 연간값으로 환산하지 않는다(엔진에서 처리).
5. 외화 수치는 원 단위(USD 등) 그대로 기록. 환산은 엔진이 한다.
6. 매출 정의: 금융사는 OpenDART가 영업수익을 주지 않는 경우가 많다. 손익계산서 전체(`get_full_financial_statement`, OFS)에서 `영업수익` 또는 `순영업수익`(이자+수수료) 계정을 찾아 기록한다. 금융사 판관비(`sga`)도 가능하면 기록.
7. 법인 별도(OFS) 재무와 연결(CFS)을 모두 기록하되, scope에 반드시 "법인 별도" 또는 "연결"을 표기.

## 6. Phase 1 Evidence Recovery 규칙 (v2.0, 2026-10-16)
- **출력 위치**: 기존 `data/raw/research/KAxx.json`은 수정하지 않는다. 신규 근거는 `data/raw/research_p1/KAxx.json`(동일 스키마)에 **보충(supplement)** 으로 저장한다. fact_id/evidence_id 접두어는 `KAxx-P1-F01`, `KAxx-P1-E01`.
- **추가 키**:
  - `"recovery_levels_tried": ["L1_DIRECT","L2_COMPONENTS","L3_CONTRACT","L4_BENCHMARK","L5_COMPARABLE","L6_SCENARIO"]` 중 실제 시도한 것과 결과(`found`/`not_found`/`not_applicable`)를 기록한 객체 배열
  - `"conflicts": [{"existing_fact_id": "...", "existing_value": ..., "new_value": ..., "unit": "...", "explanation": "...", "evidence_ids": [...]}]` — 기존 수치와 다른 근거를 찾으면 반드시 기록(과대·과소추정 반박 근거 포함)
  - `"comparables": [{"peer_account_or_company": "...", "metric": "...", "value": ..., "unit": "...", "why_comparable": "...", "evidence_ids": [...]}]` (L5)
  - `"estimation_inputs": [{"name": "...", "value": ..., "unit": "...", "basis": "...", "evidence_ids": [...]}]` — 용량(MW), 인원, 단가 등 모델 입력
- **추가 메트릭**: `employees`(명), `it_employees`, `tangible_asset_acquisition`, `intangible_asset_acquisition`(현금흐름표, SW 투자 프록시), `depreciation`, `it_service_cost`(전산비·전산운영비·지급수수료 중 전산), `dc_capacity_mw`, `colocation_price`(원/kW/월), `contract_value`(+period 필수), `korea_revenue`, `security_budget`.
- **검색 예산**: WebSearch는 세션 턴당 200회를 모든 에이전트가 공유한다. **배정된 횟수를 넘기지 말 것.** 한 검색으로 여러 고객을 커버하는 비교 기사(예: "정보보호 공시 2026 카드사")를 우선 사용.
- **DART 우선**: 상장사는 `opendart-get_employees`(FY2025 11011), `get_full_financial_statement`(CF의 유형·무형자산 취득, IS의 전산비 계정)를 우선 수집 — 검색 예산을 쓰지 않는다. 출력이 크면 필요한 계정만 기록.
- 구할 수 없으면 `research_log`에 레벨별 NOT_FOUND 사유를 남긴다. **숫자를 만들지 않는다.**
