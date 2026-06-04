// ── 상태 ──────────────────────────────────────────────────────────────────────
let items = [];
let settings = {
  webhookUrl: '', sheetName: '구매내역', autoSync: false,
  lastCollectedAt: null,
  rules: [], customCategories: [],
  rateCache: {}
};
let filters = { store: 'all', cat: 'all', tag: 'all', dateFrom: '', dateTo: '', priceMin: '', priceMax: '', search: '' };
let currentView = 'list';

// ── 초기화 ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  reclassify();
  syncCustomCategories();
  setDefaultDates();
  render();
  bindAll();
  convertUsdItems().then(() => { save(); render(); });
});

async function load() {
  const s = await chrome.storage.local.get(['items', 'settings']);
  items = s.items || [];
  if (s.settings) settings = Object.assign(settings, s.settings);
  q('#webhookUrl').value = settings.webhookUrl || '';
  q('#sheetName').value = settings.sheetName || '';
  q('#toggleSyncDot').classList.toggle('on', !!settings.autoSync);
  renderRules();
  renderCustomCatChips();
}

function save() { chrome.storage.local.set({ items, settings }); }

// ── 탭 탐색 ───────────────────────────────────────────────────────────────────
const SHOP_PATTERNS = [
  'buy.11st.co.kr', '11st.co.kr/my11st',
  'mc.coupang.com', 'coupang.com/np/orders',
  'orders.pay.naver.com', 'shopping.naver.com/my/order', 'pay.naver.com',
  'aliexpress.com/p/order',
  'kurly.com/mypage/order',
  'my.gmarket.co.kr/ko/pc/list',
  '11st.co.kr', 'coupang.com', 'naver.com', 'aliexpress.com', 'kurly.com', 'gmarket.co.kr'
];

async function findShopTab() {
  const allTabs = await chrome.tabs.query({});
  for (const pattern of SHOP_PATTERNS) {
    const tab = allTabs.find(t => t.url?.includes(pattern));
    if (tab) return tab;
  }
  return null;
}

// ── 이벤트 바인딩 ─────────────────────────────────────────────────────────────
function bindAll() {
  // 뷰 토글
  q('#btnViewList').addEventListener('click', () => setView('list'));
  q('#btnViewChart').addEventListener('click', () => setView('chart'));

  // 필터 칩 (이벤트 위임)
  q('#filterPanel').addEventListener('click', e => {
    if (e.target.closest('[data-del-cat]')) return;
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const type = chip.dataset.filter;
    if (!type) return;
    if (type === 'tag') {
      const isOn = filters.tag === chip.dataset.val;
      qa('[data-filter="tag"]').forEach(c => c.classList.remove('on'));
      filters.tag = isOn ? 'all' : chip.dataset.val;
      if (!isOn) chip.classList.add('on');
    } else {
      qa(`[data-filter="${type}"]`).forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      filters[type] = chip.dataset.val;
    }
    render();
  });

  // 기간 칩
  q('#dateChips').addEventListener('click', e => {
    const chip = e.target.closest('[data-period]');
    if (!chip) return;
    q('#dateChips').querySelectorAll('[data-period]').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    applyDatePeriod(chip.dataset.period);
  });

  // 날짜/가격/검색 필터
  q('#dateFrom').addEventListener('input', e => {
    q('#dateChips').querySelectorAll('[data-period]').forEach(c => c.classList.remove('on'));
    filters.dateFrom = toISO(e.target.value); render();
  });
  q('#dateTo').addEventListener('input', e => { filters.dateTo = toISO(e.target.value); render(); });
  q('#priceMin').addEventListener('input', e => { filters.priceMin = e.target.value; render(); });
  q('#priceMax').addEventListener('input', e => { filters.priceMax = e.target.value; render(); });
  q('#searchQuery').addEventListener('input', e => { filters.search = e.target.value.trim(); render(); });

  // 목록 클릭
  q('#itemList').addEventListener('click', handleListClick);

  // 수집 버튼
  q('#btnCollect').addEventListener('click', collectFromTab);
  q('#btnCollectAuto').addEventListener('click', collectAuto);

  // 액션 버튼
  q('#btnSync').addEventListener('click', syncSheet);
  q('#btnCSV').addEventListener('click', exportCSV);
  q('#btnClear').addEventListener('click', clearAll);
  q('#btnReclassifyAll').addEventListener('click', reclassifyAll);
  q('#btnExportRow').addEventListener('click', exportCSV);
  q('#btnFetchSheetRow').addEventListener('click', fetchFromSheet);
  q('#btnBackupExportRow').addEventListener('click', exportBackup);
  q('#btnBackupImportRow').addEventListener('click', () => q('#backupFileInput').click());
  q('#backupFileInput').addEventListener('change', handleBackupFileSelect);
  q('#btnClearRow').addEventListener('click', clearAll);
  document.querySelectorAll('[data-clear-store]').forEach(btn => {
    btn.addEventListener('click', () => clearStore(btn.dataset.clearStore));
  });

  // 설정
  q('#btnSaveSettings').addEventListener('click', saveSettings);
  q('#toggleSync').addEventListener('click', () => {
    settings.autoSync = !settings.autoSync;
    q('#toggleSyncDot').classList.toggle('on', settings.autoSync);
    save();
  });
  q('#sheetStatus').addEventListener('click', () => q('#settingsPanel').scrollIntoView({ behavior: 'smooth' }));

  q('#btnAddRule').addEventListener('click', addRule);

  // 가이드 모달
  q('#btnGuideSheet').addEventListener('click', () => showGuide('sheet'));
  q('#btnGuideClose').addEventListener('click', closeGuide);
  q('#btnCopyScript').addEventListener('click', copyGuideCode);
  q('#guideOverlay').addEventListener('click', e => { if (e.target === q('#guideOverlay')) closeGuide(); });

  // 메시지 수신
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'collectProgress') {
      q('#btnCollect').textContent = `⏳ ${msg.page}페이지 (${msg.count}건)`;
    }
    if (msg.action === 'newItems' && msg.items?.length) {
      const keys = new Set(items.map(i => i.orderId + '|' + i.name + '|' + i.price));
      const added = msg.items.filter(i => !keys.has(i.orderId + '|' + i.name + '|' + i.price));
      if (!added.length) return;
      items = [...added, ...items];
      render();
      toast(`✓ ${added.length}건 수집됨`);
      convertUsdItems().then(() => { save(); render(); });
    }
  });

  // storage 변화 감지
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.items) {
      const newVal = changes.items.newValue || [];
      // 외부(background)에서 저장된 경우에만 반영 (priceKrw 없는 USD 아이템이 있을 때)
      const hasUnconverted = newVal.some(i => i.currency === 'USD' && !i.priceKrw && i.price);
      items = newVal;
      render();
      if (hasUnconverted) {
        convertUsdItems().then(() => { save(); render(); });
      }
    }
  });
}

