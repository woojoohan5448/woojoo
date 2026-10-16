# 미확인 데이터 및 추가 조사 목록 (Research Gaps)

우선순위: ① TS 미확인 → ② 매출집약도(신뢰도<35) → ③ 원문 미확인(SECONDARY) 승격 대상.

## A. 공통 — 접근 제약 해소 시 일괄 개선

1. **KISA 정보보호 공시 포털(isds.kisa.or.kr) 원문 대조**: 현재 TS 앵커 대부분이 보도 인용(SECONDARY). 포털 원문 확인 시 VERIFIED 승격 및 신뢰도 상한(70) 해제.
2. **DART 원문(감사보고서 주석) 열람**: 비상장·유한회사(코스콤, IBK시스템, CJ올리브네트웍스, 농협은행, 네이버클라우드, NHN클라우드, 구글·MS·오라클·차이나유니콤 한국법인)는 OpenDART 재무 API가 미제공 → `DART_API_KEY`로 원문/XBRL 수집 필요.
3. **WebSearch 한도(턴당 200회) 소진**으로 미수행된 항목: 각 사 IT 계획(차세대·클라우드·AI·DC), 캡티브 SI 구조 원문, LG U+ 거래 관계 보도. 후속 세션에서 고객별 재조사.
4. **사내 데이터(필수)**: 고객별 CR_2026(YTD·연말 예상), 계약·회선·IDC 상면 현황, 재계약 시점, 수주 파이프라인, 2031 목표 → 관리자 입력 템플릿 `data/internal_inputs/management_inputs.csv`.

## B. 고객별

