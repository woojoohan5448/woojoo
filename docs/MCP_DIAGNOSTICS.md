# PlayMCP 연결 진단 (2026-10-16 · 세션 내 실측)

## 결론
8개 서버 모두 **CONNECTED_AND_WORKING** (읽기 전용 테스트 호출 성공).
진단 시작 시점에는 opendart·koreaProcurement 2개만 노출되어 있었고, 진단 도중(첫 테스트 호출 직후) 나머지 6개 서버의 도구 58개가 세션에 동적으로 추가 노출되었다.
→ 이전 세션 보고("OpenDART와 나라장터만 사용 가능")는 **당시 세션의 도구 목록 기준으로는 사실**이었으며, 원인은 서버 미등록이 아니라 **세션 도구 목록 갱신 시점**으로 판단된다.

## 서버별 결과
| # | 서버 (도구 접두어) | 노출 도구 수 | 테스트 호출 | 결과 | 상태 |
|---|---|---|---|---|---|
| 1 | KR-BID (`krbid-*`) | 15 | `krbid-search(query="전산", limit=1)` | 공고 1건(조달청 서울청 전산장비 유지보수, 예가 59.0억) | CONNECTED_AND_WORKING |
| 2 | MyDART (`MyDART-*`) | 15 | `find_corp_code("코스콤")` → 00159661; `get_financials(00159661, 2025)` | 정상 응답. 비상장사는 `no_data`(013) + **감사보고서 원문 경로 안내**(rcept_no 20260330000337, `download_document`) | CONNECTED_AND_WORKING |
| 3 | saaskr (`saaskr-*`) | 7 | `list_saas_categories()` | 16개 카테고리·3,867개 서비스 | CONNECTED_AND_WORKING |
| 4 | IT 뉴스·세미나 (`ItNewsSearch-*`) | 3 | `News_Article("데이터센터")` | 기사 80여 건(제목·URL). **date 필드가 null** | CONNECTED_AND_WORKING (날짜 미제공 제약) |
| 5 | KOSIS (`koreaStat-*`) | 3 | `search_indicators("소비자물가")`, `get_indicator_detail("58")` | 소비자물가지수 2026-09 = 120.43 | CONNECTED_AND_WORKING (KOSIS **100대 지표** 범위) |
| 6 | 한국 주식 (`koreaStock-*`) | 18 | `system_health()`, `resolve_stock("LG유플러스")` | ok, KIS·DART 설정됨, 032640 KOSPI 반환. 단 health의 `tools_implemented`는 system_health만 표기(메타 불일치) | CONNECTED_AND_WORKING (데이터 도구 1종만 실측) |
| 7 | OpenDART (`opendart-*`) | 15 | `get_company_info("00126186")` | 삼성에스디에스(주) | CONNECTED_AND_WORKING |
| 8 | 나라장터 (`koreaProcurement-*`) | 3 | `search_bid_announcements("전산", 3일, 1건)` → items 0 (total 6,393); `search_contracts(3일, 1건)` → 1건 | CONNECTED_AND_WORKING (키워드 필터+소량 조회 시 빈 페이지 가능) |

※ 실제 호출한 도구만 '정상'으로 기록했다. 각 서버의 나머지 도구는 노출만 확인했고 호출하지 않았다. 쓰기성 도구(krbid add_bookmark/add_watch_keyword 등)는 호출하지 않았다.

## 프로젝트 활용 가치 (Phase 1 N/A 복구 관점)
- **MyDART `download_document` / `get_audit_report`**: 비상장·외감 법인(코스콤, IBK시스템, CJ올리브네트웍스, 농협은행, 네이버클라우드, NHN클라우드, 구글·MS·오라클·차이나유니콤 한국법인 등) 감사보고서 원문 → 기존 OpenDART API로 불가했던 매출·비용·주석(전산비, 유무형자산 취득) 확보 가능성. **최우선 활용 대상.**
- **KR-BID `search_awards`/`award_stats`**: 공공·금융 IT 발주/낙찰 이력(LEVEL 3 계약 기반 재구성).
- **KOSIS**: 거시 지표(물가·고용 등) — 업종별 IT 지출 직접 통계는 100대 지표 범위상 제한적일 수 있음.
- **IT 뉴스**: 날짜가 없어 근거 사용 시 발행일 별도 확인 필요(Tier 2/3).
- **한국 주식**: 시가·지수 등 — TS 추정 직접 기여는 낮음.
- **saaskr**: 국내 SaaS 공급사 디렉터리 — 경쟁·제휴 후보 탐색용.
