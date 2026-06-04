// CartLog 팝업 드라이버 — 알리익스프레스 (전체수집 + 상세 큐 처리)
// 확장 팝업 컨텍스트에서 실행 (app.html에서 <script>로 로드, 전역 스코프 공유)

async function collectAllPagesAli(tab) {
  const btn = q('#btnCollectAuto');
  showProgress('알리익스프레스 수집 시작...', 0, '');

  // "주문 더 보기" 버튼 반복 클릭
  let clickCount = 0;
  while (true) {
    const [{ result: hasMore }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!([...document.querySelectorAll('button')].find(b => /주문 더 보기/.test(b.textContent)))
    });
    if (!hasMore) break;

    const [{ result: linksBefore }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.querySelectorAll('a[href*="/item/"]').length
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ([...document.querySelectorAll('button')].find(b => /주문 더 보기/.test(b.textContent)))?.click()
    });

    await waitForCountIncrease(tab.id, 'a[href*="/item/"]', linksBefore, 8000);
    clickCount++;
    showProgress(`더 보기 ${clickCount}회 클릭`, 50, '로딩 중...');
    btn.textContent = `⏳ 더 보기 ${clickCount}회 클릭 중...`;
    if (clickCount > 100) break;
  }

  await new Promise(r => setTimeout(r, 500));
  const count = await injectCollector(tab.id, false);

  settings.lastCollectedAt = new Date().toISOString();
  save();
  showProgress('수집 완료!', 100, `총 ${count}건`);
  setTimeout(hideProgress, 3000);
  toast(`✓ 알리익스프레스 수집 완료 — 총 ${count}건`);
  render();
}

// 알리: 상세 탭에서 상품 정보 추출
async function getAliDetailNames(detailUrl) {
  const tab = await chrome.tabs.create({ url: detailUrl, active: false });
  try {
    await waitForTabLoad(tab.id);
    await new Promise(r => setTimeout(r, 2500));
    const [{ result: items }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        return [...document.querySelectorAll('[data-pl="order_detail_item_title"]')].map(wrap => {
          const a = wrap.querySelector('a');
          if (!a) return null;
          let name = a.textContent.trim();
          if (name.length < 5 || /구매\s*시|할인/i.test(name)) return null;
          const u = a.getAttribute('href') || '';

          // 가격: es--char 스팬 연결
          const priceWrap = wrap.closest('[class*="order-detail-item"]')?.querySelector('[class*="es--wrap"]')
            || wrap.parentElement?.querySelector('[class*="es--wrap"]');
          let price = 0, currency = 'USD';
          if (priceWrap) {
            const raw = [...priceWrap.querySelectorAll('[class*="es--char"]')].map(s => s.textContent).join('').trim();
            if (/US\s*\$/.test(raw)) {
              currency = 'USD';
              const m = raw.replace(/US\s*\$/, '').match(/([\d.]+)/);
              price = m ? parseFloat(m[1]) : 0;
            } else if (/[₩￦]/.test(raw)) {
              currency = 'KRW';
              const m = raw.replace(/[₩￦,]/g, '').match(/(\d+)/);
              price = m ? parseInt(m[1]) : 0;
            }
          }

          // 수량
          const qtyEl = wrap.closest('[class*="order-detail-item"]')?.querySelector('.item-price-quantity')
            || wrap.parentElement?.querySelector('.item-price-quantity');
          const qty = qtyEl ? (parseInt(qtyEl.textContent.replace(/\D/g, '')) || 1) : 1;

          // 옵션
          const skuEl = wrap.closest('[class*="order-detail-item"]')?.querySelector('.item-sku-attr')
            || wrap.parentElement?.querySelector('.item-sku-attr');
          const sku = skuEl?.textContent.trim() || '';

          if (sku) name = name + ' / ' + sku;
          return { n: name, u, price, currency, qty };
        }).filter(Boolean);
      }
    });
    return items || [];
  } catch (e) { return []; }
  finally { chrome.tabs.remove(tab.id).catch(() => {}); }
}

// 알리: 이름 없는 항목 큐를 상세 탭으로 처리
async function processAliDetailQueue(sourceTabId) {
  let queue;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: sourceTabId },
      func: () => window.__aliDetailQueue || []
    });
    queue = result;
  } catch (e) { return; }
  if (!queue?.length) return;

  // detailHref별로 그룹핑
  const hrefGroups = new Map();
  for (const qItem of queue) {
    if (!qItem.detailHref) continue;
    if (!hrefGroups.has(qItem.detailHref)) hrefGroups.set(qItem.detailHref, []);
    hrefGroups.get(qItem.detailHref).push(qItem);
  }

  const newItems = [];

  for (const [detailHref, slots] of hrefGroups) {
    const detailItems = await getAliDetailNames(detailHref);
    if (!detailItems?.length) continue;
    const slot = slots[0]; // orderId, date, cancelled 등은 첫 슬롯 기준

    for (const { n: name, u, price: detailPrice, currency: detailCurrency, qty } of detailItems) {
      const itemUrl = u ? (u.startsWith('//') ? 'https:' + u : u) : slot.url;
      // 상세 페이지에서 가격 확보 시 사용, 없으면 슬롯 가격 n등분
      const price = detailPrice > 0
        ? Math.round(detailPrice * qty * 100) / 100
        : Math.round((slot.price / detailItems.length) * 100) / 100;
      const currency = detailPrice > 0 ? detailCurrency : slot.currency;
      newItems.push({
        store: 'aliexpress', name, price, currency,
        date: slot.date, orderId: slot.orderId, url: itemUrl,
        category: slot.cancelled ? '취소/반품' : classifyItem(name),
        collectedAt: new Date().toISOString()
      });
    }
  }

  if (newItems.length > 0) {
    await chrome.runtime.sendMessage({ action: 'itemsCollected', items: newItems });
    toast(`✓ 상세 페이지에서 ${newItems.length}건 추가 수집`);
  }
}