// ── 목록 클릭 핸들러 ──────────────────────────────────────────────────────────
function handleListClick(e) {
  // 개별 상품 삭제
  const delBtn = e.target.closest('.item-del-btn');
  if (delBtn) {
    const idx = +delBtn.dataset.delIdx;
    items.splice(idx, 1);
    save(); render();
    return;
  }

  // 날짜 미확인 클릭 → 수동 입력
  const dateUnknownEl = e.target.closest('.date-unknown');
  if (dateUnknownEl) {
    const orderKey = dateUnknownEl.dataset.orderKey;
    const input = prompt('날짜를 입력하세요 (예: 2025-12-25):', new Date().toISOString().slice(0, 10));
    if (!input) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) { toast('⚠️ 날짜 형식이 올바르지 않아요 (YYYY-MM-DD)'); return; }
    items.forEach(item => {
      if (item.orderId === orderKey && item.dateUnknown) { item.date = input; item.dateUnknown = false; }
    });
    save(); render(); toast('✓ 날짜가 저장되었습니다');
    return;
  }

  // + 버튼 → 태그 추가
  const addBtn = e.target.closest('.cat-add-btn');
  if (addBtn) {
    const idx = +addBtn.dataset.addIdx;
    const tag = prompt('개인화 태그를 입력하세요 (기존 카테고리는 유지됩니다):', '')?.trim();
    if (!tag) return;
    if (items[idx]) {
      if (!items[idx].tags) items[idx].tags = [];
      if (!items[idx].tags.includes(tag)) items[idx].tags.push(tag);
    }
    if (!settings.customCategories.includes(tag)) settings.customCategories.push(tag);
    save(); renderCustomCatChips(); render();
    return;
  }

  // 태그 × 버튼 → 삭제
  const tagDel = e.target.closest('.tag-del-btn');
  if (tagDel) {
    const idx = +tagDel.dataset.tagIdx;
    const tag = tagDel.dataset.tag;
    if (items[idx]?.tags) {
      items[idx].tags = items[idx].tags.filter(t => t !== tag);
      if (!items.some(i => i.tags?.includes(tag))) {
        settings.customCategories = settings.customCategories.filter(c => c !== tag);
        if (filters.tag === tag) filters.tag = 'all';
      }
      save(); renderCustomCatChips(); render();
    }
    return;
  }

  // 태그 배지 클릭 → 인라인 수정
  const tagBadge = e.target.closest('.tag-badge');
  if (tagBadge && !tagBadge.querySelector('input')) {
    const idx = +tagBadge.dataset.tagIdx;
    const tag = tagBadge.dataset.tag;
    const inp = makeInlineInput(tag, '60px');
    tagBadge.innerHTML = '';
    tagBadge.appendChild(inp);
    inp.focus(); inp.select();
    const done = () => {
      const newTag = inp.value.trim();
      if (newTag && newTag !== tag && items[idx]?.tags) {
        items[idx].tags = items[idx].tags.map(t => t === tag ? newTag : t);
        if (!items.some(i => i.tags?.includes(tag))) settings.customCategories = settings.customCategories.filter(c => c !== tag);
        if (!settings.customCategories.includes(newTag)) settings.customCategories.push(newTag);
        if (filters.tag === tag) filters.tag = newTag;
        save(); renderCustomCatChips();
      }
      render();
    };
    attachInlineInputEvents(inp, done);
    e.stopPropagation();
    return;
  }

  // 카테고리 배지 클릭 → 인라인 수정
  const cat = e.target.closest('.cat-badge');
  if (!cat || cat.querySelector('input')) return;
  const idx = +cat.dataset.idx;
  const inp = makeInlineInput(items[idx]?.category || '', '68px');
  cat.textContent = '';
  cat.appendChild(inp);
  inp.focus(); inp.select();
  const done = () => {
    if (items[idx]) { items[idx].category = inp.value.trim() || '기타'; items[idx].manuallyEdited = true; save(); }
    render();
  };
  attachInlineInputEvents(inp, done);
  e.stopPropagation();
}

