# MCP SOURCE REGISTRY (v2 · 2026-10-16)

진단 근거: `docs/MCP_DIAGNOSTICS.md` (8개 서버 실호출 결과). 상태 코드: CONNECTED_AND_WORKING / CONNECTED_BUT_NOT_EXPOSED / EXPOSED_BUT_CALL_FAILED / AUTHENTICATION_REQUIRED / NOT_AVAILABLE / UNKNOWN.

## 1. 서버별 상태·제공 데이터·프로젝트 용도
| 서버 (도구 접두어) | 상태 | 실측 호출 | 제공 데이터 | 이 프로젝트에서의 용도 | Tier | 제약 |
|---|---|---|---|---|---|---|
| **MyDART** (`MyDART-*`, 15) | CONNECTED_AND_WORKING | find_corp_code, get_financials | 재무(XBRL), **감사보고서·사업보고서 원문(주석 포함)**, 공시 목록, 감사의견, 기업개요 | **L2 IT 비용 구성항목 재구성**(전산비·통신비·지급수수료·SW 무형자산·감가상각), 비상장·외감 법인 매출/비용 VERIFIED화 | 1 | 대형 원문 → `find`/`sections`로 발췌 |
| **OpenDART** (`opendart-*`, 15) | CONNECTED_AND_WORKING | get_company_info 등 | 기업개황, 주요계정, 전체 재무제표, 직원현황, 공시검색 | 상장사 재무·직원 수(L4/L5 규모 변수), CF 유·무형자산 취득 | 1 | 비상장 재무 미제공(013) → MyDART로 보완 |
| **KR-BID** (`krbid-*`, 15) | CONNECTED_AND_WORKING | search | 나라장터 공고·낙찰·기관 통계, 첨부 텍스트 | **L3 계약 기반 재구성**(공공·준공공 IT 발주·낙찰), 경쟁사 수주 현황 | 1(공공 원천) | 업체 이력은 10자리 사업자번호 필요. 쓰기성 도구(북마크·관심키워드) 사용 금지 |
| **나라장터 조달정보** (`koreaProcurement-*`, 3) | CONNECTED_AND_WORKING | search_bid_announcements, search_contracts | 최근 30일 공고 / 7일 계약 / 1일 낙찰 | 최근 발주 모니터링 | 1 | 기간 창이 짧아 연간 지출 추정에는 부적합 |
| **KOSIS** (`koreaStat-*`, 3) | CONNECTED_AND_WORKING | search_indicators, get_indicator_detail | 100대 국가지표 시계열 | 물가·고용 등 거시 보정(2031 실질화) | 1 | 업종별 IT 지출 통계 없음 |
| **IT 뉴스·세미나** (`ItNewsSearch-*`, 3) | CONNECTED_AND_WORKING | News_Article | IT/클라우드/AI 기사·기술블로그·행사 | 투자·DC·AI 계획 단서 | 3 (발행일 미제공) | **date=null** → 다른 근거로 교차확인 필수 |
| **한국 주식** (`koreaStock-*`, 18) | CONNECTED_AND_WORKING (데이터 도구는 resolve_stock만 실측) | system_health, resolve_stock | 시세·지수·종목·DART 요약 | 상장 고객 시가총액 등 보조 지표 | 2 | health 메타가 구현 도구 1개로 표기(불일치) |
| **saaskr** (`saaskr-*`, 7) | CONNECTED_AND_WORKING | list_saas_categories | 국내 SaaS 3,867개 디렉터리 | 제휴·M&A 후보 탐색(Phase 4 전략) | 3 | 공급 측 정보(고객 IT 지출 아님) |
| WebSearch (내장) | 사용 가능 | — | 웹 검색 요약 | KISA 정보보호 공시 보도 등 | 2 | **턴당 200회** 공유 한도, 원문 미열람 |
| WebFetch (내장) | NOT_AVAILABLE | 실패 | — | — | — | 언론사·KISA·DART 호스트 DNS 차단 |

## 2. 독립 근거 판정 규칙 (중복 계산 방지)
- MyDART·OpenDART·koreaStock의 DART 데이터는 **동일 원천(금융감독원 DART)** → 교차 확인용일 뿐 독립 근거 2건으로 세지 않는다.
- KR-BID와 나라장터(koreaProcurement)는 동일 원천(조달청 G2B).
- 같은 보도를 인용한 여러 기사는 1건으로 센다.

