// CartLog 주입 수집기 — 컬리
// ⚠️ 자동 생성/분리된 파일. 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  NS.collectors.kurly =   async function collectKurly() {
    const { getCategory } = window.__cartlog.helpers;
    await new Promise(r => setTimeout(r, 300));

    // 1. "주문 펼쳐보기" 텍스트를 가진 element 찾아 모두 클릭
    //    자기 자신은 텍스트를 가지고 있지만 자식이 같은 텍스트를 가진 경우 제외(가장 작은 element만)
    const expandTriggers = [...document.querySelectorAll('p, span, button, div')]
      .filter(el => /주문\s*펼쳐보기/.test(el.textContent || ''))
      .filter(el => ![...el.children].some(child => /주문\s*펼쳐보기/.test(child.textContent || '')));

    for (const el of expandTriggers) {
      // 클릭 가능한 ancestor를 찾기 — button > role=button > a > 자기 자신
      let target = el;
      let cur = el;
      for (let i = 0; i < 6 && cur; i++) {
        if (cur.tagName === 'BUTTON' || cur.getAttribute?.('role') === 'button' || cur.tagName === 'A') {
          target = cur; break;
        }
        cur = cur.parentElement;
      }
      try { target.click(); } catch {}
    }
    if (expandTriggers.length > 0) await new Promise(r => setTimeout(r, 800));

    const result = [];

    // 2. 페이지 안의 "주문번호 NNNN" 텍스트 element 모두 찾기
    const orderIdEls = [...document.querySelectorAll('p, span, div')]
      .filter(el => {
        const t = (el.textContent || '').trim();
        // 자기 자신만의 텍스트가 "주문번호 XXXX" 패턴이어야 함
        // (자식 element를 가지는 div가 textContent를 잘못 매칭하는 것을 방지)
        if (!/^주문번호\s+[\d-]{6,}\s*$/.test(t)) return false;
        // 자식 중에 또 다른 주문번호 element를 가지면 제외 (가장 작은 element만)
        return ![...el.children].some(child => /^주문번호\s+[\d-]{6,}/.test((child.textContent || '').trim()));
      });

    // 3. 각 주문번호 element를 기준으로 박스(주문 단위) 결정
    //    박스 = 다른 주문번호를 포함하지 않으면서 상품 링크를 포함하는 가장 큰 ancestor
    const boxes = [];
    for (const idEl of orderIdEls) {
      let chosen = null;
      let cur = idEl.parentElement;
      for (let i = 0; i < 20 && cur; i++) {
        const otherIds = orderIdEls.filter(e => e !== idEl && cur.contains(e));
        if (otherIds.length > 0) break; // 다른 주문번호 만남 — 직전 ancestor가 정답
        const hasGoods = cur.querySelector('a[href*="/goods/"]');
        if (hasGoods) chosen = cur;
        cur = cur.parentElement;
      }
      if (chosen) boxes.push({ box: chosen, idEl });
    }

    for (const { box, idEl } of boxes) {
      // 주문번호 추출
      const idM = (idEl.textContent || '').match(/주문번호\s+([\d-]+)/);
      let orderId = idM ? idM[1].replace(/-/g, '') : '';

      // 주문일자 — 박스 안 <p> 중 "YYYY.MM.DD" 단독 텍스트
      let dateRaw = '';
      const dateP = [...box.querySelectorAll('p')]
        .find(p => /^\s*\d{4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}\s*$/.test((p.textContent || '').trim()));
      if (dateP) {
        dateRaw = dateP.textContent.trim();
      } else {
        const dm = (box.textContent || '').match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
        if (dm) dateRaw = `${dm[1]}.${dm[2]}.${dm[3]}`;
      }
      const dM = dateRaw.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
      const date = dM
        ? `${dM[1]}-${dM[2].padStart(2, '0')}-${dM[3].padStart(2, '0')}`
        : new Date().toISOString().slice(0, 10);

      if (!orderId) {
        orderId = 'kurly_' + date.replace(/-/g, '') + '_' + Math.random().toString(36).slice(2, 6);
      }

      // 4. 박스 안의 ul들을 순회 (상품 그룹 단위)
      //    각 ul마다 그 다음 형제 영역에서 "취소완료/반품완료/환불완료/교환완료" 텍스트가 있는지 확인
      const uls = [...box.querySelectorAll('ul')].filter(ul => ul.querySelector('a[href*="/goods/"]'));

      for (const ul of uls) {
        // ul 다음 형제 element들에서 상태 텍스트 찾기 (다음 ul 만나기 전까지)
        let cancelled = false;
        let sib = ul.nextElementSibling;
        while (sib && sib.tagName !== 'UL') {
          if (/취소완료|반품완료|환불완료|교환완료|취소\s*요청|반품\s*요청/.test(sib.textContent || '')) {
            cancelled = true; break;
          }
          sib = sib.nextElementSibling;
        }

        // ul > li 단위로 상품 순회
        const lis = [...ul.children].filter(c => c.tagName === 'LI');
        for (const li of lis) {
          // 상품 링크 — a[href*="/goods/"] 중 span을 자식으로 가진 것 (상품명 a)
          // 이미지 a (자식이 div>img) 와 구분하기 위해 span 내부 텍스트가 있는 a를 선호
          const linkCandidates = [...li.querySelectorAll('a[href*="/goods/"]')];
          let nameLink = linkCandidates.find(a => {
            const span = a.querySelector('span');
            return span && (span.textContent || '').trim().length >= 2;
          });
          if (!nameLink && linkCandidates.length > 0) {
            // 폴백: span이 없는 경우 a의 직접 텍스트가 의미있는 것
            nameLink = linkCandidates.find(a => (a.textContent || '').trim().length >= 2 && !a.querySelector('img'));
          }
          if (!nameLink) continue;

          const nameSpan = nameLink.querySelector('span');
          const name = ((nameSpan?.textContent) || nameLink.textContent || '').trim();
          if (!name || name.length < 2) continue;

          const href = nameLink.getAttribute('href') || '';
          const url = href.startsWith('/') ? 'https://www.kurly.com' + href : href;

          // 가격 — li 안 <p> 중 텍스트가 "N,NNN원" 단독 패턴
          // 첫 번째 = 현재가, 두 번째 = 원가(취소선). 첫 번째만 사용.
          const pricePs = [...li.querySelectorAll('p')]
            .filter(p => /^\s*[\d,]+\s*원\s*$/.test((p.textContent || '').trim()));
          if (pricePs.length === 0) continue;
          const priceM = pricePs[0].textContent.match(/([\d,]+)/);
          const price = priceM ? parseInt(priceM[1].replace(/,/g, '')) : 0;
          if (!price) continue;

          // 수량 — li 안 <p> 중 텍스트가 "N개" 단독 패턴
          let qty = 1;
          const qtyP = [...li.querySelectorAll('p')]
            .find(p => /^\s*\d+\s*개\s*$/.test((p.textContent || '').trim()));
          if (qtyP) {
            const m = qtyP.textContent.match(/(\d+)/);
            if (m) qty = parseInt(m[1]);
          }

          const totalPrice = price * qty;
          const item = {
            store: 'kurly',
            name,
            price: totalPrice,
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
        }
      }
    }

    return result;
  };
})();