function makeInlineInput(value, width) {
  const inp = document.createElement('input');
  inp.value = value;
  inp.style.cssText = `width:${width};font-size:10px;padding:1px 4px;border:1px solid var(--a);border-radius:4px;background:var(--bg3);color:var(--fg);outline:none;`;
  return inp;
}

function attachInlineInputEvents(inp, done) {
  inp.addEventListener('blur', done);
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(); if (ev.key === 'Escape') render(); });
}

// ── 설정 저장 ─────────────────────────────────────────────────────────────────
function saveSettings() {
  settings.webhookUrl = q('#webhookUrl').value.trim();
  settings.sheetName = q('#sheetName').value.trim() || '구매내역';
  save(); updateStatus();
  toast('✓ 설정이 저장되었습니다');
}

// ── 수집 ──────────────────────────────────────────────────────────────────────
async function collectFromTab() {
  const btn = q('#btnCollect');
  btn.disabled = true; btn.textContent = '⏳ 수집 중...';
  try {
    const tab = await findShopTab();
    if (!tab) { toast('⚠️ 쇼핑몰 주문내역 탭을 열어주세요'); return; }
    const count = await injectCollector(tab.id, false);
    toast(count > 0 ? `✓ ${count}건 수집 완료` : '수집 항목 없음. 페이지가 완전히 로딩됐는지 확인해주세요');
  } catch (e) { toast('❌ 오류: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = '▶ 현재 탭에서 가져오기'; }
}

async function collectAuto() {
  const tab = await findShopTab();
  if (!tab) { toast('⚠️ 쇼핑몰 주문내역 탭을 먼저 열어주세요'); return; }
  const is11st = tab.url.includes('11st.co.kr');
  const isNaver = tab.url.includes('naver.com');
  const isCoupang = tab.url.includes('coupang.com');
  const isAliexpress = tab.url.includes('aliexpress.com');
  const isKurly = tab.url.includes('kurly.com');
  const isGmarket = tab.url.includes('gmarket.co.kr');
  if (!is11st && !isNaver && !isCoupang && !isAliexpress && !isKurly && !isGmarket) { toast('⚠️ 현재 전체 자동 수집은 11번가/네이버페이/쿠팡/알리익스프레스/컬리/지마켓만 지원해요'); return; }
  const store = is11st ? '11st' : isNaver ? 'naver' : isCoupang ? 'coupang' : isAliexpress ? 'aliexpress' : isKurly ? 'kurly' : 'gmarket';
  const btn = q('#btnCollectAuto');
  btn.disabled = true;
  try {
    if (store === 'aliexpress') await collectAllPagesAli(tab);
    else if (store === 'kurly') await collectAllKurly(tab);
    else if (store === 'gmarket') await collectAllGmarket(tab);
    else if (tab.url.includes('orders.pay.naver.com')) await collectAllYears(tab, 'naver');
    else if (tab.url.includes('pay.naver.com')) await collectNaverPayAll(tab);
    else await collectAllYears(tab, store);
  }
  finally { btn.disabled = false; btn.textContent = '⟳ 전체 기간 자동 수집'; }
}


// ── 수집 드라이버 / 주입 수집기 분리 안내 ──────────────────────────────────────
// 쇼핑몰별 "전체 수집" 드라이버 → drivers/*.js (app.html에서 로드)
// 쇼핑몰 페이지에 주입되는 파서 → collectors/*.js (injectCollector가 주입)
// collectFromTab / collectAuto 는 위 드라이버 함수를 호출한다(전역 스코프 공유).


// ── 렌더링 ────────────────────────────────────────────────────────────────────
function setView(v) {
  currentView = v;
  q('#btnViewList').classList.toggle('on', v === 'list');
  q('#btnViewChart').classList.toggle('on', v === 'chart');
  q('#listPanel').style.display = v === 'list' ? '' : 'none';
  q('#chartPanel').classList.toggle('show', v === 'chart');
  if (v === 'chart') renderChart();
}

function render() {
  renderStats(); renderList(); renderCounts(); updateStatus();
  if (currentView === 'chart') renderChart();
}

function filtered() {
  const sq = filters.search.toLowerCase();
  return items.filter(item => {
    if (filters.store !== 'all' && item.store !== filters.store) return false;
    if (filters.cat !== 'all' && item.category !== filters.cat) return false;
    if (filters.tag !== 'all' && !item.tags?.includes(filters.tag)) return false;
    if (filters.dateFrom && item.date < filters.dateFrom) return false;
    if (filters.dateTo && item.date > filters.dateTo) return false;
    if (filters.priceMin && item.price < +filters.priceMin) return false;
    if (filters.priceMax && item.price > +filters.priceMax) return false;
    if (sq && !(item.name || '').toLowerCase().includes(sq)) return false;
    return true;
  });
}

function renderStats() {
  const now = new Date().toISOString().slice(0, 7);
  const f = filtered();
  const totalOrders = new Set(f.map(i => i.orderId || i.date + '|' + i.store)).size;
  const monthOrders = new Set(f.filter(i => i.date?.startsWith(now)).map(i => i.orderId || i.date + '|' + i.store)).size;
  q('#statTotal').textContent = totalOrders;
  q('#statMonth').textContent = monthOrders;
  q('#statAmount').textContent = Math.round(f.filter(i => i.category !== '취소/반품').reduce((s, i) => s + (i.currency === 'USD' ? (i.priceKrw || 0) : (i.price || 0)), 0) / 10000);
}

function renderCounts() {
  ['coupang', 'naver', '11st', 'aliexpress', 'kurly', 'gmarket'].forEach(s => {
    const el = q('#cnt-' + s);
    if (el) el.textContent = items.filter(i => i.store === s).length + '건';
  });
}

function renderList() {
  const list = q('#itemList');
  const f = filtered();
  const BADGE = { coupang: '쿠', naver: 'N', '11st': '11', aliexpress: 'Ali', kurly: '컬', gmarket: '지' };
  const sq = filters.search;

  if (!f.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📦</div><p>${items.length ? '필터 결과가 없어요' : '구매 내역이 없어요'}</p><small>${items.length ? '필터 조건을 바꿔보세요' : '오른쪽 패널에서 수집해주세요'}</small></div>`;
    return;
  }

  // 주문번호 기준 그룹핑
  const orderMap = new Map();
  f.forEach(item => {
    const key = item.orderId || (item.date + '|' + item.store + '|' + items.indexOf(item));
    if (!orderMap.has(key)) orderMap.set(key, { orderId: item.orderId, date: item.date, store: item.store, items: [] });
    orderMap.get(key).items.push(item);
  });

  const orders = [...orderMap.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  list.innerHTML = orders.map(order => {
    const activeItems = order.items.filter(i => i.category !== '취소/반품');
    const orderCurrency = order.items[0]?.currency;
    const totalPrice = activeItems.reduce((s, i) => s + (i.price || 0), 0);
    const krwTotal = activeItems.reduce((s, i) => s + (i.priceKrw || 0), 0);
    const totalDisplay = orderCurrency === 'USD'
      ? (krwTotal ? `<span title="US $${totalPrice.toFixed(2)}">${fmt(krwTotal)}</span>` : `US $${totalPrice.toFixed(2)}`)
      : fmt(totalPrice);
    const isCancelled = order.items.every(i => i.category === '취소/반품');
    const hasDateUnknown = order.items.some(i => i.dateUnknown);

    const subRows = order.items.map(item => {
      const idx = items.indexOf(item);
      const nameText = sq
        ? esc(item.name || '').replace(new RegExp(esc(sq).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            m => `<mark style="background:rgba(124,111,239,.3);color:var(--a2);border-radius:2px">${m}</mark>`)
        : esc(item.name || '');
      const nameHtml = item.url
        ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;text-underline-offset:2px">${nameText}</a>`
        : nameText;
      const tags = item.tags?.length ? item.tags.map(tag =>
        `<span class="cat-badge tag-badge" data-tag-idx="${idx}" data-tag="${esc(tag)}" title="클릭해서 수정">🏷 ${esc(tag)}<span class="tag-del-btn" data-tag-idx="${idx}" data-tag="${esc(tag)}" title="삭제">×</span></span>`
      ).join('') : '';
      return `<div class="sub-item">
        <span class="item-del-btn" data-del-idx="${idx}" title="삭제">×</span>
        <div class="sub-name" title="${esc(item.name || '')}">${nameHtml}</div>
        <div class="sub-meta">
          <span class="cat-badge" data-idx="${idx}" title="클릭해서 수정">${item.category || '기타'}</span>
          ${tags}
          <span class="cat-add-btn" data-add-idx="${idx}" title="개인화 태그 추가">+</span>
          <span class="sub-price">${fmtPrice(item)}</span>
        </div>
      </div>`;
    }).join('');

    const orderDetailUrl = (() => {
      const id = order.orderId;
      if (!id) return order.items[0]?.url || '';
      if (order.store === 'coupang') return `https://mc.coupang.com/ssr/desktop/order/${id}`;
      if (order.store === 'naver') return order.items[0]?.url || '';
      if (order.store === '11st') return `https://m.11st.co.kr/MW/MyPage/V1/orderDetailV1.tmall?ordNo=${id}`;
      if (order.store === 'aliexpress') return `https://www.aliexpress.com/p/order/detail.html?orderId=${id}`;
      if (order.store === 'kurly') return order.items[0]?.url || 'https://www.kurly.com/mypage/order';
      if (order.store === 'gmarket') return order.items[0]?.url || 'https://my.gmarket.co.kr/ko/pc/list/all';
      return order.items[0]?.url || '';
    })();
    const detailLink = orderDetailUrl
      ? ` <a href="${esc(orderDetailUrl)}" target="_blank" rel="noopener noreferrer" class="order-detail-link">(주문상세)</a>`
      : '';
    const dateDisplay = hasDateUnknown
      ? `<span class="order-date date-unknown" data-order-key="${order.orderId}" title="클릭해서 날짜 입력">📅 날짜 미확인</span>`
      : `<span class="order-date">${order.date || ''}${detailLink}</span>`;

    return `<div class="order-group${isCancelled ? ' cancelled' : ''}">
      <div class="order-head">
        <span class="badge ${order.store || ''}">${BADGE[order.store] || '?'}</span>
        <div class="order-head-info">
          ${dateDisplay}
          <span class="order-id">${order.store === '11st' ? (order.orderId || '') : ''}</span>
        </div>
        <div class="order-total">${order.items.length > 1 ? order.items.length + '개 · ' : ''}${totalDisplay}</div>
      </div>
      <div class="order-items">${subRows}</div>
    </div>`;
  }).join('');
}

