# CartLog — 크롬 확장프로그램

쿠팡, 네이버페이(네이버쇼핑 포함), 11번가, 알리익스프레스, 컬리, 지마켓, 테무 구매 내역을 자동으로 수집하고 한 곳에서 관리하는 크롬 확장프로그램입니다.

## 주요 기능

- 쿠팡 / 네이버페이 / 11번가 / 알리익스프레스 / 컬리 / 지마켓 / 테무 주문 내역 자동 수집
- 목록(정렬·검색·필터) / 그래프(카테고리 도넛 차트)
- 카테고리 자동 분류 · 수동 편집 · 전체 재분류
- 알리익스프레스 **USD → KRW 환율 자동 변환** (Frankfurter API)
- **구글 시트 양방향 연동** — 업로드 + 시트에서 되가져오기 (v3.0.0)
- **JSON 백업 / 복원** — 내역·규칙·카테고리·환율 캐시 (v3.0.0)
- CSV 내보내기 / 개인화 태그

---

## 설치 방법

### 1단계 — 파일 다운로드
[최신 Releases](https://github.com/JooMyungjin/mjshoppinglist/releases) 파일(mj-shopping-list-v0.0.0.zip
)을 다운로드 받습니다.

`files` 폴더를 로컬에 저장합니다 (zip 압축 해제 또는 폴더 복사).


### 2단계 — 크롬 확장프로그램 로드

<img width="492" height="158" alt="image" src="https://github.com/user-attachments/assets/9454a899-5e00-4dfb-b3bc-a90aafa35c0a" />


1. 크롬 주소창에 `chrome://extensions/` 입력
2. 우측 상단 **개발자 모드** 토글 ON
3. **압축 해제된 확장 프로그램 로드** 클릭
4. `files` 폴더 선택

설치 완료 후 크롬 우측 상단 퍼즐 아이콘(🧩) → **CartLog** 고정하면 편리합니다.

---

## 기본 사용법

### 상품 수집

1. 쿠팡 / 네이버페이 / 11번가 / 알리익스프레스 / 컬리 / 지마켓 / 테무 주문 내역 페이지를 엽니다
2. 확장프로그램 아이콘 클릭
3. **▶ 현재 탭에서 가져오기** — 현재 페이지의 주문 내역 수집
4. **⟳ 전체 기간 자동 수집** — 페이지를 넘기며 전체 내역 자동 수집

> 각 사이트별 주문 내역 페이지 경로
> - 쿠팡: 마이쿠팡 > 주문목록
> - 네이버페이:
>   - 쇼핑 주문내역 (`orders.pay.naver.com`)
>   - 네이버페이 구매내역 (`pay.naver.com/pc/history`)
> - 11번가: MY11ST > 주문내역
> - 알리익스프레스: My Orders > 주문내역
> - 컬리: 마이컬리 > 주문내역 (`kurly.com/mypage/order`)
> - 지마켓: 마이쇼핑 > 주문목록 (`my.gmarket.co.kr/ko/pc/list/all`)
> - 테무: 계정 > 주문 내역 (`temu.com/kr/bgt_orders.html`)

### 목록 보기 / 그래프 보기

수집 후 상단의 **목록** / **그래프** 버튼으로 전환합니다.

- **목록**: 날짜·금액 기준 정렬, 상품명 검색, 카테고리·날짜·금액·쇼핑몰 필터
- **그래프**: 카테고리별 도넛 차트 및 금액 현황 (현재 필터 기준)

### 필터 사용

| 필터 | 설명 |
|------|------|
| 쇼핑몰 칩 | 쿠팡 / 네이버페이 / 11번가 / 알리 / 컬리 / 지마켓 / 테무 선택 |
| 카테고리 칩 | 식품, 생활, 패션 등 카테고리 선택 |
| 날짜 범위 | `20240101` ~ `20241231` 형식으로 기간 입력 |
| 금액 범위 | 최소·최대 금액 설정 |
| 상품명 검색 | 키워드 입력 시 실시간 필터 |

> 상단 통계(총 주문 / 이번달 주문 / 총 금액)는 현재 필터 조건에 맞춰 실시간으로 변경됩니다.

### 목록 주요 기능

