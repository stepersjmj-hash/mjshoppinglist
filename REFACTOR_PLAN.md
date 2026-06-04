# 리팩토링 계획서 — 쇼핑몰별 파일 분리

> 상태: **계획 단계 (코드 미수정)**. 이 문서 검토 후 진행 여부를 결정합니다.
> 작성일: 2026-06-04 · 대상: `files/app.js` (현재 2,288줄, v3.0.2)

---

## 1. 목표

`app.js` 한 파일에 몰려 있는 쇼핑몰별 수집 로직을 **공통 모듈 + 쇼핑몰별 파일**로 분리해 유지보수성을 높인다. 동작은 **100% 보존**(behavior-preserving)한다.

---

## 2. 현재 구조와 핵심 제약

### 2-1. 쇼핑몰별 코드는 2계층에 존재

| 계층 | 실행 위치 | 함수 | 비고 |
|------|-----------|------|------|
| **주입 파서** | 쇼핑몰 페이지(isolated world) | `collect11st`, `collectCoupang`, `collectNaver`, `collectNaverPay`, `collectAliexpress`, `collectKurly`, `collectGmarket` | `runCollector` 내부에 중첩 |
| **팝업 드라이버** | 확장 팝업 | `collectAllYears`, `collectAllPagesAli`, `collectNaverPayAll`, `collectAllKurly`, `collectAllGmarket` | 페이지 넘김·전체수집 오케스트레이션 |

### 2-2. 핵심 제약 — 왜 단순 분리가 안 되는가

주입 파서는 `chrome.scripting.executeScript({ func: runCollector, args:[allPages] })`로 쇼핑몰 페이지에 주입된다. `func:` 주입은 함수를 **소스 문자열로 직렬화**하므로 외부 파일·스코프를 참조할 수 없다. → 그래서 모든 파서가 `runCollector` 안에 중첩되어 있다.

### 2-3. 해결의 단서 — 이미 검증된 패턴

`injectCollector`(app.js:771)는 `categories.js`를 **파일 주입**으로 먼저 넣는다:

```js
await chrome.scripting.executeScript({ target:{tabId}, files: ['categories.js'] });   // ① 파일 주입
await chrome.scripting.executeScript({ target:{tabId}, func: runCollector, args:[allPages] }); // ② func 주입
```

그리고 `runCollector` 내부 `getCategory`(app.js:1662)는 `categories.js`가 정의한 전역 `classifyItem`을 호출한다.

→ **이것이 동작한다는 사실**이 곧 "같은 isolated world에 주입된 여러 스크립트는 전역 스코프를 공유한다"는 증거다. 따라서 파서들을 **별도 파일로 분리해 `files:`로 주입**하면 분리가 가능하다.

> ⚠️ 불확실성: 이 전역 공유 동작은 categories.js 사례로 확인되지만, 분리 후 **실제 크롬에서 각 몰 1회 수집 테스트**로 최종 확인이 필요하다(샌드박스에서 주입 동작 테스트 불가).

---

## 3. 제안 파일 구조 (Phase 1 — 권장 범위)

```
files/
├── collectors/
│   ├── common.js       ← 공통 헬퍼 + 디스패처(run)
│   ├── coupang.js      ← 쿠팡
│   ├── naver.js        ← 네이버 + 네이버페이
│   ├── eleven.js       ← 11번가
│   ├── aliexpress.js   ← 알리익스프레스
│   ├── kurly.js        ← 컬리
│   └── gmarket.js      ← 지마켓
├── app.js              ← runCollector 본체 제거(주입 호출만 남김)
├── categories.js       (변경 없음)
└── ...
```

### 3-1. 네임스페이스 설계

전역 충돌을 막기 위해 `window.__cartlog` 하나로 묶는다.

```js
// common.js
window.__cartlog = window.__cartlog || {};
window.__cartlog.helpers   = { waitStable, parseDate, parseNaverDate, getCategory };
window.__cartlog.collectors = {};                 // 각 몰 파일이 여기에 등록
window.__cartlog.run = function (allPages) { /* URL 보고 디스패치 */ };
```

```js
// gmarket.js (예시)
window.__cartlog.collectors.gmarket = async function () {
  const { waitStable, getCategory } = window.__cartlog.helpers;
  ... // 기존 collectGmarket 본문 그대로
};
```

### 3-2. 함수 → 파일 매핑 (현재 줄 번호 기준)

| 새 파일 | 이동할 함수 (app.js 현재 위치) |
|---------|-------------------------------|
| `common.js` | `waitStable`(1263), `parseDate`(1279), `parseNaverDate`(1287), `getCategory`(1662), 디스패처 IIFE(945–964), 전역 초기화(`__collectAllPages`/`__collectResult`/`__shopCollecting`) |
| `eleven.js` | `collect11st`(967), `get11stProductUrl`(1004), `getTotalPages`(1033) |
| `coupang.js` | `collectCoupang`(1042) |
| `naver.js` | `collectNaver`(1076), `collectNaverPay`(1164) |
| `aliexpress.js` | `collectAliexpress`(1299) |
| `kurly.js` | `collectKurly`(1399) |
| `gmarket.js` | `collectGmarket`(1555) |