function updateStatus() {
  const connected = !!settings.webhookUrl;
  q('#sheetStatus').className = 'sheet-status' + (connected ? ' connected' : '');
  q('#sheetStatusText').textContent = connected ? '시트 연결됨' : '시트 미연결';
}

// ── 동기화 ────────────────────────────────────────────────────────────────────
async function syncSheet() {
  if (!settings.webhookUrl) { toast('⚠️ Apps Script URL을 먼저 설정해주세요'); q('#settingsPanel').scrollIntoView({ behavior: 'smooth' }); return; }
  q('#btnSync').disabled = true; q('#syncText').textContent = '동기화 중...';
  try {
    await convertUsdItems();
    save();
    const r = await chrome.runtime.sendMessage({ action: 'syncToSheet', items, webhookUrl: settings.webhookUrl, sheetName: settings.sheetName || '구매내역' });
    toast(r.ok ? `✓ ${items.length}건 동기화 완료` : '❌ ' + (r.error || '실패'));
  } catch (e) { toast('❌ ' + e.message); }
  finally { q('#btnSync').disabled = false; q('#syncText').textContent = '구글 시트 동기화'; }
}

// ── 프로그레스 ────────────────────────────────────────────────────────────────
function showProgress(label, pct, sub) {
  q('#progressWrap').classList.add('show');
  q('#progressLabel').textContent = label;
  q('#progressPct').textContent = Math.round(pct) + '%';
  q('#progressBar').style.width = Math.round(pct) + '%';
  q('#progressSub').textContent = sub || '';
}

