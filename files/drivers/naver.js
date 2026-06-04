// CartLog 팝업 드라이버 — 네이버페이 (전체수집)
// 확장 팝업 컨텍스트에서 실행 (app.html에서 <script>로 로드, 전역 스코프 공유)

async function collectNaverPayAll(tab) {
  const btn = q('#btnCollectAuto');
  const startYear = 2020, endYear = new Date().getFullYear();
  let totalCount = 0, emptyStreak = 0, page = 1;
  showProgress('네이버페이 수집 시작...', 0, '');

  // pay.naver.com/pc/history?page=N 페이지 순회
  while (true) {
    const pct = Math.min((page / 50) * 100, 95);
    showProgress(`${page}페이지 수집 중`, pct, `누적 ${totalCount}건`);
    btn.textContent = `⏳ ${page}p (누적 ${totalCount}건)`;

    await chrome.tabs.update(tab.id, { url: `https://pay.naver.com/pc/history?page=${page}` });
    await waitForTabLoad(tab.id);
    await new Promise(r => setTimeout(r, 800));
    await waitForTabContent(tab.id, '[class*="PaymentItem_time"]', 8000);

    const count = await injectCollector(tab.id, false);
    totalCount += count;

    if (count === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
    } else {
      emptyStreak = 0;
    }

    page++;
    if (page > 200) break;
  }

  settings.lastCollectedAt = new Date().toISOString();
  save();
  showProgress('수집 완료!', 100, `총 ${totalCount}건`);
  setTimeout(hideProgress, 3000);
  toast(`✓ 네이버페이 수집 완료 — 총 ${totalCount}건`);
  render();
}