- **상품명 툴팁**: 긴 상품명에 마우스 오버 시 전체 이름 표시
- **주문상세 링크**: 날짜 옆 `(주문상세)` 클릭 시 해당 쇼핑몰 주문상세 페이지로 이동 (새 창)
- **개별 상품 삭제**: 각 상품 행 앞의 `×` 버튼으로 해당 상품만 삭제
- **카테고리 수정**: 카테고리 뱃지 클릭 → 직접 입력
- **태그 추가**: `+` 버튼으로 개인화 태그 추가, `×`로 삭제

### 알리익스프레스 USD 환율 변환

알리익스프레스 달러 상품은 **주문 당시 날짜 기준 환율**로 자동 원화 변환됩니다.

- 가격은 원화로 표시, 마우스 오버 시 원달러 금액 툴팁 표시
- 환율 데이터: [Frankfurter API](https://www.frankfurter.app) (ECB 기준)
- 변환된 원화 금액은 구글 시트 동기화 시에도 반영됩니다 (셀 노트에 달러 원가 표시)

### 카테고리 관리

| 기능 | 설명 |
|------|------|
| 카테고리 뱃지 클릭 | 개별 항목 직접 수정 (수동 편집으로 기록) |
| 🔄 전체 카테고리 재분류 | 수동 편집 제외, categories.js 기준으로 전체 재분류 |
| 분류 규칙 | 키워드별 카테고리 직접 등록, 우선 적용 |

### 쇼핑몰별 데이터 초기화

설정 패널 하단 각 쇼핑몰 옆 `×` 버튼으로 해당 쇼핑몰 데이터만 선택 삭제할 수 있습니다.

### CSV 내보내기

하단 **CSV** 버튼 → 현재 필터 기준으로 다운로드

---

## 구글 시트 연동 (선택)

수집한 데이터를 구글 스프레드시트에 자동 저장할 수 있습니다.
연동하면 **날짜 / 상품명 / 가격 / 카테고리 / 태그 / 쇼핑몰 / 주문번호** 7개 컬럼으로 시트에 기록됩니다.

---

### 1단계 — 구글 스프레드시트 생성

1. [Google Sheets](https://sheets.google.com) 접속 후 **새 스프레드시트** 생성
2. 시트 이름은 자유롭게 설정 (연동 시 별도로 지정 가능)

---

### 2단계 — Apps Script 작성

1. 스프레드시트 상단 메뉴 **확장 프로그램 → Apps Script** 클릭
2. 기본으로 작성된 코드를 전부 지우고 아래 코드를 붙여넣기

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(data.sheetName || '구매내역');
    if (!sheet) sheet = ss.insertSheet(data.sheetName || '구매내역');

    const header = ['날짜', '상품명', '가격(원)', '카테고리', '개인화태그', '쇼핑몰', '주문번호'];

    // 헤더 (시트가 비어있을 때만)
    if (sheet.getLastRow() === 0) {
      const headerRange = sheet.getRange(1, 1, 1, header.length);
      headerRange.setValues([header]);
      headerRange.setBackground('#1a1a2e');
      headerRange.setFontColor('#a89df5');
      headerRange.setFontWeight('bold');
    }

    // 기존 데이터에서 중복 키 수집 (orderId|상품명)
    const existingKeys = new Set();
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, header.length).getValues().forEach(row => {
        existingKeys.add(row[6] + '|' + row[1]);
      });
    }

    // 기존에 없는 항목만 추출
    const newItems = data.items.filter(i =>
      !existingKeys.has((i.orderId || '') + '|' + (i.name || ''))
    );

    const rows = newItems.map(i => [
      i.date || '',
      i.url ? `=HYPERLINK("${i.url}","${(i.name || '').replace(/"/g, '""')}")` : (i.name || ''),
      i.currency === 'USD' ? (i.priceKrw || i.price || 0) : (i.price || 0),
      i.category || '',
      (i.tags || []).join(', '),
      i.store || '',
      i.orderId || ''
    ]);

    if (!rows.length) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, count: 0, added: 0 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, header.length).setValues(rows);

    // 주문번호별 색상 그룹핑
    // 같은 주문번호 = 옵션 상품 포함 → 같은 배경색
    const GROUP_COLORS = [
      '#ffffff', // 흰색 (단일 주문)
      '#eef2ff', // 연보라
      '#fef9ee', // 연노랑
      '#eefaf4', // 연초록
      '#fef0f0', // 연빨강
      '#f0f8ff', // 연파랑
    ];

    // 주문번호별 등장 순서 매핑
    const orderColorMap = {};
    let colorIdx = 0;
    const orderCount = {};

    // 먼저 각 주문번호 등장 횟수 카운트
    rows.forEach(row => {
      const orderId = row[6];
      orderCount[orderId] = (orderCount[orderId] || 0) + 1;
    });

    // 색상 할당 (2개 이상인 주문번호만 색상 부여, 순차 반복)
    let multiColorIdx = 0;
    rows.forEach(row => {
      const orderId = row[6];
      if (orderColorMap[orderId] === undefined) {
        if (orderCount[orderId] > 1) {
          // 여러 옵션 있는 주문 → 순차 색상 (1번부터)
          multiColorIdx = (multiColorIdx % (GROUP_COLORS.length - 1)) + 1;
          orderColorMap[orderId] = GROUP_COLORS[multiColorIdx];
        } else {
          orderColorMap[orderId] = GROUP_COLORS[0]; // 단일 주문 = 흰색
        }
      }
    });

    // 행별 배경색 적용
    rows.forEach((row, i) => {
      const orderId = row[6];
      const color = orderColorMap[orderId] || GROUP_COLORS[0];
      sheet.getRange(startRow + i, 1, 1, header.length).setBackground(color);
    });

    // 취소/반품 행 가격 취소선
    rows.forEach((row, i) => {
      if (row[3] === '취소/반품') {
        sheet.getRange(startRow + i, 3).setFontLine('line-through');
      }
    });

    // USD 아이템 원달러 가격 셀 노트
    newItems.forEach((item, i) => {
      if (item.currency === 'USD' && item.price) {
        sheet.getRange(startRow + i, 3).setNote(`US $${Number(item.price).toFixed(2)}`);
      }
    });

    // 열 너비 자동 조정
    sheet.autoResizeColumns(1, header.length);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, count: data.items.length, added: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 시트 → 확장프로그램으로 되가져오기 (양방향 연동)