function hideProgress() {
  q('#progressWrap').classList.remove('show');
  q('#progressBar').style.width = '0%';
}

// ── 차트 ──────────────────────────────────────────────────────────────────────
function renderChart() {
  const canvas = q('#donutChart');
  if (!canvas) return;
  // 차트는 카테고리 필터를 무시하고 전체 분포를 보여줌
  const savedCat = filters.cat;
  filters.cat = 'all';
  const f = filtered().filter(i => i.category !== '취소/반품');
  filters.cat = savedCat;
  const ctx = canvas.getContext('2d');
  const W = 160, cx = W / 2, cy = W / 2, R = 68, r = 42;

  const catMap = new Map();
  f.forEach(i => {
    const p = i.currency === 'USD' ? (i.priceKrw || 0) : (i.price || 0);
    catMap.set(i.category || '기타', (catMap.get(i.category || '기타') || 0) + p);
  });
  const total = [...catMap.values()].reduce((s, v) => s + v, 0);

  if (!total) {
    ctx.clearRect(0, 0, W, W);
    q('#chartLegend').innerHTML = '<div style="font-size:12px;color:var(--fg3);padding:8px">데이터가 없어요</div>';
    q('#chartTotalNum').textContent = '-';
    return;
  }

  const entries = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
  ctx.clearRect(0, 0, W, W);
  let angle = -Math.PI / 2;
  const GAP = 0.025;
  entries.forEach(([cat, val]) => {
    const sweep = (val / total) * Math.PI * 2 - GAP;
    if (sweep <= 0) return; // 너무 작은 슬라이스는 건너뜀 (음수 sweep 방지)
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle + GAP / 2, angle + GAP / 2 + sweep);
    ctx.closePath();
    ctx.fillStyle = CAT_COLORS[cat] || '#94a3b8';
    ctx.fill();
    angle += sweep + GAP;
  });
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim() || '#17171c';
  ctx.fill();

  q('#chartTotalNum').textContent = total >= 10000 ? Math.round(total / 10000) + '만원' : fmt(total);
  q('#chartLegend').innerHTML = entries.map(([cat, val]) => {
    const pct = Math.round(val / total * 100);
    return `<div class="legend-item">
      <div class="legend-dot" style="background:${CAT_COLORS[cat] || '#94a3b8'}"></div>
      <span class="legend-name">${cat}</span>
      <span class="legend-pct">${pct}%</span>
      <span class="legend-amt">${val >= 10000 ? Math.round(val / 10000) + '만' : val.toLocaleString()}원</span>
    </div>`;
  }).join('');
}

