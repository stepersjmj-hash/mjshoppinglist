// CartLog 주입 수집기 — 네이버 + 네이버페이
// ⚠️ 자동 생성/분리된 파일. 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  async function collectNaver() {
    const { parseNaverDate, getCategory } = window.__cartlog.helpers;
    // 1. 이전내역 더보기 버튼 반복 클릭 — 카드 수 증가 감지로 즉시 진행
    let prevMoreCount = 0;
    while (true) {
      const moreBtn = document.querySelector('[class*="order_btn_more"]');
      if (!moreBtn) break;
      const cardsBefore = document.querySelectorAll('[class*="OrderProductBundle_order_card"]').length;
      moreBtn.click();
      for (let t = 0; t < 10; t++) {
        await new Promise(r => setTimeout(r, 200));
        if (document.querySelectorAll('[class*="OrderProductBundle_order_card"]').length > cardsBefore) break;
      }
      if (++prevMoreCount > 20) break;
    }
    if (prevMoreCount > 0) await new Promise(r => setTimeout(r, 150));

    // 2. 총 N건 주문 펼쳐보기 클릭 — 모든 버튼이 사라질 때까지 대기
    const expandBtns = [...document.querySelectorAll('[class*="OrderProductBundle_btn_expand"]')];
    if (expandBtns.length > 0) {
      expandBtns.forEach(btn => btn.click());
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 200));
        const remaining = document.querySelectorAll('[class*="OrderProductBundle_btn_expand"]').length;
        if (remaining === 0) break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    const result = [];
    let lastMainOrderId = null, lastMainDate = null, lastMainRawDate = null;

    document.querySelectorAll('[class*="OrderProductBundle_order_card"]').forEach(card => {
      const areas = card.querySelectorAll('[class*="OrderProductItem_product_area"]');
      if (!areas.length) return;

      // 취소 카드 제외
      const statusText = card.querySelector('[class*="OrderProduct_status"]')?.textContent.trim() || '';
      if (/취소|반품|환불|교환완료/.test(statusText)) return;

      // 첫 상품 정보로 카드 대표 orderId 생성
      const firstArea = areas[0];
      const firstDate = firstArea.querySelector('[class*="OrderProductItem_date"]')?.textContent.trim() || '';
      const firstName = firstArea.querySelector('[class*="OrderProductItem_name"]')?.textContent.trim() || '';
      const firstPrice = firstArea.querySelector('[class*="OrderProductItem_price_area"],[class*="OrderProductItem_price_info"]')?.textContent.replace(/[^0-9]/g, '') || '';
      const date0 = parseNaverDate(firstDate);

      // 추가상품 여부 — 날짜가 없거나 메인카드와 날짜가 같을 때만 추가상품으로 처리
      const isSupplementCard = !!card.querySelector('[class*="label_supplement"]')
        && (!firstDate || firstDate === lastMainRawDate);

      let cardOrderId, cardDate;
      if (isSupplementCard && lastMainOrderId) {
        cardOrderId = lastMainOrderId;
        cardDate = lastMainDate;
      } else {
        // rawDate(날짜+시간) 전체를 orderId로 사용 — 해시 충돌 방지
        cardOrderId = 'nv_' + firstDate.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_ㄱ-힣.:]/g, '');
        cardDate = date0;
        lastMainOrderId = cardOrderId;
        lastMainDate = cardDate;
        lastMainRawDate = firstDate;
      }

      areas.forEach(area => {
        const name = area.querySelector('[class*="OrderProductItem_name"]')?.textContent.trim() || '';
        const price = parseInt((area.querySelector('[class*="OrderProductItem_price_area"],[class*="OrderProductItem_price_info"]')?.textContent || '').replace(/[^0-9]/g, '')) || 0;
        if (!name || !price) return;
        const dateStr = area.querySelector('[class*="OrderProductItem_date"]')?.textContent.trim() || '';
        const rawDate = dateStr;
        const date = parseNaverDate(dateStr) || cardDate;
        const dateUnknown = !date;
        const url = area.querySelector('[class*="OrderProductItem_btn_detail"]')?.href || '';
        if (result.some(r => r.orderId === cardOrderId && r.name === name && r.price === price)) return;
        result.push({
          store: 'naver', name, price,
          date: date || 'DATE_UNKNOWN',
          orderId: cardOrderId, rawDate, url,
          dateUnknown: dateUnknown || date === 'DATE_UNKNOWN',
          category: getCategory(name),
          collectedAt: new Date().toISOString()
        });
      });
    });

    return result;
  }

  async function collectNaverPay() {
    const { getCategory } = window.__cartlog.helpers;
    const result = [];

    // 1. 접혀 있는 번들만 펼침 — 이미 펼쳐진 번들은 건드리지 않음(토글 역효과 방지)
    const getCollapsedBtns = () => [...document.querySelectorAll('[class*="PaymentBundleItem_button-expand"]')]
      .filter(btn => !btn.className.includes('is-expanded'));
    const toExpand = getCollapsedBtns();
    if (toExpand.length > 0) {
      toExpand.forEach(btn => btn.click());
      // 펼침이 완료될 때까지 폴링 (100ms × 최대 20회 = 최대 2초)
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (getCollapsedBtns().length === 0) break;
      }
      await new Promise(r => setTimeout(r, 200)); // 펼침 애니메이션 마무리 대기
    }

    // 2. 카드(PaymentItem_article) 단위로 수집 — 추가상품 포함
    //    시간 엘리먼트가 없는 추가상품 카드는 같은 번들(PaymentBundleItem_article)의 시간을 상속
    const processedCards = new Set();

    // 시간 엘리먼트에서 날짜 파싱하는 헬퍼
    const parseTime = (timeEl) => {
      if (!timeEl) return null;
      const rawDate = timeEl.textContent.replace(/결제일시/, '').replace(/결제\s*$/, '').trim();
      const dm4 = rawDate.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
      const dm2 = rawDate.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2}:\d{2})/);
      let date;
      if (dm4) {
        date = `${dm4[1]}-${dm4[2].padStart(2, '0')}-${dm4[3].padStart(2, '0')}`;
      } else if (dm2) {
        date = `${new Date().getFullYear()}-${dm2[1].padStart(2, '0')}-${dm2[2].padStart(2, '0')}`;
      } else {
        return null;
      }
      return { date, rawDate };
    };

    // 카드 1개를 result에 push (시간 정보는 외부에서 주입)
    const collectCard = (card, dateInfo) => {
      if (!card || processedCards.has(card)) return;
      processedCards.add(card);
      if (!dateInfo) return;

      // 상태 확인 — 취소/반품/환불/교환완료 제외
      const status = card.querySelector('[class*="OrderStatus_value"]')?.textContent.trim() || '';
      if (/취소|반품|환불|교환완료/.test(status)) return;

      // 상품명
      const name = card.querySelector('[class*="ProductNameHighlightByKeyword_article"]')?.textContent.trim() || '';
      if (!name || name.length < 2) return;

      // 가격 — "5,500원" 형식
      const priceText = card.querySelector('[class*="PaymentItem_price"]')?.textContent || '';
      const priceM = priceText.match(/([\d,]+)\s*원/);
      const price = priceM ? parseInt(priceM[1].replace(/,/g, '')) : 0;
      if (!price) return;

      // orderId: 날짜+시간 기반 (네이버쇼핑과 동일 방식)
      const orderId = 'nvp_' + dateInfo.rawDate.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.:]/g, '');

      const url = card.querySelector('a')?.href || '';

      if (result.some(r => r.orderId === orderId && r.name === name && r.price === price)) return;
      result.push({
        store: 'naver', name, price, date: dateInfo.date, orderId, url,
        category: getCategory(name),
        collectedAt: new Date().toISOString()
      });
    };

    // 2-1. 번들 단위로 처리 — 번들 내 메인 카드 시간을 추가상품 카드들이 공유
    for (const bundle of document.querySelectorAll('[class*="PaymentBundleItem_article"]')) {
      const bundleTimeEl = bundle.querySelector('[class*="PaymentItem_time"]');
      const dateInfo = parseTime(bundleTimeEl);
      if (!dateInfo) continue;
      const cards = bundle.querySelectorAll('[class*="PaymentItem_article"]');
      for (const card of cards) collectCard(card, dateInfo);
    }

    // 2-2. 번들 외부의 단일 카드 처리 — PaymentItem_time이 있지만 번들에 속하지 않는 케이스
    for (const timeEl of document.querySelectorAll('[class*="PaymentItem_time"]')) {
      // 번들 안에 있으면 이미 처리됨
      if (timeEl.closest('[class*="PaymentBundleItem_article"]')) continue;
      // 카드 컨테이너 찾기 — 시간 엘리먼트에서 상품명이 나올 때까지 위로 탐색
      let card = timeEl.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!card) break;
        if (card.querySelector('[class*="ProductNameHighlightByKeyword_article"]')) break;
        card = card.parentElement;
      }
      const dateInfo = parseTime(timeEl);
      collectCard(card, dateInfo);
    }

    return result;
  }

  NS.collectors.naver = collectNaver;
  NS.collectors.naverPay = collectNaverPay;
})();