> `collectAliexpress`는 `window.__aliDetailQueue` 전역을 쌓고, 팝업의 `processAliDetailQueue`(app.js:834)가 이를 읽는다. 이 전역은 그대로 유지하므로 분리 영향 없음.

### 3-3. `injectCollector` 변경 (app.js:771)

```js
async function injectCollector(tabId, allPages) {
  await chrome.scripting.executeScript({ target:{tabId}, func: () => { window.__collectResult=null; window.__shopCollecting=false; } });
  await chrome.scripting.executeScript({ target:{tabId}, files: [
    'categories.js',
    'collectors/common.js',
    'collectors/coupang.js',
    'collectors/naver.js',
    'collectors/eleven.js',
    'collectors/aliexpress.js',
    'collectors/kurly.js',
    'collectors/gmarket.js',
  ]});
  await chrome.scripting.executeScript({ target:{tabId}, func: (p)=>window.__cartlog.run(p), args:[allPages] });  // 모든 파일 로드 후 실행
  const count = await pollCollectDone(tabId, 120000);
  await processAliDetailQueue(tabId);
  return count;
}
```

핵심: **모든 파일을 먼저 주입한 뒤** 마지막에 `run`을 호출 → 정의 누락 없음.

### 3-4. 매니페스트 영향

- `executeScript({files})` 주입은 `web_accessible_resources` 등록이 **불필요**하다(페이지가 로드하는 게 아니라 확장이 주입). 따라서 manifest.json 변경 없음.
- 단, 파일 경로(`collectors/*.js`)가 확장 패키지에 포함되기만 하면 된다.

---

## 4. Phase 2 (선택) — 팝업 드라이버 분리

`collectAllYears` 등 팝업 측 오케스트레이션도 몰별 파일로 분리 가능하나, 이들은 `showProgress`·`injectCollector`·`waitForTabContent` 등 **app.js 내부 함수에 다수 의존**한다. 분리하려면 이 공유 함수들을 `window`에 노출해야 해 **변경 범위·위험이 커진다.**

→ 권장: Phase 1을 먼저 적용·검증한 뒤, 필요 시 Phase 2를 별도 작업으로 진행.

---

## 5. 동작 보존 체크리스트

- [ ] 디스패처 URL 분기(app.js:949–957) 순서·조건 그대로 유지
- [ ] 각 파서 본문 **무수정 이동**(로직 변경 없음, 헬퍼 참조만 `window.__cartlog.helpers`로)
- [ ] `getCategory` → `classifyItem` 호출 경로 유지
- [ ] `window.__aliDetailQueue` 전역 유지
- [ ] `chrome.runtime.sendMessage({action:'itemsCollected'})` 위치·형식 유지
- [ ] `window.__collectResult` 완료 신호 형식 유지(`pollCollectDone` 호환)

---

## 6. 검증 계획

1. **문법 검사**: 분리된 모든 파일 `node --check` 통과
2. **파서 단위 시뮬레이션**: 제공 가능한 DOM 샘플로 jsdom 파싱 결과가 분리 전과 동일한지 비교(특히 지마켓 — 직전 수정 회귀 확인)
3. **정적 의존성 점검**: 각 파일이 참조하는 헬퍼가 `window.__cartlog.helpers`에 모두 존재하는지 grep 대조
4. **실제 크롬 테스트(사용자)**: 7개 몰 각 1회 수집 — 건수·날짜·카테고리·시트 동기화 정상 확인

> 2~3은 제가 샌드박스에서 수행. **4는 MJ님 확인 필수**(주입 런타임은 샌드박스에서 재현 불가).

---

## 7. 롤백 안전장치

- 작업 전 `app.js` → `app.js.bak` 백업 생성(또는 Git 커밋 권장)
- 문제 시 `app.html`/`injectCollector`를 원복하면 즉시 이전 동작 복구
- Phase 1은 `collectors/` 폴더 추가 + `app.js` 일부 축소뿐이라 영향 범위가 좁음

---

## 8. 진행 시 예상 작업 순서

1. `app.js` 백업
2. `collectors/common.js` 생성(헬퍼+디스패처)
3. 몰별 파일 6개 생성(본문 이동)
4. `app.js`에서 `runCollector` 본체 제거, `injectCollector` 수정
5. 문법 검사 + jsdom 시뮬레이션 검증
6. README·CLAUDE.md 구조도 업데이트
7. MJ님께 크롬 실테스트 요청

---

## 결정 필요

- **Phase 1만** 진행할지, **Phase 1+2** 모두 진행할지
- 백업 방식: `app.js.bak` 파일 백업 vs Git 커밋(샌드박스 git 금지 정책상, Git은 MJ님이 직접)
