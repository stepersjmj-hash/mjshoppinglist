// CartLog 주입 수집기 — 11번가
// ⚠️ 자동 생성/분리된 파일. 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  async function collect11st() {
    const { waitStable, getCategory } = window.__cartlog.helpers;
    await waitStable('tbody tr', 8000);
    await new Promise(r => setTimeout(r, 200));
    const result = [];
    const rows = [...document.querySelectorAll('tbody tr')];
    let date = new Date().toISOString().slice(0, 10), orderId = '';
    for (const row of rows) {
      const txt = row.textContent.replace(/\s+/g, ' ').trim();
      if (txt.length < 10) continue;
      const dm = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dm) { date = `${dm[1]}-${dm[2]}-${dm[3]}`; const om = txt.match(/\((\d{10,})\)/); if (om) orderId = om[1]; }
      const pm = txt.match(/([\d,]+)원\s*\(\d+개\)/);
      if (!pm) continue;
      const price = parseInt(pm[1].replace(/,/g, ''));
      if (price <= 0) continue;
      const bp = txt.indexOf(pm[0]);
      let name = '';
      if (txt.includes('상세보기')) name = txt.slice(txt.indexOf('상세보기') + 4, bp).trimStart().split(/\s*선택:|\s*옵션명\s+\d|\s+지점:/)[0].trim();
      else if (txt.includes('주문내역삭제')) name = txt.slice(txt.indexOf('주문내역삭제') + 6, bp).trimStart().split(/\s+지점:|\s*선택:|\s*옵션명\s+\d/)[0].trim();
      else { let base = txt.slice(0, bp).split(/옵션명\s+\d/)[0].trim().split(/\s*선택:/)[0].trim(); const om = txt.match(/(?:.*옵션명\s+\d+:.)(.+?)\s+[\d,]+원/); name = om ? base + ' / ' + om[1].trim() : base; }
      if (!name || name.length < 2) continue;
      const cancelled = /주문내역삭제|주문취소|취소완료|반품|환불|교환/.test(txt);
      const url = await get11stProductUrl(row);
      const item = {
        store: '11st', name, price, date, url,
        orderId: orderId || String(Math.abs(name.split('').reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0))),
        category: cancelled ? '취소/반품' : getCategory(name),
        collectedAt: new Date().toISOString()
      };
      if (!result.some(r => r.orderId + '|' + r.name + '|' + r.price === item.orderId + '|' + item.name + '|' + item.price))
        result.push(item);
    }
    window.__totalPages = getTotalPages();
    return result;
  }

  async function get11stProductUrl(row) {
    // 팝업을 여는 트리거: 상품명 링크/버튼 (onclick 또는 class 기준)
    const trigger = row.querySelector(
      'a[onclick], button[onclick], [class*="prdName"] a, [class*="prod_name"] a, [class*="goodsName"] a, td.goods a, td.product a'
    );
    if (!trigger) return '';
    trigger.click();
    // 팝업이 나타날 때까지 대기 (최대 2초)
    const popup = await new Promise(resolve => {
      const deadline = Date.now() + 2000;
      const tick = setInterval(() => {
        const el = [...document.querySelectorAll(
          '[class*="layer"], [class*="popup"], [class*="modal"], [class*="dialog"]'
        )].find(el => /상품번호/.test(el.textContent) && el.offsetParent !== null);
        if (el || Date.now() > deadline) { clearInterval(tick); resolve(el || null); }
      }, 80);
    });
    if (!popup) return '';
    const m = popup.textContent.match(/상품번호[^\d]*(\d{7,})/);
    // 팝업 닫기
    const closeBtn = popup.querySelector(
      '[class*="close"], [class*="btn_close"], button[title*="닫"], a[title*="닫"]'
    );
    if (closeBtn) closeBtn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    return m ? `https://www.11st.co.kr/products/${m[1]}` : '';
  }

  function getTotalPages() {
    const pager = document.querySelector('.s_paging,.paging,[class*="paging"]');
    if (!pager) return 1;
    const curPage = parseInt(pager.querySelector('strong')?.textContent.trim()) || 1;
    const nums = [...pager.querySelectorAll('a')].map(a => parseInt(a.textContent.trim())).filter(n => !isNaN(n) && n > 0);
    return nums.length > 0 ? Math.max(...nums, curPage) : curPage;
  }

  NS.collectors['11st'] = collect11st;
})();
