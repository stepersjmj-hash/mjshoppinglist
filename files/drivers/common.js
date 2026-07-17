// CartLog 팝업 드라이버 — 공통 (주입·전체수집·탭 대기 헬퍼)
// 확장 팝업 컨텍스트에서 실행 (app.html에서 <script>로 로드, 전역 스코프 공유)

// 수집기 주입: categories.js + collectors/* 파일 주입 후 디스패처 실행
async function injectCollector(tabId, allPages) {
  await chrome.scripting.executeScript({ target: { tabId }, func: () => { window.__collectResult = null; window.__shopCollecting = false; } });
  await chrome.scripting.executeScript({ target: { tabId }, files: [
    'categories.js',
    'collectors/common.js',
    'collectors/coupang.js',
    'collectors/naver.js',
    'collectors/eleven.js',
    'collectors/aliexpress.js',
    'collectors/kurly.js',
    'collectors/gmarket.js',
    'collectors/temu.js'
  ] });
  await chrome.scripting.executeScript({ target: { tabId }, func: (p) => window.__cartlog.run(p), args: [allPages] });
  const count = await pollCollectDone(tabId, 120000);
  await processAliDetailQueue(tabId);
  return count;
}

async function collectAllYears(tab, store = '11st') {
  const btn = q('#btnCollectAuto');
  const startYear = 2020, endYear = new Date().getFullYear();
  const totalYears = endYear - startYear + 1;
  let totalCount = 0, emptyStreak = 0, doneYears = 0;
  showProgress('수집 시작...', 0, '');

  for (let year = endYear; year >= startYear; year--) {
    const pct = (doneYears / totalYears) * 100;
    showProgress(`${year}년 수집 중`, pct, `누적 ${totalCount}건`);
    btn.textContent = `⏳ ${year}년 수집 중...`;

    const url = store === 'naver'
      ? `https://shopping.naver.com/my/order?startDate=${year}-01-01&endDate=${year}-12-31`
      : store === 'coupang'
        ? `https://mc.coupang.com/ssr/desktop/order/list?requestYear=${year}&pageIndex=0`
        : `https://buy.11st.co.kr/my11st/order/OrderList.tmall?shDateFrom=${year}0101&shDateTo=${year}1231&pageNumber=1&type=orderList2nd&ver=02`;

    await chrome.tabs.update(tab.id, { url });
    await waitForTabLoad(tab.id);
    await new Promise(r => setTimeout(r, store === 'coupang' ? 800 : 1200));
    if (store !== 'coupang') {
      const initSel = store === 'naver'
        ? '[class*="OrderProductBundle_order_card"],[class*="order_btn_more"]'
        : 'tbody tr';
      await waitForTabContent(tab.id, initSel, 10000);
    }

    let yearCount = 0;
    try {
      if (store === 'naver') {
        // 이전내역 더보기 반복 클릭
        let moreCount = 0;
        while (true) {
          const [{ result: hasMore }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => !!document.querySelector('[class*="order_btn_more"]')
          });
          if (!hasMore) break;
          const [{ result: cardsBefore }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.querySelectorAll('[class*="OrderProductBundle_order_card"]').length
          });
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.querySelector('[class*="order_btn_more"]')?.click()
          });
          await waitForCountIncrease(tab.id, '[class*="OrderProductBundle_order_card"]', cardsBefore);
          moreCount++;
          showProgress(`${year}년 수집 중`, pct, `더보기 ${moreCount}회 · 누적 ${totalCount}건`);
          if (moreCount > 50) break;
        }
        yearCount = await injectCollector(tab.id, false);
        totalCount += yearCount;
      } else if (store === 'coupang') {
        let pageIndex = 0;
        while (true) {
          if (pageIndex > 0) {
            const pageUrl = `https://mc.coupang.com/ssr/desktop/order/list?requestYear=${year}&pageIndex=${pageIndex}`;
            await chrome.tabs.update(tab.id, { url: pageUrl });
            await waitForTabLoad(tab.id);
            await new Promise(r => setTimeout(r, 800));
          }
          const count = await injectCollector(tab.id, false);
          yearCount += count; totalCount += count;
          const [{ result: hasNext }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id }, func: () => !!window.__coupangHasNext
          });
          showProgress(`${year}년 ${pageIndex + 1}p`, pct, `${year}년 ${yearCount}건 · 누적 ${totalCount}건`);
          btn.textContent = `⏳ ${year}년 p${pageIndex + 1} (누적 ${totalCount}건)`;
          if (!hasNext) break;
          pageIndex++;
        }
      } else {
        // 11번가: 페이지별 순회
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page++) {
          if (page > 1) {
            const pageUrl = `https://buy.11st.co.kr/my11st/order/OrderList.tmall?shDateFrom=${year}0101&shDateTo=${year}1231&pageNumber=${page}&type=orderList2nd&ver=02`;
            await chrome.tabs.update(tab.id, { url: pageUrl });
            await waitForTabLoad(tab.id);
            await new Promise(r => setTimeout(r, 600));
            await waitForTabContent(tab.id, 'tbody tr', 8000);
          }
          const count = await injectCollector(tab.id, false);
          yearCount += count; totalCount += count;
          if (page === 1) {
            const [{ result: tp }] = await chrome.scripting.executeScript({
              target: { tabId: tab.id }, func: () => window.__totalPages || 1
            });
            totalPages = tp || 1;
          }
          showProgress(`${year}년 ${page}/${totalPages}p`, pct, `${year}년 ${yearCount}건 · 누적 ${totalCount}건`);
          btn.textContent = `⏳ ${year}년 ${page}/${totalPages}p (누적 ${totalCount}건)`;
        }
      }

      doneYears++;
      showProgress(`${year}년 완료`, (doneYears / totalYears) * 100, `${year}년 ${yearCount}건 · 누적 ${totalCount}건`);
      btn.textContent = `⏳ ${year}년 ${yearCount}건 (누적 ${totalCount}건)`;

      if (yearCount === 0) {
        emptyStreak++;
        if (emptyStreak >= 3) {
          if (confirm(`${year}년부터 새로운 데이터가 없어요. 수집을 중단할까요?`)) break;
          emptyStreak = 0;
        }
      } else { emptyStreak = 0; }
    } catch (e) { console.warn(`${year}년 실패:`, e.message); doneYears++; }
  }

  settings.lastCollectedAt = new Date().toISOString();
  save();
  showProgress('수집 완료!', 100, `총 ${totalCount}건`);
  setTimeout(hideProgress, 3000);
  toast(`✓ 전체 수집 완료 — 총 ${totalCount}건`);
  render();
}

function pollCollectDone(tabId, timeout) {
  return new Promise(resolve => {
    const start = Date.now();
    const poll = async () => {
      try {
        const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__collectResult });
        if (result?.done) { resolve(result.orderCount ?? result.count ?? 0); return; }
      } catch {}
      if (Date.now() - start > timeout) { resolve(0); return; }
      setTimeout(poll, 200);
    };
    poll();
  });
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    const check = (id, info) => {
      if (id === tabId && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(check); resolve(); }
    };
    chrome.tabs.onUpdated.addListener(check);
    setTimeout(resolve, 10000);
  });
}

// DOM 요소가 나타날 때까지 폴링 (고정 setTimeout 대체)
async function waitForTabContent(tabId, selector, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: sel => document.querySelectorAll(sel).length > 0,
        args: [selector]
      });
      if (result) return;
    } catch {}
  }
}

// 요소 개수가 늘어날 때까지 폴링 (더보기 클릭 후 대기 대체)
async function waitForCountIncrease(tabId, selector, prevCount, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: sel => document.querySelectorAll(sel).length,
        args: [selector]
      });
      if (result > prevCount) return;
    } catch {}
  }
}
