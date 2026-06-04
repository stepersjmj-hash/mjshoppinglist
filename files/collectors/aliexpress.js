// CartLog 주입 수집기 — 알리익스프레스
// ⚠️ 자동 생성/분리된 파일. 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  NS.collectors.aliexpress =   async function collectAliexpress() {
    const { getCategory } = window.__cartlog.helpers;
    await new Promise(r => setTimeout(r, 300));
    const result = [];
    window.__aliDetailQueue = []; // 이름 없는 항목 → app.js에서 상세 탭으로 처리

    const priceTotals = [...document.querySelectorAll('[data-pl="order_item_content_price_total"]')];

    for (const priceEl of priceTotals) {
      // es--char 스팬 조합으로 가격 문자열 재구성
      const wrap = priceEl.querySelector('[class*="es--wrap"]');
      if (!wrap) continue;
      const rawPrice = [...wrap.querySelectorAll('[class*="es--char"]')].map(s => s.textContent).join('').trim();

      let price = 0, currency = 'KRW';
      if (/US\s*\$/.test(rawPrice)) {
        currency = 'USD';
        const m = rawPrice.replace(/US\s*\$/, '').match(/([\d.]+)/);
        price = m ? parseFloat(m[1]) : 0;
      } else if (/[₩￦]/.test(rawPrice)) {
        currency = 'KRW';
        const m = rawPrice.replace(/[₩￦,]/g, '').match(/(\d+)/);
        price = m ? parseInt(m[1]) : 0;
      } else {
        const m = rawPrice.replace(/,/g, '').match(/(\d+)/);
        price = m ? parseInt(m[1]) : 0;
      }
      if (!price) continue;

      // 주문 컨테이너
      let orderEl = priceEl.parentElement;
      for (let i = 0; i < 20; i++) {
        if (!orderEl) break;
        if (orderEl.textContent.includes('주문 ID:')) break;
        orderEl = orderEl.parentElement;
      }
      const ctText = (orderEl?.textContent || '').replace(/\s+/g, ' ');
      const orderIdM = ctText.match(/주문\s*ID[:\s]*(\d{10,})/);
      const orderId = orderIdM ? orderIdM[1]
        : 'ali_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const korDateM = ctText.match(/주문일[:\s]*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      const isoDateM = ctText.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
      const date = korDateM
        ? `${korDateM[1]}-${korDateM[2].padStart(2, '0')}-${korDateM[3].padStart(2, '0')}`
        : isoDateM
          ? `${isoDateM[1]}-${isoDateM[2].padStart(2, '0')}-${isoDateM[3].padStart(2, '0')}`
          : new Date().toISOString().slice(0, 10);
      const cancelled = /취소|cancel|refund|환불/i.test(
        orderEl?.querySelector('[class*="cancel"],[class*="Cancel"]')?.textContent || ''
      );

      // 상품 링크 + 이름 탐색
      let link = null, name = '', url = '';
      let container = priceEl.parentElement;
      for (let i = 0; i < 12 && container; i++) {
        const validLinks = [...container.querySelectorAll('a[href*="/item/"]')].filter(l => {
          const t = l.querySelector('span[title]')?.getAttribute('title')?.trim() || '';
          return t.length >= 5 && !/구매\s*시|할인|coupon/i.test(t);
        });
        if (validLinks.length === 1) {
          link = validLinks[0];
          const ns = link.querySelector('span[title]');
          name = ns?.getAttribute('title')?.trim() || ns?.textContent.trim() || '';
          break;
        }
        container = container.parentElement;
      }
      if (link) {
        url = link.getAttribute('href') || '';
        if (url.startsWith('//')) url = 'https:' + url;
        else if (url.startsWith('/')) url = 'https://www.aliexpress.com' + url;
      }

      // 옵션명(SKU) 있으면 상품명에 붙이기
      const sku = container?.querySelector('[data-pl="order_item_content_info_sku"]')?.textContent.trim() || '';
      if (sku && name) name = name + ' / ' + sku;

      if (name && name.length >= 5 && !/구매\s*시|할인|coupon/i.test(name)) {
        const key = orderId + '|' + name + '|' + price;
        if (!result.some(r => r.orderId + '|' + r.name + '|' + r.price === key)) {
          result.push({
            store: 'aliexpress', name, price, currency, date, orderId, url,
            category: cancelled ? '취소/반품' : getCategory(name),
            collectedAt: new Date().toISOString()
          });
        }
      } else {
        // 이름 없음 → 상세 페이지 큐에 추가
        const detailHref = orderEl?.querySelector('a[data-pl="order_item_header_detail"]')?.href || '';
        if (detailHref) {
          window.__aliDetailQueue.push({ orderId, price, currency, date, url, cancelled, detailHref });
        }
      }
    }

    window.__aliHasNext = false;
    return result;
  };
})();
