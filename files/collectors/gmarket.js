// CartLog 주입 수집기 — 지마켓
// ⚠️ 자동 생성/분리된 파일. 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  NS.collectors.gmarket =   async function collectGmarket() {
    const { waitStable, getCategory } = window.__cartlog.helpers;
    await waitStable('.box__order-body, .box__pagination', 8000);
    await new Promise(r => setTimeout(r, 200));

    const result = [];
    const boxes = [...document.querySelectorAll('.box__order-body')];

    for (const box of boxes) {
      // 주문 단위 wrapper(.box__order-container): 날짜/상세URL은 형제인 .box__order-header에 있음
      const container = box.closest('.box__order-container');

      // 주문 날짜 (예: "2023.11.17" → "2023-11-17")
      // ※ .text__order-date는 box(.box__order-body) 밖(header)에 있으므로 container에서 탐색
      const dateRaw = (container || box).querySelector('.text__order-date')?.textContent.trim() || '';
      const dM = dateRaw.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
      const date = dM
        ? `${dM[1]}-${dM[2].padStart(2, '0')}-${dM[3].padStart(2, '0')}`
        : new Date().toISOString().slice(0, 10);

      // 주문번호 — .button-copy 내 .text__value
      let orderId = '';
      const copyBtn = box.querySelector('.button-copy .text__value');
      if (copyBtn) orderId = (copyBtn.textContent || '').replace(/[^\d]/g, '');
      // 폴백: data-pay-no 속성
      if (!orderId) orderId = box.getAttribute('data-pay-no') || '';
      if (!orderId) {
        orderId = 'gmarket_' + date.replace(/-/g, '') + '_' + Math.random().toString(36).slice(2, 6);
      }

      // 박스 단위 취소/반품 상태 (개별 상품마다 .box__order-status가 있을 수 있어 상품별로도 확인)
      const boxCancelled = !!box.querySelector('[data-component-display-order-status-enum="CancelCompleted"], [data-component-display-order-status-enum="ReturnCompleted"], [data-component-display-order-status-enum="ExchangeCompleted"]');

      // 상품 — .text__item-name 단위로 순회 (옵션 상품 포함)
      const nameEls = [...box.querySelectorAll('.text__item-name')];
      for (const nameEl of nameEls) {
        // 상품명: 브랜드 + 상품명 통합 텍스트
        const name = (nameEl.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 2) continue;

        // 상품 카드 컨텍스트: nameEl의 가장 가까운 상위 그룹
        // 가격/수량/옵션/URL/취소상태를 이 그룹 내에서 탐색
        let card = nameEl.closest('.box__item, .box__order-item, .box__goods, li, article') || nameEl.parentElement;
        // 부모를 올라가며 가격 element를 찾는 가장 작은 범위
        let scope = card;
        for (let i = 0; i < 5 && scope; i++) {
          if (scope.querySelector('.box__price .text__value')) break;
          scope = scope.parentElement;
        }
        if (scope) card = scope;

        // 가격 (.box__price .text__value 또는 .text__value 중 가격으로 보이는 것)
        let price = 0;
        const priceEl = card.querySelector('.box__price .text__value');
        if (priceEl) {
          price = parseInt((priceEl.textContent || '').replace(/[^\d]/g, '')) || 0;
        }
        if (!price) continue;

        // 옵션명: .list-item 모두 — "라벨: 값" 형식으로 상품명 뒤에 결합
        const optionParts = [...card.querySelectorAll('.list-item')].map(li => {
          const label = li.querySelector('.text__label')?.textContent.trim() || '';
          const value = li.querySelector('.text__value')?.textContent.trim() || '';
          if (!value) return '';
          // " (0원)" 같은 가격 표기 제거
          const cleanValue = value.replace(/\s*\(\s*[\d,]+\s*원\s*\)\s*$/, '').trim();
          return label ? `${label}: ${cleanValue}` : cleanValue;
        }).filter(Boolean);
        const fullName = optionParts.length > 0
          ? `${name} / ${optionParts.join(', ')}`
          : name;

        // URL — 카드 내 .link__order-detail (없으면 박스 단위)
        let url = '';
        // ※ .link__order-detail도 header(container)에 있으므로 container까지 폴백
        const linkEl = card.querySelector('.link__order-detail') || box.querySelector('.link__order-detail') || container?.querySelector('.link__order-detail');
        if (linkEl) {
          const href = linkEl.getAttribute('href') || '';
          if (href) url = href.startsWith('/') ? 'https://my.gmarket.co.kr' + href : href;
        }

        // 취소/반품 상태 — 상품 카드 내 status 우선, 없으면 박스 단위
        const cardCancelled = !!card.querySelector('[data-component-display-order-status-enum="CancelCompleted"], [data-component-display-order-status-enum="ReturnCompleted"], [data-component-display-order-status-enum="ExchangeCompleted"]');
        const statusText = card.querySelector('.text__status')?.textContent.trim() || '';
        const cancelled = cardCancelled || boxCancelled || /취소완료|반품완료|환불|교환완료/.test(statusText);

        // ※ 지마켓의 .box__price는 이미 수량이 반영된 총액이므로 곱하지 않음
        const item = {
          store: 'gmarket',
          name: fullName,
          price,
          date,
          orderId,
          url,
          category: cancelled ? '취소/반품' : getCategory(fullName),
          collectedAt: new Date().toISOString()
        };

        const key = item.orderId + '|' + item.name + '|' + item.price;
        if (!result.some(r => r.orderId + '|' + r.name + '|' + r.price === key)) {
          result.push(item);
        }
      }
    }

    return result;
  };
})();