function doGet(e) {
  try {
    const sheetName = (e.parameter && e.parameter.sheetName) || '구매내역';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, items: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const header = ['날짜','상품명','가격(원)','카테고리','개인화태그','쇼핑몰','주문번호'];
    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length);
    const values = range.getValues();
    const formulas = range.getFormulas(); // HYPERLINK 셀에서 URL·이름 복구

    const hyperRe = /^=HYPERLINK\("([^"]+)",\s*"(.*)"\)$/;
    const items = values.map((row, i) => {
      let name = row[1];
      let url = '';
      const f = formulas[i][1];
      const m = f && f.match(hyperRe);
      if (m) { url = m[1]; name = m[2].replace(/""/g, '"'); }
      return {
        date: String(row[0] || ''),
        name: name || '',
        price: Number(row[2]) || 0,
        category: row[3] || '',
        tags: row[4] ? String(row[4]).split(',').map(s => s.trim()).filter(Boolean) : [],
        store: row[5] || '',
        orderId: String(row[6] || ''),
        url: url
      };
    });
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, items: items }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```


3. **저장** (Ctrl+S 또는 ⌘S)

> **기존 사용자 안내** — 이미 구글 시트 연동을 쓰고 계신 경우, 위 스크립트의 `doGet` 함수 부분을 추가한 뒤 Apps Script 편집기에서 **배포 → 배포 관리 → ✏ 수정 → 버전: 새 버전 → 배포** 순서로 재배포하면 기존 웹 앱 URL이 그대로 유지됩니다. (새 배포를 누르면 URL이 바뀌어 확장프로그램에 다시 등록해야 합니다.)

---

### 3단계 — 웹 앱으로 배포

1. Apps Script 편집기 우측 상단 **배포 → 새 배포** 클릭
2. 설정값 확인
   - 유형: **웹 앱**
   - 다음 사용자로 실행: **나**
   - 액세스 권한: **모든 사용자**
3. **배포** 클릭
4. Google 계정 권한 허용 팝업이 뜨면
   - **고급** 클릭 → **안전하지 않은 페이지로 이동** 클릭 → **허용**
5. 배포 완료 후 표시되는 **웹 앱 URL** 복사
   - 형태: `https://script.google.com/macros/s/.../exec`

