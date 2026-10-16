(() => {
  'use strict';
  const list = document.querySelector('[data-all-articles-index] .hx-index-list');
  if (!list) return;
  const current = list.querySelector('[aria-current="page"]');
  if (current) {
    list.scrollTop = Math.max(0, current.offsetTop - (list.clientHeight - current.offsetHeight) / 2);
  }
  list.dataset.indexReady = 'true';
})();