## 3. 실패·재시도 관리
| 항목 | 상태 | 사유 | 재시도 조건 |
|---|---|---|---|
| koreaStock 시세·재무 도구 | 미검증 | 데이터 도구 1종(resolve_stock)만 실측 | 실제 사용 전 1회 호출 검증 |
| ItNewsSearch 발행일 | 제약 | 응답 date=null | 서버 업데이트 시 재확인 |
| WebFetch 원문 열람 | NOT_AVAILABLE | DNS/프록시 차단 | 네트워크 정책 변경 시 |
| 세션 도구 노출 지연 | 관측됨 | 세션 시작 시 2개 서버만 노출 → 진단 중 갱신 | 새 세션에서 미노출 시 재진단(MCP_DIAGNOSTICS.md) |
| KISA 정보보호 공시 포털 | NOT_AVAILABLE | 직접 접속 불가, 해당 MCP 없음 | 포털 MCP/접속 허용 시 원문 대조 |
| 해외 공공 API (api.usaspending.gov · data.sec.gov · peeringdb.com · store.steampowered.com) | NOT_AVAILABLE | 2026-10-16 curl 시 프록시 CONNECT 403 (네트워크 정책) | 허용 목록 추가 시 KA32(USFK 계약 obligation)·KA42(Fastly 10-K 지역·PeeringDB 서울 POP)·KA43(Steam 국가별 트래픽) 재조사 |
| ItNewsSearch "메타 트래픽 점유율" | EMPTY_RESULT | 2026-10-16 호출 결과 null 1건(검색어 커버리지 한계) | 키워드 변형 재시도, WebSearch로 대체 완료(KA45-P2-E02) |

## 4. 원하는 데이터 → 사용할 도구
| 데이터 | 1순위 | 2순위 |
|---|---|---|
| 재무제표·감사보고서 | MyDART download_document / get_financials | OpenDART |
| 기업별 CAPEX·IT 자산 | MyDART find(유형/무형자산 취득, 전산기구) | OpenDART full statement CF |
| 시스템 구축 계약·발주/낙찰 | KR-BID search_awards / search | koreaProcurement |
| 산업 성장률 | KOSIS(거시) | WebSearch(시장조사 보도) |
| IT 투자·DC·AI 계획 | WebSearch | ItNewsSearch(교차확인 필수) |
| 보안·네트워크 수요 | WebSearch(KISA 공시 보도) | MyDART(정보보호 관련 주석) |

## 5. Phase 2 재개 조사 로그 (2026-10-16)
- 대상: 잔여 RESEARCH GAP 7개 계정(KA28·KA32·KA41·KA42·KA43·KA45·KA50) — 기존 P1 조사(recovery_levels_tried)를 반복하지 않고 **미시도 간접 근거**만 탐색.
- 정상 MCP 우선: ItNewsSearch(결과 없음) → WebSearch 보완. 해외 공공 API는 프록시 차단(위 표).
- 결과: **KA45 메타 복구**(망 이용대가 동등가치 2방법, SCENARIO·ESTIMATED_LOW·정의 상이) — `data/raw/research_p2/KA45.json`.
- 미복구 사유: KA41 신협(금융사는 정보보호 공시 의무 제외, 중앙회 IT 예산 비공개), KA42/43(국가별 지출·트래픽 원천 차단), KA32(USAspending 차단), KA28/KA50(DC 펀드의 운영위탁 단가 근거 없음).

## 6. OpenDART 직접 API 재시도 (2026-10-16)
- 사용자 제공 OpenDART 키로 `opendart.fss.or.kr` 직접 호출 → **프록시 CONNECT 403(connect_rejected)**. 키는 세션 임시 파일에만 두고 저장소·커밋에 기록하지 않음.
- 대체: PlayMCP OpenDART/MyDART(동일 DART 데이터) 경유 재조사 — KA28 관련 DC PFV 감사보고서 2건 확보(`data/raw/research_p2/KA28.json`), KA41·KA50 공시 0건, KA42·KA43 국내 법인 없음 확인.
- 재시도 조건: 네트워크 허용 목록에 opendart.fss.or.kr 추가 시 `DART_API_KEY` 환경변수로 `research/collectors/dart_collector.py` 실행 가능(사내 환경에서는 사내 정책 확인).