// ── 내보내기 ──────────────────────────────────────────────────────────────────
function exportCSV() {
  const f = filtered();
  if (!f.length) { toast('내보낼 데이터가 없어요'); return; }
  const rows = [
    ['날짜', '상품명', '가격', '카테고리', '개인화태그', '쇼핑몰', '주문번호'],
    ...f.map(i => [i.date, `"${(i.name || '').replace(/"/g, '""')}"`, i.price, i.category, (i.tags || []).join('|'), i.store, i.orderId || ''])
  ];
  const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: `구매내역_${new Date().toISOString().slice(0, 10)}.csv`
  }).click();
  toast(`✓ ${f.length}건 CSV 다운로드`);
}

// ── 시트에서 불러오기 ─────────────────────────────────────────────────────────
async function fetchFromSheet() {
  if (!settings.webhookUrl) {
    toast('⚠️ Apps Script URL을 먼저 설정해주세요');
    q('#settingsPanel').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (!confirm('구글 시트에서 구매내역을 불러와 현재 목록에 합칠까요?\n(중복은 자동으로 제외됩니다)')) return;
  try {
    const r = await chrome.runtime.sendMessage({
      action: 'fetchFromSheet',
      webhookUrl: settings.webhookUrl,
      sheetName: settings.sheetName || '구매내역'
    });
    if (!r || !r.ok) { toast('❌ ' + ((r && r.error) || '불러오기 실패')); return; }
    const fetched = r.items || [];
    if (!fetched.length) { toast('시트에 데이터가 없어요'); return; }
    const mergeRes = await chrome.runtime.sendMessage({ action: 'mergeItems', items: fetched });
    if (!mergeRes || !mergeRes.ok) { toast('❌ 병합 실패'); return; }
    // 로컬 items 재로드
    const s = await chrome.storage.local.get('items');
    items = s.items || [];
    reclassify();
    render();
    toast(`✓ ${mergeRes.added}건 추가 (중복 ${mergeRes.duplicates}건 제외)`);
  } catch (e) {
    toast('❌ ' + e.message);
  }
}

// ── JSON 백업 / 복원 ──────────────────────────────────────────────────────────
function exportBackup() {
  const backup = {
    app: 'CartLog',
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items,
    settings: {
      rules: settings.rules || [],
      customCategories: settings.customCategories || [],
      rateCache: settings.rateCache || {}
    }
  };
  const json = JSON.stringify(backup, null, 2);
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
    download: `cartlog-backup_${new Date().toISOString().slice(0, 10)}.json`
  }).click();
  toast(`✓ 백업 내보내기 완료 (${items.length}건)`);
}

function handleBackupFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // 동일 파일 재선택 허용
  if (!file) return;
  const includeCategorySettings = confirm(
    '📥 백업 불러오기\n\n' +
    '✔ 구매내역은 기본으로 가져옵니다.\n\n' +
    '카테고리 규칙·커스텀 카테고리·환율 캐시도 함께 가져올까요?\n' +
    '(webhookUrl·자동동기화 설정은 PC별로 유지됩니다)\n\n' +
    '확인 = 모두 가져오기\n취소 = 구매내역만 가져오기'
  );
  importBackup(file, { includeItems: true, includeCategorySettings });
}

async function importBackup(file, opts) {
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    if (!backup || !Array.isArray(backup.items)) {
      toast('❌ 백업 파일 형식이 올바르지 않아요');
      return;
    }

    let addedCount = 0, dupCount = 0;
    if (opts.includeItems && backup.items.length) {
      const mergeRes = await chrome.runtime.sendMessage({ action: 'mergeItems', items: backup.items });
      if (!mergeRes || !mergeRes.ok) { toast('❌ 병합 실패'); return; }
      addedCount = mergeRes.added;
      dupCount = mergeRes.duplicates;
    }

    const settingsMsgs = [];
    if (opts.includeCategorySettings && backup.settings && typeof backup.settings === 'object') {
      const bs = backup.settings;
      if (Array.isArray(bs.rules)) {
        const existingKw = new Set((settings.rules || []).map(r => (r.keyword || '').toLowerCase()));
        const newRules = bs.rules.filter(r => r && r.keyword && !existingKw.has(r.keyword.toLowerCase()));
        if (newRules.length) {
          settings.rules = [...(settings.rules || []), ...newRules];
          settingsMsgs.push(`규칙 +${newRules.length}`);
        }
      }
      if (Array.isArray(bs.customCategories)) {
        const existing = new Set(settings.customCategories || []);
        const newCats = bs.customCategories.filter(c => c && !existing.has(c));
        if (newCats.length) {
          settings.customCategories = [...(settings.customCategories || []), ...newCats];
          settingsMsgs.push(`카테고리 +${newCats.length}`);
        }
      }
      if (bs.rateCache && typeof bs.rateCache === 'object') {
        const before = Object.keys(settings.rateCache || {}).length;
        settings.rateCache = Object.assign({}, settings.rateCache || {}, bs.rateCache);
        const after = Object.keys(settings.rateCache).length;
        if (after > before) settingsMsgs.push(`환율캐시 +${after - before}`);
      }
      save();
    }

    // items 재로드
    const s = await chrome.storage.local.get('items');
    items = s.items || [];
    reclassify();
    syncCustomCategories();
    renderRules();
    renderCustomCatChips();
    render();

    const parts = [];
    if (opts.includeItems) parts.push(`내역 +${addedCount} (중복 ${dupCount})`);
    if (settingsMsgs.length) parts.push(settingsMsgs.join(', '));
    toast(`✓ 복원 완료: ${parts.join(' / ') || '변경 없음'}`);
  } catch (e) {
    toast('❌ 백업 불러오기 실패: ' + e.message);
  }
}

