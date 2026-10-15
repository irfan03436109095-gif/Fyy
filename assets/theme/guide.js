(() => {
  'use strict';
  // Preserve the publisher's exact referral URL; only add link semantics.
  document.querySelectorAll('.prose a[href]').forEach(link => {
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const fragmentQuery = url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : '';
    const referral = url.searchParams.has('code') || new URLSearchParams(fragmentQuery).has('code');
    if (url.origin !== location.origin && referral) {
      link.target = '_blank';
      link.rel = [...new Set([...link.relList, 'sponsored', 'noopener', 'noreferrer'])].join(' ');
      link.setAttribute('aria-label', `${link.textContent.trim()}（推广链接，在新标签页打开）`);
    }
  });
})();
