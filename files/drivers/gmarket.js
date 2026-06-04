// CartLog 팝업 드라이버 — 지마켓 (전체수집)
// 확장 팝업 컨텍스트에서 실행 (app.html에서 <script>로 로드, 전역 스코프 공유)

async function collectAllGmarket(tab) {
  const btn = q('#btnCollectAuto');
  showProgress('지마켓 수집 시작...', 0, '');

  // 검색 기간: 2020-01-01 ~ 현재 (전체 기간)
  const startDate = '2020-01-01T00:00:00.000Z';
  const endDate = new Date().toISOString();
  const baseQuery = `searchRangeEnum=SelectDate&searchStartDate=${encodeURIComponent(startDate)}&searchEndDate=${encodeURIComponent(endDate)}&searchWord=&searchKindEnum=All`;

  let totalCount = 0, page = 1, emptyStreak = 0;

  while (true) {
    const pct = Math.min((page / 30) * 100, 95);
    showProgress(`${page}페이지 수집 중`, pct, `누적 ${totalCount}건`);
    btn.textContent = `⏳ ${page}p (누적 ${totalCount}건)`;

    const url = `https://my.gmarket.co.kr/ko/pc/list/all?pageNo=${page}&${baseQuery}`;
    await chrome.tabs.update(tab.id, { url });
    await waitForTabLoad(tab.id);
    await new Promise(r => setTimeout(r, 800));
    await waitForTabContent(tab.id, '.box__order-body, .box__pagination', 8000);

    const count = await injectCollector(tab.id, false);
    totalCount += count;

    if (count === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
    } else {
      emptyStreak = 0;
    }

    // 다음 페이지 존재 여부 확인 (link__pagination-next에 link__pagination--disabled 클래스가 붙으면 종료)
    const [{ result: hasNext }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const next = document.querySelector('.link__pagination-next');
        if (!next) return false;
        return !next.classList.contains('link__pagination--disabled');
      }
    });
    if (!hasNext) break;

    page++;
    if (page > 200) break; // 안전장치
  }

  settings.lastCollectedAt = new Date().toISOString();
  save();
  showProgress('수집 완료!', 100, `총 ${totalCount}건`);
  setTimeout(hideProgress, 3000);
  toast(`✓ 지마켓 수집 완료 — 총 ${totalCount}건`);
  render();
}
