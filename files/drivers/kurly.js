// CartLog 팝업 드라이버 — 컬리 (전체수집)
// 확장 팝업 컨텍스트에서 실행 (app.html에서 <script>로 로드, 전역 스코프 공유)

async function collectAllKurly(tab) {
  const btn = q('#btnCollectAuto');
  showProgress('컬리 수집 시작...', 0, '');

  // 1. 주문 페이지로 이동 (이미 그 위치라면 갱신)
  if (!tab.url.includes('kurly.com/mypage/order')) {
    await chrome.tabs.update(tab.id, { url: 'https://www.kurly.com/mypage/order' });
    await waitForTabLoad(tab.id);
    await new Promise(r => setTimeout(r, 1500));
  } else {
    await new Promise(r => setTimeout(r, 800));
  }

  // 2. 기간 선택 → 3년 (텍스트/구조 기반)
  showProgress('기간 선택 중...', 5, '필터 버튼 클릭');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // 기간 선택 트리거 — 텍스트에 "기간" / "3개월" / "1개월" / "선택" 등이 포함된 button 우선
      // 같은 텍스트를 가진 자식이 있으면 가장 작은 element 우선
      let btn = [...document.querySelectorAll('button')]
        .find(b => /기간\s*선택|기간|3개월|1개월|6개월|전체\s*기간/.test((b.textContent || '').trim()));
      // 폴백: 클릭 가능한 div (role=button) 또는 a
      if (!btn) {
        btn = [...document.querySelectorAll('div[role="button"], a, span[role="button"]')]
          .find(el => /기간\s*선택|기간|3개월|1개월/.test((el.textContent || '').trim()));
      }
      if (btn) btn.click();
    }
  });

  // 필터 레이어가 나타날 때까지 polling — "3년" 단독 텍스트 element가 보이는 것으로 감지
  showProgress('기간 선택 중...', 7, '필터 레이어 대기');
  let layerReady = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    const [{ result: ready }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // "3년" 단독 텍스트 element가 보이면 레이어 열린 것으로 간주
        return [...document.querySelectorAll('button,li,div,a,span,label')]
          .some(el => el.textContent.trim() === '3년' && el.offsetParent !== null);
      }
    });
    if (ready) { layerReady = true; break; }
  }

  // 3년 옵션 클릭 — 텍스트 기반, button 우선
  showProgress('기간 선택 중...', 9, layerReady ? '3년 옵션 선택' : '레이어 미발견 (폴백)');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // React 호환 클릭: pointerdown → mousedown → pointerup → mouseup → click 시퀀스
      const reactClick = (el) => {
        if (!el) return false;
        // input이면 연결된 label로 위임
        if (el.tagName === 'INPUT') {
          const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : el.closest('label');
          if (label) el = label;
        }
        const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(type => {
          try {
            const ev = type.startsWith('pointer')
              ? new PointerEvent(type, opts)
              : new MouseEvent(type, opts);
            el.dispatchEvent(ev);
          } catch { try { el.click(); } catch {} }
        });
        return true;
      };

      // 1차: <button> 중 textContent === "3년" 이면서 보이는 것
      let opt = [...document.querySelectorAll('button')]
        .find(b => b.textContent.trim() === '3년' && b.offsetParent !== null);

      // 폴백 1: 다른 인터랙티브 element 중 "3년" 단독 텍스트
      if (!opt) {
        opt = [...document.querySelectorAll('label,a,li,span')]
          .find(el => el.textContent.trim() === '3년' && el.offsetParent !== null);
      }

      // 폴백 2: "3년" 포함하지만 다른 기간 텍스트 없는 가장 작은 노드 (button 우선)
      if (!opt) {
        const allCands = [...document.querySelectorAll('button,label,a,li,span,div')]
          .filter(el => {
            const t = (el.textContent || '').trim();
            if (!/3년/.test(t)) return false;
            if (/(\d+개월|6개월|1년|전체|기간\s*선택)/.test(t)) return false;
            return el.offsetParent !== null;
          });
        const btns = allCands.filter(el => el.tagName === 'BUTTON');
        if (btns.length > 0) {
          btns.sort((a, b) => a.textContent.length - b.textContent.length);
          opt = btns[0];
        } else {
          allCands.sort((a, b) => a.textContent.length - b.textContent.length);
          opt = allCands[0];
        }
      }

      if (opt) reactClick(opt);
    }
  });

  // 클릭 후 레이어가 닫히는지 확인 — "3년" 텍스트 element가 더 이상 안 보이면 닫힌 것
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 200));
    const [{ result: stillOpen }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => [...document.querySelectorAll('button,li,div,a,span,label')]
        .some(el => el.textContent.trim() === '3년' && el.offsetParent !== null)
    });
    if (!stillOpen) break;
  }
  await new Promise(r => setTimeout(r, 1000));

  // 3. 무한 스크롤 — 변화 감지 기반 (반응형)
  // 박스 카운트는 "주문번호 NNNN" 패턴 element 또는 a[href*="/goods/"] 로 측정
  let lastCount = 0, lastHeight = 0, noChangeStreak = 0, scrollCount = 0;
  while (true) {
    const [{ result: before }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 주문 박스 = "주문번호 NNNN" 텍스트 element 개수
        const orderIds = [...document.querySelectorAll('p,span,div')]
          .filter(el => /^주문번호\s+[\d-]{6,}\s*$/.test((el.textContent || '').trim())
            && ![...el.children].some(c => /^주문번호\s+[\d-]{6,}/.test((c.textContent || '').trim())));
        const count = orderIds.length || document.querySelectorAll('a[href*="/goods/"]').length;
        // 마지막 주문 박스를 뷰에 진입시킨 뒤 페이지 끝으로 스크롤 (lazy 로딩 트리거)
        if (orderIds.length > 0) {
          try { orderIds[orderIds.length - 1].scrollIntoView({ block: 'end' }); } catch {}
        }
        window.scrollTo(0, document.body.scrollHeight);
        return { count, height: document.body.scrollHeight };
      }
    });

    scrollCount++;
    showProgress(`스크롤 ${scrollCount}회`, Math.min(20 + scrollCount * 2, 90), `${before.count}개 로드됨`);
    btn.textContent = `⏳ 스크롤 ${scrollCount}회 (${before.count}건)`;

    // 변화 감지: 200ms 간격 × 최대 30회 (= 6초)까지 polling
    let changed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      const [{ result: cur }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const orderIds = [...document.querySelectorAll('p,span,div')]
            .filter(el => /^주문번호\s+[\d-]{6,}\s*$/.test((el.textContent || '').trim())
              && ![...el.children].some(c => /^주문번호\s+[\d-]{6,}/.test((c.textContent || '').trim())));
          return {
            count: orderIds.length || document.querySelectorAll('a[href*="/goods/"]').length,
            height: document.body.scrollHeight
          };
        }
      });
      if (cur.count > before.count || cur.height > before.height) {
        changed = true;
        lastCount = cur.count;
        lastHeight = cur.height;
        break;
      }
    }

    if (changed) {
      noChangeStreak = 0;
    } else {
      noChangeStreak++;
      if (noChangeStreak >= 5) break; // 변화 없음 5회 연속 → 끝
      // 잠시 더 기다린 뒤 재시도 (네트워크 지연 케이스)
      await new Promise(r => setTimeout(r, 800));
    }

    if (scrollCount > 300) break; // 안전장치
  }

  // 4. 펼치기 + 수집기 주입
  showProgress('수집 중...', 95, '주문 펼치는 중');
  await new Promise(r => setTimeout(r, 300));
  const totalCount = await injectCollector(tab.id, false);

  settings.lastCollectedAt = new Date().toISOString();
  save();
  showProgress('수집 완료!', 100, `총 ${totalCount}건`);
  setTimeout(hideProgress, 3000);
  toast(`✓ 컬리 수집 완료 — 총 ${totalCount}건`);
  render();
}