> **코드 수정 후 재배포 시** 반드시 **새 배포** 가 아닌 **배포 관리 → 수정** 으로 진행해야 기존 URL이 유지됩니다.

---

### 4단계 — 확장프로그램에 연결

1. 확장프로그램 하단 설정 패널 열기
2. **Apps Script 웹 앱 URL** 입력란에 복사한 URL 붙여넣기
3. **시트 이름** 입력 (비워두면 기본값 `구매내역` 사용)
4. **저장 및 연결** 클릭 → 상단에 **시트 연결됨** 표시 확인

---

### 동기화 방법

| 방법 | 설명 |
|------|------|
| 수동 동기화 | 하단 **구글 시트 동기화** 버튼 클릭 → 전체 데이터 전송 |
| 자동 동기화 | 설정에서 **자동 동기화** 토글 ON → 수집할 때마다 자동 전송 |

- 중복 데이터는 주문번호 기준으로 자동 필터링되어 중복 저장되지 않습니다.
- 시트가 없으면 자동으로 생성하고 헤더 행을 추가합니다.

---

### ⬇ 시트에서 불러오기 (양방향 연동, v3.0.0+)

다른 PC에서 쌓은 기록이나 시트에서만 추가한 내역을 **확장프로그램으로 되가져오는** 기능입니다.

1. 설정 패널 → **⬇ 시트에서 불러오기** 클릭
2. 확인 팝업에서 승인 → 시트의 전체 행을 읽어와 현재 목록과 자동 병합
3. 완료 후 토스트에 `✓ N건 추가 (중복 M건 제외)` 표시

- 중복 판단 기준: `주문번호 | 상품명 | 가격` (네이버페이는 `상품명 | 가격 | 날짜` 추가 비교)
- Apps Script의 **`doGet` 함수가 반드시 포함**되어 있어야 동작합니다. 2단계 스크립트를 최신 버전으로 덮어쓰고 재배포해주세요.
- 시트에는 원화 가격만 저장되므로, 불러온 알리 항목은 **원달러 원가가 복원되지 않고 원화 금액으로만 표시**됩니다 (셀 노트의 `US $xx.xx` 정보는 복원 대상이 아닙니다).

---

## 백업 / 복원 (JSON, v3.0.0+)

구글 시트 연동 없이도 전체 데이터를 파일로 백업/이관할 수 있습니다.

### 📦 백업 내보내기

설정 패널 → **📦 백업 내보내기 (JSON)** 클릭 → `cartlog-backup_YYYY-MM-DD.json` 다운로드

백업 파일에 포함되는 항목:
- 구매 내역 전체 (`items`)
- 카테고리 분류 규칙 (`rules`)
- 커스텀 카테고리 (`customCategories`)
- 환율 캐시 (`rateCache`)

> **PC별로 유지되는 값**(백업에 포함되지 않음): Apps Script 웹 앱 URL, 시트 이름, 자동 동기화 토글, 다크/라이트 테마.

### 📥 백업 불러오기

설정 패널 → **📥 백업 불러오기 (JSON)** 클릭 → 백업 파일 선택

선택 시 팝업이 뜨며 두 가지 옵션을 고를 수 있습니다.

| 선택 | 가져오는 항목 |
|------|---------------|
| **확인 — 모두 가져오기** | 구매내역 + 규칙 + 커스텀 카테고리 + 환율 캐시 |
| **취소 — 구매내역만** | 구매내역만 (기존 규칙·카테고리 설정 유지) |

- 구매 내역은 중복 제거 후 병합됩니다 (기존 항목은 그대로 유지).
- 규칙·커스텀 카테고리는 이미 존재하는 키워드/이름은 건너뛰고 새로운 항목만 추가합니다.
- 환율 캐시는 기존 캐시에 날짜별로 병합됩니다.

---

## 주의사항

- 개발자 모드로 설치한 확장프로그램은 크롬 업데이트 후 간헐적으로 비활성화될 수 있습니다. 비활성화 시 `chrome://extensions/`에서 다시 활성화하세요.
- 수집된 데이터는 브라우저 로컬 스토리지에 저장됩니다. **초기화** 버튼 클릭 시 전체 삭제되므로 주의하세요.
- 구글 시트 연동 없이도 CSV 또는 JSON 백업으로 데이터를 보관할 수 있습니다.

---

