// CartLog 주입 수집기 — 쿠팡
// ⚠️ 자동 생성/분리된 파일. 쇼핑몰 페이지에 executeScript({files})로 주입됨.
(function () {
  'use strict';
  const NS = (window.__cartlog = window.__cartlog || {});
  NS.collectors = NS.collectors || {};

  NS.collectors.coupang =   function collectCoupang() {
    const { getCategory } = window.__cartlog.helpers;
    const el = document.getElementById('__NEXT_DATA__');
    const nextData = el ? JSON.parse(el.textContent) : null;
    const data = nextData?.props?.pageProps?.domains?.desktopOrder;
    window.__coupangHasNext = data?.orderPagination?.hasNext ?? false;
    if (!data?.orderList?.length) return [];
    const result = [];
    for (const order of data.orderList) {
      const orderId = String(order.orderId);
      const date = order.orderedAt
        ? new Date(order.orderedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      for (const group of order.deliveryGroupList || []) {
        for (const product of group.productList || []) {
          const name = product.vendorItemName || product.productName || '';
          const price = product.discountedUnitPrice ?? product.combinedUnitPrice ?? 0;
          if (!name || !price) continue;
          const cancelled = order.allCanceled || group.allCanceled || product.allCanceled
            || product.cancelReturnStatus != null;
          const productId = product.productId || product.itemId;
          const url = product.productUrl || product.detailUrl
            || (productId ? `https://www.coupang.com/vp/products/${productId}` : '');
          result.push({
            store: 'coupang', name, price, date, orderId, url,
            category: cancelled ? '취소/반품' : getCategory(name),
            collectedAt: new Date().toISOString()
          });
        }
      }
    }
    return result;
  };
})();