function clearAll() {
  if (!confirm('모든 구매 내역을 삭제할까요?')) return;
  items = []; save(); render(); toast('✓ 초기화 완료');
}

function clearStore(store) {
  const NAMES = { coupang: '쿠팡', naver: '네이버페이', '11st': '11번가', aliexpress: '알리익스프레스', kurly: '컬리', gmarket: '지마켓' };
  const count = items.filter(i => i.store === store).length;
  if (!count) { toast('삭제할 데이터가 없어요'); return; }
  if (!confirm(`${NAMES[store] || store} 데이터 ${count}건을 삭제할까요?`)) return;
  items = items.filter(i => i.store !== store);
  save(); render(); toast(`✓ ${NAMES[store] || store} ${count}건 삭제 완료`);
}

function refreshCategories() {
  let changed = 0;
  items = items.map(item => {
    if (item.category === '취소/반품') return item;
    const newCat = classifyItem(item.name);
    if (newCat !== item.category) { changed++; return { ...item, category: newCat }; }
    return item;
  });
  save(); render();
  toast(`✓ 카테고리 재분류 완료 — ${changed}건 변경`);
}

// ── 날짜 필터 ─────────────────────────────────────────────────────────────────
function setDefaultDates() { filters.dateFrom = ''; filters.dateTo = ''; buildDateChips(new Date()); }