## 수정 기록

### 테무 "더 보기" 버튼 오클릭 수정 (2026-07-15)

- **증상**: 테무 전체 기간 자동 수집이 주문을 더 불러오지 못함.
- **원인**: `/더\s*보기/` 패턴에 버튼이 **2개** 걸림 — 주문 목록의 "더 보기"와 페이지 하단 추천상품 영역(`js-goods-list`)의 "더보기". 기존 로직은 텍스트가 짧은 쪽을 우선해 추천상품 "더보기"(3글자)를 잘못 클릭함.
- **수정** (`drivers/temu.js`): 마지막 주문 ID(`PO-...`) 요소 **뒤(document order)에 오면서** `.js-goods-list` 밖인 첫 번째 버튼만 클릭하도록 변경.
- 검증(실제 테무 계정 주문 페이지): 10건 → 클릭마다 +5~10건 → 전체 25건 로드 후 버튼 소멸 감지로 정상 종료. 파서도 실제 25건 전 주문에서 주문일·주문 합계·환불 상태 정확히 추출 확인.

### 전체 자동 수집 오류 무반응 수정 (2026-07-15)

- **증상**: "전체 기간 자동 수집" 클릭 시 오류가 발생해도 아무 반응 없이 조용히 종료됨 (진행바·토스트 없음).
- **원인**: `collectAuto`가 `try/finally`만 있고 `catch`가 없어 드라이버 오류가 화면에 표시되지 않고 콘솔에만 남음. 특히 manifest에 새 쇼핑몰 권한이 추가된 직후 확장을 새로고침하지 않으면 `executeScript` 주입이 거부되는데, 이 오류도 무반응으로 보였음.
- **수정** (`app.js`): `collectAuto`에 `catch` 추가 — 오류를 토스트(`❌ 오류: ...`)로 표시하고 진행바 정리.
- ⚠️ manifest 권한이 바뀐 버전으로 올릴 때는 `chrome://extensions`에서 **확장 새로고침 필수** (테무 v3.2.0 포함).

### 테무 수집 추가 (2026-07-15, v3.2.0)

- **테무(temu.com) 주문 내역 수집 지원** — 신규 파일 `collectors/temu.js` + `drivers/temu.js`.
- 주문 목록 페이지(`temu.com/kr/bgt_orders.html`)에서 주문 박스 단위로 파싱:
  - 주문번호(`PO-...`) / 주문일(`주문 시간: YYYY년 M월 D일`) / 최종가(**주문 합계** — 상품 합계 아님)를 텍스트 패턴 기반으로 추출 (클래스명이 난독화되어 있어 클래스 미의존).
  - 상품명은 주문 박스 내 캐러셀 슬라이드의 `aria-label`에서 추출.
  - "환불 완료" 등 환불/취소 주문은 `취소/반품` 카테고리로 분류 (통계 합계에서 제외).
- ⚠️ **개별 상품 가격 미제공**: 테무 목록 페이지는 주문 합계만 노출 → 주문 합계를 상품 수로 균등 분배(잔액은 첫 상품에)해 기록. 주문 단위 합계는 정확하지만 **개별 상품 가격은 추정치**.
- 전체 기간 자동 수집: 페이지 하단 **"더 보기"** 버튼을 주문 수 증가 감지 기반으로 반복 클릭 후 일괄 수집.
- 주문상세 링크: `temu.com/bgt_order_detail.html?parent_order_sn=주문번호`.
- 검증: 전 파일 문법 검사(node --check) + manifest JSON 파싱 통과. ⚠️ 크롬 실환경(실제 테무 주문 페이지) 수집 테스트 필요.

### 알리익스프레스 취소 주문 수집 제외 (2026-07-15)

- **증상**: 취소된 알리 주문이 일반 주문처럼 수집됨 (취소/반품 분류도 안 됨).
- **원인**: 취소 판정이 `class*="cancel"` 요소 탐색 방식인데, 현재 알리 페이지에는 해당 요소가 없음. 취소 상태는 헤더의 `.order-item-header-status-text`(= `data-pl="order_item_header_status"`)에 "취소" 텍스트로 표시됨.
- **수정** (`collectors/aliexpress.js`): 헤더 상태 텍스트(`data-pl="order_item_header_status"`, 기존 class 방식은 폴백)에 취소/환불 문구가 있으면 **해당 주문을 수집 자체에서 제외** (기존 '취소/반품' 분류 방식에서 변경 — 알리만 해당, 다른 몰은 기존 동작 유지).
- 검증: 실제 알리 주문 페이지 10건 실행 → 상태 "취소" 주문 1건만 정확히 제외, 나머지 9건 정상 수집.

