# 프로젝트: CartLog (크롬 확장프로그램)

## 개요
쿠팡, 네이버쇼핑, 11번가, 알리익스프레스 구매 내역을 자동 수집·관리하는 크롬 확장프로그램

## 파일 구조
```
mjshoppinglist/
├── CLAUDE.md
├── README.md
├── privacy.html
└── files/                  ← 크롬 확장프로그램 실제 파일 (이 폴더를 크롬에 로드)
    ├── manifest.json        ← 확장프로그램 설정
    ├── app.html             ← 메인 UI (categories.js → drivers/* → app.js 순서로 로드)
    ├── app.js               ← 메인 로직 (상태/UI/렌더링/동기화/백업 + 수집 진입점)
    ├── background.js        ← 백그라운드 스크립트
    ├── categories.js        ← 카테고리 분류 규칙
    ├── app.js.bak           ← 리팩토링 전 app.js 백업
    ├── drivers/             ← 팝업 측 "전체 수집" 드라이버 (확장 팝업에서 실행)
    │   ├── common.js        ← injectCollector, collectAllYears(11번가/네이버), 탭 대기 헬퍼
    │   ├── aliexpress.js    ← collectAllPagesAli + 상세 큐 처리(getAliDetailNames 등)
    │   ├── naver.js         ← collectNaverPayAll
    │   ├── kurly.js         ← collectAllKurly
    │   └── gmarket.js       ← collectAllGmarket
    ├── collectors/          ← 쇼핑몰 페이지에 주입되는 DOM 파서 (executeScript files 주입)
    │   ├── common.js        ← 공통 헬퍼(waitStable/parseDate/getCategory) + 디스패처 run()
    │   ├── coupang.js       ├ 쿠팡 (__NEXT_DATA__ 파싱)
    │   ├── naver.js         ├ 네이버 + 네이버페이
    │   ├── eleven.js        ├ 11번가
    │   ├── aliexpress.js    ├ 알리익스프레스
    │   ├── kurly.js         ├ 컬리
    │   └── gmarket.js       └ 지마켓
    └── icons/               ← 아이콘
```

### 수집 아키텍처 (분리 구조)
- **drivers/** — 확장 팝업에서 실행. 페이지 넘김·전체 기간 순회 등 오케스트레이션. `app.html`에서 `<script>`로 로드되어 전역 스코프를 공유한다(`app.js`의 `collectFromTab`/`collectAuto`가 호출).
- **collectors/** — 쇼핑몰 페이지의 isolated world에 주입되는 DOM 파서. `injectCollector`가 `categories.js` + `collectors/*.js`를 `executeScript({files})`로 주입한 뒤, `window.__cartlog.run(allPages)`를 호출해 URL에 맞는 파서를 실행한다. 각 파서는 `window.__cartlog.collectors`에 등록되고, 헬퍼는 `window.__cartlog.helpers`에서 가져온다.
- ⚠️ collectors는 `func:` 직렬화가 아닌 **파일 주입** 방식이므로 외부 파일을 참조할 수 있다(`categories.js`의 `classifyItem` 공유와 동일 원리).

## 주요 기능
- 쿠팡 / 네이버페이 / 11번가 / 알리익스프레스 주문 내역 자동 수집
- 목록 보기 (정렬, 검색, 필터) / 그래프 보기 (도넛 차트)
- 카테고리 자동 분류 및 수동 편집
- 알리익스프레스 USD → KRW 환율 자동 변환 (Frankfurter API)
- CSV 내보내기
- 구글 시트 연동 (Apps Script 웹앱)
- 개인화 태그 기능

## 기술 스택
- Vanilla JS (프레임워크 없음)
- Chrome Extension Manifest V3
- Chrome Storage (로컬 스토리지)
- Google Apps Script (시트 연동)
- Frankfurter API (환율)

## 코딩 규칙
1. 파일 수정 후 결과 출력하기 전에 검증하고 알려주기
2. 수정하기 전 수정 계획을 먼저 세우고 수정여부 확인 후 진행
3. 확실하지 않은 정보는 미리 알려주기
4. 작업 완료 후 작업내용 가이드(readme) 업데이트