function buildDateChips(today) {
  const chips = q('#dateChips');
  if (!chips) return;
  chips.querySelectorAll('[data-period^="month"]').forEach(c => c.remove());
  for (let i = 1; i <= 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const chip = Object.assign(document.createElement('div'), {
      className: 'chip',
      textContent: (d.getMonth() + 1) + '월'
    });
    chip.dataset.period = `month_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
    chips.appendChild(chip);
  }
}

function applyDatePeriod(period) {
  const today = new Date(), todayStr = today.toISOString().slice(0, 10);
  let from = '', to = todayStr;
  if (period === 'all') { from = ''; to = ''; }
  else if (period === 'today') { from = todayStr; }
  else if (period === '1m') from = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()).toISOString().slice(0, 10);
  else if (period === '6m') from = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()).toISOString().slice(0, 10);
  else if (period.startsWith('month_')) {
    const [, year, month] = period.split('_');
    from = `${year}-${month}-01`;
    to = `${year}-${month}-${String(new Date(+year, +month, 0).getDate()).padStart(2, '0')}`;
  }
  filters.dateFrom = from; filters.dateTo = to;
  q('#dateFrom').value = from ? from.replace(/-/g, '') : '';
  q('#dateTo').value = to ? to.replace(/-/g, '') : '';
  render();
}

function toISO(v) {
  const s = (v || '').replace(/\D/g, '');
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

// ── 개인화 태그 ───────────────────────────────────────────────────────────────
function getUsedTags() {
  const used = new Set();
  items.forEach(i => i.tags?.forEach(t => used.add(t)));
  return used;
}

function syncCustomCategories() {
  const used = getUsedTags();
  settings.customCategories = settings.customCategories.filter(c => used.has(c));
  used.forEach(t => { if (!settings.customCategories.includes(t)) settings.customCategories.push(t); });
}

function renderCustomCatChips() {
  const container = document.getElementById('customCatChips');
  const row = document.getElementById('customCatRow');
  if (!container) return;
  const cats = settings.customCategories || [];
  if (row) row.style.display = cats.length ? '' : 'none';
  if (!cats.length) { container.innerHTML = ''; return; }
  container.innerHTML = cats.map(cat =>
    `<div class="chip custom-chip" data-filter="tag" data-val="${esc(cat)}">${esc(cat)}<span class="chip-del" data-del-cat="${esc(cat)}">×</span></div>`
  ).join('');
  container.querySelectorAll('[data-filter="tag"]').forEach(c => c.classList.toggle('on', c.dataset.val === filters.tag));
  container.querySelectorAll('[data-del-cat]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const cat = el.dataset.delCat;
      items.forEach(i => { if (i.tags) i.tags = i.tags.filter(t => t !== cat); });
      settings.customCategories = settings.customCategories.filter(c => c !== cat);
      if (filters.tag === cat) filters.tag = 'all';
      save(); renderCustomCatChips(); render();
    });
  });
}

// ── 카테고리 규칙 ─────────────────────────────────────────────────────────────
function renderRules() {
  const list = q('#ruleList');
  if (!list) return;
  if (!settings.rules.length) { list.innerHTML = '<div style="font-size:11px;color:var(--fg3);padding:4px">등록된 규칙이 없어요</div>'; return; }
  list.innerHTML = settings.rules.map((r, i) =>
    `<div class="rule-item"><span class="rule-keyword">${esc(r.keyword)}</span><span class="rule-arrow">→</span><span class="rule-cat">${esc(r.cat)}</span><span class="rule-del" data-i="${i}">×</span></div>`
  ).join('');
  list.querySelectorAll('.rule-del').forEach(el => {
    el.addEventListener('click', () => { settings.rules.splice(+el.dataset.i, 1); save(); renderRules(); applyRules(); });
  });
}

function addRule() {
  const kw = q('#ruleKeyword').value.trim(), cat = q('#ruleCat').value.trim();
  if (!kw || !cat) { toast('키워드와 카테고리를 모두 입력해 주세요'); return; }
  if (settings.rules.some(r => r.keyword === kw)) { toast('이미 등록된 키워드예요'); return; }
  settings.rules.push({ keyword: kw, cat });
  q('#ruleKeyword').value = ''; q('#ruleCat').value = '';
  save(); renderRules(); applyRules();
  toast('✓ 규칙 추가됨 — 목록에 즉시 적용됩니다');
}

function applyRules() {
  if (!settings.rules.length) return;
  let changed = false;
  items.forEach(item => {
    const n = (item.name || '').toLowerCase();
    for (const r of settings.rules) {
      if (n.includes(r.keyword.toLowerCase())) {
        if (item.category !== r.cat) { item.category = r.cat; changed = true; }
        break;
      }
    }
  });
  if (changed) { save(); render(); }
}


function reclassify() {
  let changed = false;
  items.forEach(item => {
    if (item.category && item.category !== '기타') return;
    const c = classifyItem(item.name);
    if (c !== '기타') { item.category = c; changed = true; }
  });
  if (changed) save();
  applyRules();
}

function reclassifyAll() {
  if (!confirm('수동 편집 내역을 제외한 전체 카테고리를 categories.js 기준으로 재설정할까요?')) return;
  let changed = 0;
  items.forEach(item => {
    if (item.category === '취소/반품' || item.manuallyEdited) return;
    const c = classifyItem(item.name);
    item.category = c;
    changed++;
  });
  applyRules();
  save(); render();
  toast(`✓ ${changed}건 카테고리 재설정 완료`);
}

// ── 가이드 모달 ───────────────────────────────────────────────────────────────
function showGuide(type) {
  q('#guideSheet').style.display = '';
  q('#guideModalTitle').textContent = '📊 구글 시트 연동 설정';
  q('#guideOverlay').classList.add('show');
}

function closeGuide() {
  q('#guideOverlay').classList.remove('show');
}

function copyGuideCode() {
  const code = q('#appsScriptCode');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(() => {
    const btn = q('#btnCopyScript');
    if (btn) { btn.textContent = '복사됨!'; setTimeout(() => { btn.textContent = '복사'; }, 1500); }
  });
}

// ── 환율 변환 ─────────────────────────────────────────────────────────────────
async function fetchExchangeRate(date) {
  if (!settings.rateCache) settings.rateCache = {};
  if (settings.rateCache[date]) return settings.rateCache[date];
  try {
    // Frankfurter는 주말/공휴일 데이터가 없으므로 직전 영업일로 자동 처리됨
    const res = await fetch(`https://api.frankfurter.app/${date}?from=USD&to=KRW`);
    if (!res.ok) {
      console.warn('[환율] API 오류', date, res.status);
      return null;
    }
    const data = await res.json();
    console.log('[환율] 응답', date, data);
    const rate = data?.rates?.KRW;
    if (rate) settings.rateCache[date] = rate;
    return rate || null;
  } catch (e) {
    console.warn('[환율] fetch 실패', date, e);
    return null;
  }
}

async function convertUsdItems() {
  const today = new Date().toISOString().slice(0, 10);
  const needConvert = items.filter(i => i.currency === 'USD' && !i.priceKrw && i.price);
  if (!needConvert.length) return;
  const dates = [...new Set(needConvert.map(i => (i.date || today).slice(0, 10)))];
  console.log('[환율] dates:', dates);
  const rates = {};
  for (const d of dates) {
    const rate = await fetchExchangeRate(d);
    console.log('[환율] rate for', d, ':', rate);
    if (rate) rates[d] = rate;
  }
  let changed = false;
  items.forEach(item => {
    if (item.currency === 'USD' && !item.priceKrw && item.price) {
      const d = (item.date || today).slice(0, 10);
      if (rates[d]) { item.priceKrw = Math.round(item.price * rates[d]); changed = true; }
    }
  });
  console.log('[환율] changed:', changed, 'sample priceKrw:', items.find(i=>i.currency==='USD')?.priceKrw);
  if (changed) settings.rateCache = { ...settings.rateCache };
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function fmt(p) { return p ? Number(p).toLocaleString('ko-KR') + '원' : '-'; }
function fmtPrice(item) {
  if (!item) return '-';
  if (item.currency === 'USD') {
    const usd = `US $${Number(item.price || 0).toFixed(2)}`;
    if (item.priceKrw) return `<span title="${usd}">${fmt(item.priceKrw)}</span>`;
    return usd;
  }
  return fmt(item.price);
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function q(sel) { return document.querySelector(sel); }
function qa(sel) { return document.querySelectorAll(sel); }
function toast(msg) {
  const t = q('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 4000);
}
