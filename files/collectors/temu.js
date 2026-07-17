// CartLog 주입 수집기 — 테무
// ⚠️ 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  NS.collectors.temu = async function collectTemu() {
    const { getCategory } = window.__cartlog.helpers;
    await new Promise(r => setTimeout(r, 300));
    const result = [];

    // 1. 주문 ID 값("PO-185-...")을 단독 텍스트로 가진 가장 작은 element 찾기
    //    (클래스명이 난독화되어 있어 텍스트 패턴 기반으로 탐색)
    const idEls = [...document.querySelectorAll('span, div, p')]
      .filter(el => {
        const t = (el.textContent || '').trim();
        if (!/^PO-\d{2,4}-\d{8,}$/.test(t)) return false;
        return ![...el.children].some(c => /^PO-\d{2,4}-\d{8,}/.test((c.textContent || '').trim()));
      });

    // 2. 각 주문 ID를 기준으로 주문 박스 결정
    //    박스 = 다른 주문 ID를 포함하지 않는 가장 큰 ancestor (상품 슬라이드 포함 우선)
    const boxes = [];
    for (const idEl of idEls) {
      let chosen = null, lastSafe = null;
      let cur = idEl.parentElement;
      for (let i = 0; i < 20 && cur && cur !== document.body; i++) {
        const hasOther = idEls.some(e => e !== idEl && cur.contains(e));
        if (hasOther) break;
        lastSafe = cur;
        if (cur.querySelector('div[role="link"][aria-label]')) chosen = cur;
        cur = cur.parentElement;
      }
      // 슬라이드가 없어도 주문 요약(합계·날짜)만으로 수집할 수 있게 폴백
      if (chosen || lastSafe) boxes.push({ box: chosen || lastSafe, idEl });
    }

    for (const { box, idEl } of boxes) {
      const orderId = (idEl.textContent || '').trim();
      const boxText = (box.textContent || '').replace(/\s+/g, ' ');

      // 주문일 — "주문 시간: 2026년 1월 1일"
      const dM = boxText.match(/주문\s*시간\s*[:：]?\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      const date = dM
        ? `${dM[1]}-${dM[2].padStart(2, '0')}-${dM[3].padStart(2, '0')}`
        : new Date().toISOString().slice(0, 10);

      // 최종 가격 — "주문 합계 16,261원" (상품 합계가 아닌 주문 합계가 최종가)
      const tM = boxText.match(/주문\s*합계\s*([\d,]+)\s*원/);
      const total = tM ? parseInt(tM[1].replace(/,/g, '')) : 0;

      // 환불/취소 여부 — 상태 텍스트 기준 ("반품/환불" 버튼과 혼동되지 않도록 "완료" 필수)
      const cancelled = /(환불|반품|취소)\s*완료|주문\s*취소/.test(boxText);

      // 상품명 — 캐러셀 슬라이드의 aria-label (splide 클론 슬라이드 제외, 중복 제거)
      const slideDivs = [...box.querySelectorAll('li[class*="splide__slide"]:not([class*="clone"]) div[role="link"][aria-label]')];
      let names = [...new Set(slideDivs.map(d => (d.getAttribute('aria-label') || '').trim()).filter(n => n.length >= 2))];
      if (names.length === 0 && total > 0) names = ['(상품명 미확인)'];
      if (names.length === 0) continue;

      // 개별 상품 가격이 목록에 노출되지 않으므로 주문 합계를 균등 분배 (잔액은 첫 상품에)
      const base = Math.floor(total / names.length);
      const url = 'https://www.temu.com/bgt_order_detail.html?parent_order_sn=' + orderId;

      names.forEach((name, i) => {
        const price = i === 0 ? total - base * (names.length - 1) : base;
        const item = {
          store: 'temu',
          name,
          price,
          date,
          orderId,
          url,
          category: cancelled ? '취소/반품' : getCategory(name),
          collectedAt: new Date().toISOString()
        };
        const key = item.orderId + '|' + item.name + '|' + item.price;
        if (!result.some(r => r.orderId + '|' + r.name + '|' + r.price === key)) {
          result.push(item);
        }
      });
    }

    return result;
  };
})();