### 알리익스프레스 주문번호·주문일 파싱 수정 (2026-07-15)

- **증상**: 알리 수집 시 모든 주문의 날짜가 수집일(UTC 기준 하루 전)로 동일하게 기록되고, 주문상세 링크가 `orderId=ali_...` 형태로 깨져 열리지 않음.
- **원인**: 알리 주문 목록 페이지 문구 변경 — `주문 ID:` → `주문번호::`, `주문일:` → `주문일자::`. 텍스트 매칭 실패 시 폴백(랜덤 ID + 오늘 날짜)이 동작한 것.
- **수정** (`collectors/aliexpress.js`):
  - 주문 컨테이너 탐색을 텍스트 대신 `a[data-pl="order_item_header_detail"]`(상세보기 링크) 포함 여부로 변경 (기존 텍스트 방식은 폴백 유지).
  - 주문번호는 상세보기 링크의 `?orderId=` 파라미터에서 우선 추출 — 문구 변경에 영향받지 않음.
  - 날짜 정규식을 `주문일자?` + 콜론 개수 무관(`::` 포함)으로 확장.
- 검증: 실제 알리 주문 페이지에서 새 로직 실행 → 주문 10건 모두 헤더 표시 주문번호와 일치, 실제 주문일자 정상 추출.
- ⚠️ **기존 잘못 수집된 항목은 자동 교정되지 않음**: 중복 판정 키가 주문번호 기반이라, 잘못 들어간 알리 항목을 목록에서 삭제(× 버튼)한 뒤 재수집해야 합니다.

### 수집 코드 리팩토링 — 쇼핑몰별 파일 분리 (2026-06-04)

- 단일 `app.js`(약 2,288줄)에 몰려 있던 쇼핑몰별 수집 로직을 **공통 모듈 + 쇼핑몰별 파일**로 분리(동작 보존).
- **`collectors/`** — 쇼핑몰 페이지에 주입되는 DOM 파서. `common.js`(헬퍼+디스패처) + 몰별 6개(coupang/naver/eleven/aliexpress/kurly/gmarket). `window.__cartlog` 네임스페이스로 등록·실행.
- **`drivers/`** — 확장 팝업 측 전체수집 오케스트레이션. `common.js` + aliexpress/naver/kurly/gmarket.
- `injectCollector`가 `func:` 직렬화 주입 → **`files:` 파일 주입** 방식으로 변경(`categories.js`가 이미 쓰던 검증된 패턴).
- `app.js`는 약 954줄로 축소(상태/UI/렌더링/동기화/백업 + 수집 진입점만 유지). 리팩토링 전 원본은 `files/app.js.bak`에 백업.
- 검증: 전 파일 문법 검사(node --check) 통과, 등록 키↔디스패처 일치 확인, 분리된 `common.js`+`gmarket.js`를 공유 컨텍스트에 로드해 실제 실행 시뮬레이션 통과(날짜/URL/카테고리 정상).
- ⚠️ **크롬 실환경 최종 확인 필요**: 주입 런타임은 자동 검증 불가 → 7개 몰 각 1회 수집 테스트 권장.

### 지마켓 주문일·상세 URL 파싱 수정 (2026-06-04)

- **증상**: 지마켓 수집 시 모든 상품의 주문일이 수집한 날짜로 동일하게 기록됨.
- **원인**: 지마켓 페이지에서 주문일(`.text__order-date`)과 상세 링크(`.link__order-detail`)는 `.box__order-header`에 있는데, 수집 코드는 형제 요소인 `.box__order-body` 내부만 탐색해 값을 찾지 못하고 날짜는 "오늘 날짜"로 폴백됨.
- **수정**: `collectGmarket`에서 `.box__order-container`(주문 1건 wrapper)까지 올라가 주문일과 상세 URL을 읽도록 변경. 한 주문에 여러 상품이 있어도 같은 주문일을 정확히 공유하고, 상품 링크가 실제 상세 페이지로 연결됨.