| 순위 | ID | 고객 | 현재 상태 | TS 방법 | 신뢰도 | 핵심 미확인 사항 |
|---|---|---|---|---|---|---|
| 1 | KA28 | 코람코자산운용 | SOURCES_COLLECTED | UNKNOWN | 0 | 코람코 운용 데이터센터 펀드/리츠(자산명·MW·임차인) 및 LG U+ IDC 매입·세일앤리스백 여부; 운용사 FY2025 영업수익·AUM; LG U+ 관계가 운용사 본체인지 개별 펀드인지 |
| 2 | KA32 | 주한미군 | MODEL_ESTIMATED | UNKNOWN | 0 | W91QVN24R0121(USFK 모바일 서비스, 2025-2029) 낙찰자 및 계약금액 — LG U+ 포함 여부; LG U+ 대미군 연방계약 누적액이 0.9M~24.7M USD로 출처별 상충 — USAspending 원자료(UEI UVRJAVB4KWB5)로 연도별 obligated 확인 필요; W91QVN25G0001/0002 BOA 하위 발주(task order) 실적 및 W91QVN25R0015와의 연결 확인 |
| 3 | KA41 | 신용협동조합 | NEEDS_REVIEW | UNKNOWN | 0 | 구매 주체 확정(중앙회 vs 개별조합 vs 신협 전산 자회사); 중앙회 FY2025 영업수익·총자산·전산비(경영공시); 신협 차세대/전산센터·DR센터 사업 및 공급사, LG U+ 회선 거래 여부 |
| 4 | KA42 | Fastly, Inc. | NEEDS_REVIEW | UNKNOWN | 0 | Fastly 서울 POP 호스팅 IDC(LG U+/KT/KINX/에퀴닉스 등)와 트랜짓 공급사; Fastly 한국 매출 또는 한국 고객 수; PeeringDB 상 Fastly(AS54113) 서울 시설·IX 등록 여부 |
| 5 | KA43 | Valve Corporation | NEEDS_REVIEW | UNKNOWN | 0 | Steam 한국 콘텐츠 서버 호스팅 IDC·트랜짓 공급사; LG U+ 망 내 Steam 캐시가 Valve 직접 배치인지 제3자 CDN 경유인지; 한국 Steam 트래픽 규모(Gbps) |
| 6 | KA50 | 키암코인천도화동데이터센터일반부동산사모투자회사 | SOURCES_COLLECTED | UNKNOWN | 0 | 운용사 확인(산은인프라자산운용 vs KIAMCO 브랜드 원 운용사); 인천 도화동 DC 용량(MW)·임차인/운영사(LG U+ 여부)·매입/개발비·준공 시점; 펀드 FY2025 감사보고서 존재 여부 |
| 7 | KA05 | 한국전력공사 | MODEL_ESTIMATED | REVENUE_INTENSITY | 30 | ALIO 경영공시: 정보화 예산·ICT 투자액(FY2023-2025); KISA 정보보호 공시 정보기술부문/정보보호부문 투자액; AMI 보급 계획(대수·사업비·기간) 및 원격검침 통신방식/회선 공급 통신사(LG U+ LTE-M 모뎀 여부) |
| 8 | KA24 | 농협은행 | MODEL_ESTIMATED | REVENUE_INTENSITY | 30 | FY2025 재무(영업수익/순영업수익, 판관비, 자산총계) — 감사보고서 원문 또는 농협금융 IR로 확보 필요; KISA 정보보호 공시 참여 여부; 2026 IT 예산·정보보호 예산 금액(비중 10.5%만 확보) |
| 9 | KA40 | 한화시스템(주) | MODEL_ESTIMATED | REVENUE_INTENSITY | 30 | KISA 정보보호 공시 정보기술부문/정보보호부문 투자액·인력 FY2023-FY2025 (2024~2026 공시); 자체 DC/클라우드/AI 인프라 투자 발표(금액·MW·기간); 캡티브(계열사) 매출 비중 — 사업보고서 특수관계자 주석 또는 공정위 내부거래 보도 |
| 10 | KA04 | 신한카드(주) | MODEL_ESTIMATED | REVENUE_INTENSITY | 30 | KISA 정보보호 공시(FY2023~2025) 정보기술부문/정보보호부문 투자액·인력 — 미확보(웹검색 한도 소진). 자율공시 여부 확인 필요; 전산운영비/IT 예산, 차세대·클라우드·AI·DC 계획 금액 미확보; KA18(신한은행 추정)과 그룹 공동 IT·보안 투자(신한DS 경유) 중복 여부 — 신한은행 KISA 수치(FY2025 정보보호 약 369억원, 블로터 보도 요약)는 KA18 소관이며 KA04에 합산 금지 |
| 11 | KA13 | 롯데이노베이트(주) | MODEL_ESTIMATED | REVENUE_INTENSITY | 30 | KISA 정보보호 공시 정보기술부문/정보보호부문 투자액·인력 FY2023-FY2025 (2024~2026 공시); 자체 DC/클라우드/AI 인프라 투자 발표(금액·MW·기간); 캡티브(계열사) 매출 비중 — 사업보고서 특수관계자 주석 또는 공정위 내부거래 보도 |
| 12 | KA36 | (주)코스콤 | MODEL_ESTIMATED | REVENUE_INTENSITY | 30 | FY2025 매출·영업비용·자산총계: 감사보고서(20260330000337) 본문 열람 필요; KISA 정보보호 공시 의무대상 여부 및 FY2023~2025 투자액; 자체 IT 소비(내부 인프라) vs 고객 판매 서비스(매출원가) 구분 필요 |
| 13 | KA02 | 한국토요타자동차 | MODEL_ESTIMATED | REVENUE_INTENSITY | 30 | 감사보고서(20260710000186) 원문으로 매출(1조5103억 vs 1조5013억)·영업이익·자산총계 검증; KISA 정보보호 공시 대상 여부 및 IT/정보보호 투자액; 토요타 커넥트 회선 수(가입 차량 수) 및 회선 제공 통신사가 LG U+ 단독인지 |
| 14 | KA08 | 아마존 | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 51 | LG U+ B2B 계약 주체가 AWS Korea LLC인지, 해외 AWS 법인(DC 운영 SPV 등)인지 확인 필요; 인천 가좌동 DC 건축주(한국 내 DC 보유 법인) 법인명 및 DART 존재 여부; AWS Korea 유한책임회사 전환 시점(2020-10 vs 2021-10) 및 DART상 '유한회사' 표기와의 불일치 |
| 15 | KA14 | 삼성에스디에스(주) | MODEL_ESTIMATED | KISA_SEC_SCALED | 58 | KISA 정보기술부문 투자액 FY2024·FY2025(2025·2026 공시) 절대값; FY2025 정보보호 667.42억의 전년 대비 증가액 보도 불일치(2.4% vs 159억원); 연결 매출 중 IT서비스 vs 물류 부문 분해(사업보고서 부문정보) |
| 16 | KA07 | 마이크로소프트 | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 41 | 한국MS FY2025/FY2026 감사보고서 매출·영업이익(원문); Azure 서울/부산 리전 코로케이션 공급사(KT/LG U+/SK 등) 및 자체 DC 여부; LG U+–MS 2024 이후 AI·소버린 클라우드 협력 실재 여부(요청서상 언급 근거 미발견) |
| 17 | KA25 | 미래에셋증권(주) | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 정보보호 공시 미참여 → 정보기술부문 투자액(A) 부재. 지속가능경영보고서 원문에서 IT 예산 총액·정보보호 예산 금액 확인 필요; 정보보호 예산 비중 10%·26% 증액·인력 25명 문장의 원 기사 특정 및 본문 확인 필요; IT 운영 구조(그룹 IT 계열 여부, 코스콤 원장 의존 여부, IDC·회선 공급사) 및 LG U+ 공개 거래 미조사 |
| 18 | KA39 | 엔에이치투자증권(주) | MODEL_ESTIMATED | KISA_SEC_SCALED | 58 | FY2025 정보기술부문 투자액·비율 KISA 원문 확인; FY2024 IT 1321억 문장 출처 기사 특정; 농협 계열 IT(농협정보시스템 등) 관여 여부 및 KA24와 IT 지출 중복 범위 — 미검증 가설 |
| 19 | KA21 | (주)케이비국민카드 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 정보보호 공시(FY2023~2025) 정보기술부문/정보보호부문 투자액·인력 — 미확보(웹검색 한도 소진). 자율공시 여부 확인 필요; 전산운영비/IT 예산, 차세대·클라우드·AI·DC 계획 금액 미확보; KA03(국민은행)·KA35(KB손해보험)와 KB데이타시스템 경유 그룹 공동 IT 지출 중복 여부 |
| 20 | KA38 | 새마을금고중앙회 | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 56 | 중앙회 FY2025 경영공시(총자산·영업수익·판관비/전산비) 확보 — 중앙회 단독 vs 회원금고 합산 구분; MG 차세대 시스템(사업 기간·금액·주사업자), 전산센터(주/백업 DC 위치·이전 계획) 보도 확인; KISA 정보보호 공시 대상 여부 및 정보보호 투자액 |
| 21 | KA06 | 구글클라우드 | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 51 | 구글클라우드코리아 FY2023~FY2025 단독 매출·영업이익(감사보고서 본문 필요); LG U+ IDC 임차 계약 주체(국내 법인 vs Google LLC)와 계약 규모·MW; 서울 리전 이외 한국 신규 DC/AI 인프라 투자 계획 유무 |
| 22 | KA23 | (주)한국스탠다드차타드은행 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 정보보호 공시 참여 여부(미참여로 추정); 국내 IT 예산·전산비 및 글로벌 SC 오프쇼어링 비중; FY2025 판관비 급증 원인 |
| 23 | KA35 | (주)케이비손해보험 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 정보보호 공시 FY2023~2025(KB손보는 매출 기준 의무공시 대상 가능성 높음) 미확보; IT 예산·차세대·클라우드·AI 계획 미확보; 판관비 상당액: IFRS17 사업비 주석에서 확인 필요 |
| 24 | KA16 | 지에스리테일 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 공시 정보기술부문 투자액 FY2023-2025 및 정보보호 FY2023/24 원값; GS25 점포 수 및 매장망(인터넷·POS) 회선 공급사, LG U+ 매장망 거래 여부; GS ITM·GS네오텍(KA15)과의 IT 조달 관계(중복 위험) |
| 25 | KA30 | 메르세데스벤츠코리아(주) | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | 메르세데스 미 커넥트 현행 국내 회선 공급 통신사(KT 유지 여부) 및 회선 수; 감사보고서 원문으로 매출·영업이익·자산총계 검증; KISA 정보보호 공시 대상 여부 |
| 26 | KA46 | 한국오라클 | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 51 | 한국오라클 FY2026(2026.05) 매출·영업이익(감사보고서 원문); OCI 서울·춘천 리전 호스팅 IDC(LG U+/SK/KT 등) 및 개소 시기 원문 확인; Oracle 한국 AI/클라우드 인프라 투자 발표 유무 |
| 27 | KA20 | (주)우리카드 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 정보보호 공시(FY2023~2025) 정보기술부문/정보보호부문 투자액·인력 — 미확보(웹검색 한도 소진). 자율공시 여부 확인 필요; 전산운영비/IT 예산, 차세대·클라우드·AI·DC 계획 금액 미확보; KA19(우리은행 추정)와 우리FIS 경유 그룹 공동 IT 지출 중복 여부 |
| 28 | KA52 | 토스증권 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KA27 조사파일(KA27-E13, 디지털데일리 2026-06-02 '토스증권, 몸집 커졌는데 보안 투자 비중은 뒷걸음')에 토스증권 정보기술부문 투자액 915억2461만원·정보보호 82억8927만원(공시연도 2026 → FY2025 추정) 기록 — 본 에이전트는 원문/검색결과 미확인으로 fact 미반영. 재검색 시 KA52 fact로 편입 필요; FY2025 영업수익·판관비·자산총계: 감사보고서(20260401004239) 원문 또는 보도로 확인 필요; KIS |
| 29 | KA37 | 대신증권(주) | MODEL_ESTIMATED | KISA_SEC_SCALED | 53 | FY2025 정보기술부문 투자액·비율, FY2024 투자 금액 KISA 원문 확인; FY2024 비율 8.2%는 순위 나열 요약 기반 — 본문 확인 필요; 차세대·클라우드·AI 계획, 코스콤 원장 의존 여부, 그룹 IT(대신 계열) 구조, LG U+ 거래 미조사 |
| 30 | KA11 | (주)신세계아이앤씨 | MODEL_ESTIMATED | KISA_IT_INVESTMENT | 58 | KISA 정보보호 공시 정보기술부문/정보보호부문 투자액·인력 FY2023-FY2025 (2024~2026 공시); 자체 DC/클라우드/AI 인프라 투자 발표(금액·MW·기간); 캡티브(계열사) 매출 비중 — 사업보고서 특수관계자 주석 또는 공정위 내부거래 보도 |
| 31 | KA49 | 엔에이치엔클라우드(주) | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | FY2025 매출·영업이익·자산(감사보고서); KISA FY2023~FY2025 정보기술/정보보호 투자액; 광주 국가AI데이터센터 운영 범위·GPU 규모·투자액, 판교 DC MW |
| 32 | KA45 | 페이스북 | NEEDS_REVIEW | ACCOUNT_SPECIFIC | 35 | 페이스북코리아 FY2025 매출(감사보고서 원문); Meta–LG U+ 현재 망 이용대가/캐시서버(FNA) 계약 여부와 규모; Meta 국내 캐시서버 위치(KT·SKB·LG U+ IDC) |
| 33 | KA17 | 현대엘리베이터 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 정보보호 공시(정보기술부문/정보보호부문 투자액 FY2023-2025) — 공시 원문 또는 보도 필요; MIRI 원격관제 연결 승강기 대수(=M2M 회선 잠재 수) 및 MOU 이전 회선 공급사; FY2025 연결 매출 감소(2.89조→2.47조) 원인: 연결범위 변경/중단영업 여부 |
| 34 | KA47 | (주)가비아 | INPUTS_VERIFIED | AUDIT_IT_COMPONENTS | 57 | KISA 정보보호 공시 의무 대상 여부 및 FY2023~FY2025 수치; 연결 자회사 구성(IDC 운영 자회사)과 FY2024 유형자산 2,104억 투자 내역; IDC 용량(MW)·회선 공급 통신사·LG U+ 관계 |
| 35 | KA15 | 지에스네오텍(주) | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 56 | FY2025 매출·영업이익·자산(감사보고서 rcept 20260401004517); IT(CDN/MSP) 부문 매출 비중; KISA 정보보호 공시 의무 대상 여부 및 수치 |
| 36 | KA44 | 차이나유니콤 | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 51 | 차이나유니콤오퍼레이션스코리아 FY2025 매출(감사보고서 원문); LG U+–China Unicom 국제회선/IP 트랜짓/로밍 정산 규모와 계약 주체; China Unicom 서울 PoP 위치(LG U+ IDC 여부) |
| 37 | KA34 | (주)아이비케이시스템 | MODEL_ESTIMATED | ACCOUNT_SPECIFIC | 56 | FY2025 매출·영업비용·자산총계: 감사보고서(20260330000475) 본문 열람 필요; 매출 중 IBK기업은행·계열사 비중(특수관계자 거래 주석); IBK기업은행이 53개 Key Account에 포함되는지(중복 위험) |
