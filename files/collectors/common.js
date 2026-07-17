// CartLog 주입 수집기 — 공통 (헬퍼 + 디스패처)
// ⚠️ 자동 생성/분리된 파일. 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  // ── 공통 헬퍼 ──
  function waitStable(sel, timeout) {
    return new Promise(resolve => {
      let last = 0, stable = 0, timer = null;
      const check = () => {
        const n = document.querySelectorAll(sel).length;
        if (n >= 2 && n === last) { stable++; if (stable >= 2 && !timer) timer = setTimeout(resolve, 100); }
        else { last = n; stable = 0; if (timer) { clearTimeout(timer); timer = null; } }
      };
      const iv = setInterval(check, 100);
      const ob = new MutationObserver(check);
      ob.observe(document.body, { childList: true, subtree: true });
      check();
      setTimeout(() => { clearInterval(iv); ob.disconnect(); resolve(); }, timeout);
    });
  }

  function parseDate(str) {
    if (!str) return new Date().toISOString().slice(0, 10);
    const m = str.match(/(\d{4})[.\-년]\s*(\d{1,2})[.\-월]\s*(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }

  function parseNaverDate(str) {
    if (!str) return null;
    // 4자리 연도 패턴 먼저 체크 (2025.12.27.)
    const m2 = str.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
    // 월.일. 패턴 (3.27. 19:33 주문)
    const m = str.match(/(\d{1,2})\.(\d{1,2})\./);
    if (m) return `${new Date().getFullYear()}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return null;
  }

  function getCategory(name) {
    return typeof classifyItem === 'function' ? classifyItem(name) : '기타';
  }

  NS.helpers = { waitStable, parseDate, parseNaverDate, getCategory };

  // ── 디스패처: URL 보고 해당 몰 파서 실행 ──
  NS.run = function (allPages) {
    window.__collectAllPages = allPages;
    window.__collectResult = null;
    window.__shopCollecting = true;
    (async function () {
      let collected = [];
      try {
        const url = location.href;
        const C = NS.collectors;
        if (url.includes('11st.co.kr')) collected = await C['11st']();
        else if (url.includes('coupang.com')) collected = C.coupang();
        else if (url.includes('orders.pay.naver.com')) collected = await C.naver();
        else if (url.includes('pay.naver.com')) collected = await C.naverPay();
        else if (url.includes('shopping.naver.com')) collected = await C.naver();
        else if (url.includes('naver.com')) collected = await C.naver();
        else if (url.includes('aliexpress.com')) collected = await C.aliexpress();
        else if (url.includes('kurly.com')) collected = await C.kurly();
        else if (url.includes('gmarket.co.kr')) collected = await C.gmarket();
        else if (url.includes('temu.com')) collected = await C.temu();
      } catch (e) { console.error('[collect error]', e.message); }
      window.__shopCollecting = false;
      if (collected.length > 0) chrome.runtime.sendMessage({ action: 'itemsCollected', items: collected });
      const uniqueOrders = new Set(collected.map(function (i) { return i.rawDate || i.orderId; })).size;
      window.__collectResult = { count: collected.length, orderCount: uniqueOrders, done: true };
    })();
  };
})();
