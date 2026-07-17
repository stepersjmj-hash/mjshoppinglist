// CartLog 팝업 드라이버 — 테무 (전체수집)
// 확장 팝업 컨텍스트에서 실행 (app.html에서 <script>로 로드, 전역 스코프 공유)

async function collectAllTemu(tab) {
  const btn = q('#btnCollectAuto');
  showProgress('테무 수집 시작...', 0, '');

  // 1. 주문내역 페이지로 이동 (이미 그 위치라면 대기만)
  if (!tab.url.includes('bgt_orders')) {
    await chrome.tabs.update(tab.id, { url: 'https://www.temu.com/kr/bgt_orders.html' });
    await waitForTabLoad(tab.id);
    await new Promise(r => setTimeout(r, 1500));
  } else {
    await new Promise(r => setTimeout(r, 800));
  }
  await waitForTabContent(tab.id, 'div[role="link"][aria-label]', 10000);

  // 2. "더 보기" 반복 클릭 — 주문 ID(PO-...) 개수 증가 감지 기반
  // ⚠️ 페이지 하단 추천상품 영역에도 "더보기" 버튼이 있어 구분 필요:
  //    마지막 주문 ID 뒤(document order)에 오면서 추천상품(js-goods-list) 밖인 첫 번째 버튼이 주문 더보기
  let clickCount = 0, noChangeStreak = 0;
  while (true) {
    const [{ result: before }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const count = (document.body.textContent.match(/PO-\d{2,4}-\d{8,}/g) || []).length;
        const idEls = [...document.querySelectorAll('span, div, p')]
          .filter(el => /^PO-\d{2,4}-\d{8,}$/.test((el.textContent || '').trim()));
        const lastId = idEls[idEls.length - 1];
        const hasMore = [...document.querySelectorAll('div[role="button"],button,span[role="button"]')]
          .some(el => /더\s*보기/.test((el.textContent || '').trim()) && el.offsetParent !== null
            && !el.closest('.js-goods-list')
            && (!lastId || (lastId.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)));
        return { count, hasMore };
      }
    });

    if (!before.hasMore) break;

    // React 호환 클릭: pointerdown → mousedown → pointerup → mouseup → click 시퀀스
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const idEls = [...document.querySelectorAll('span, div, p')]
          .filter(el => /^PO-\d{2,4}-\d{8,}$/.test((el.textContent || '').trim()));
        const lastId = idEls[idEls.length - 1];
        const more = [...document.querySelectorAll('div[role="button"],button,span[role="button"]')]
          .filter(el => /더\s*보기/.test((el.textContent || '').trim()) && el.offsetParent !== null
            && !el.closest('.js-goods-list')
            && (!lastId || (lastId.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)))[0];
        if (!more) return;
        const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
          try {
            const ev = type.startsWith('pointer') ? new PointerEvent(type, opts) : new MouseEvent(type, opts);
            more.dispatchEvent(ev);
          } catch { try { more.click(); } catch {} }
        });
      }
    });

    clickCount++;
    showProgress(`더 보기 ${clickCount}회`, Math.min(clickCount * 5, 90), `${before.count}건 로드됨`);
    btn.textContent = `⏳ 더 보기 ${clickCount}회 (${before.count}건)`;

    // 개수 증가 대기: 200ms 간격 × 최대 30회 (= 6초)
    let changed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      const [{ result: cur }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => (document.body.textContent.match(/PO-\d{2,4}-\d{8,}/g) || []).length
      });
      if (cur > before.count) { changed = true; break; }
    }

    if (changed) {
      noChangeStreak = 0;
    } else {
      noChangeStreak++;
      if (noChangeStreak >= 3) break; // 변화 없음 3회 연속 → 끝
      await new Promise(r => setTimeout(r, 800));
    }
    if (clickCount > 200) break; // 안전장치
  }

  // 3. 수집기 주입
  showProgress('수집 중...', 95, '주문 파싱 중');
  await new Promise(r => setTimeout(r, 300));
  const totalCount = await injectCollector(tab.id, false);

  settings.lastCollectedAt = new Date().toISOString();
  save();
  showProgress('수집 완료!', 100, `총 ${totalCount}건`);
  setTimeout(hideProgress, 3000);
  toast(`✓ 테무 수집 완료 — 총 ${totalCount}건`);
  render();
}
