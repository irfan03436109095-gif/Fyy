(() => {
  'use strict';
  const panel = document.querySelector('.hx-article-index');
  if (!panel) return;
  const rail = panel.closest('.article-rail');
  const viewport = document.querySelector('.article-scroll');
  const content = panel.querySelector('.hx-index-content');
  const list = panel.querySelector('.hx-index-list');
  const toggle = panel.querySelector('.hx-index-heading');
  const count = panel.querySelector('.hx-index-count');
  const label = panel.querySelector('.hx-index-menu');
  const browse = panel.querySelector('.hx-index-home');
  const status = panel.querySelector('.hx-index-status');
  const sources = panel.querySelector('.hx-index-sources');
  const articleURL = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
  const key = value => new URL(value, location.href).pathname.replace(/\/+$/, '');
  const sameOriginURL = value => {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol) ? url : null;
    } catch { return null; }
  };
  const currentKey = key(articleURL);
  const catalog = new Map([...panel.querySelector('.hx-index-catalog').content.querySelectorAll('a')]
    .map(a => [key(a.href), a.textContent.trim()]));
  const menus = new Map([...sources.querySelectorAll('[data-index-menu]')]
    .map(a => [a.dataset.indexMenu, sameOriginURL(a.href)]));
  const categories = new Map([...sources.querySelectorAll('[data-index-category]')].map(a => {
    const url = sameOriginURL(a.href);
    const parts = url?.pathname.split('/').filter(Boolean) || [];
    const index = parts.lastIndexOf('categories');
    return [index >= 0 ? decodeURIComponent(parts[index + 1] || '') : '', url];
  }));
  const groups = {
    recommendations: { name: '机场推荐', category: 'plans', prependEntry: true },
    plans: { name: '套餐对比', category: 'plans' },
    beginner: { name: '新手指南', category: 'beginner' },
    tools: { name: '工具下载', category: 'clients-and-tools' },
    about: { name: '关于本站', category: 'site-info' }
  };
  Object.entries(groups).forEach(([id, group]) => {
    group.id = id;
    group.entry = menus.get(group.name);
    group.archive = categories.get(group.category);
  });
  const articleCategories = panel.dataset.currentCategories.trim().split(/\s+/);
  const exact = Object.values(groups).find(g => g.entry && key(g.entry) === currentKey);
  let defaultGroup = exact || groups[
    articleCategories.includes('plans') ? 'plans' :
    articleCategories.includes('beginner') ? 'beginner' :
    articleCategories.includes('clients-and-tools') ? 'tools' : 'about'
  ];
  const requestedID = new URL(location.href).searchParams.get('section');
  const requested = Object.prototype.hasOwnProperty.call(groups, requestedID) ? groups[requestedID] : undefined;
  let referrerGroup;
  if (document.referrer) {
    const referrer = sameOriginURL(document.referrer);
    if (referrer) referrerGroup = Object.values(groups).find(g =>
      (g.entry && key(g.entry) === key(referrer)) ||
      (g.archive && key(g.archive) === key(referrer)));
  }
  let selected = requested || exact || referrerGroup || defaultGroup;

  // The two navigation panels share the real space between the header and footer.
  let queued = false;
  const resizeRail = () => {
    queued = false;
    if (!rail || !viewport) return;
    if (!matchMedia('(min-width: 981px)').matches) {
      rail.style.removeProperty('--hx-rail-height');
      return;
    }
    const port = viewport.getBoundingClientRect();
    const top = Math.max(rail.getBoundingClientRect().top, port.top + 16);
    const height = Math.max(0, Math.floor(port.bottom - top - 16));
    const value = `${height}px`;
    if (rail.style.getPropertyValue('--hx-rail-height') !== value) {
      rail.style.setProperty('--hx-rail-height', value);
    }
  };
  const queueResize = () => {
    if (!queued) { queued = true; requestAnimationFrame(resizeRail); }
  };
  viewport?.addEventListener('scroll', queueResize, { passive: true });
  window.addEventListener('resize', queueResize);
  if (viewport && typeof ResizeObserver === 'function') new ResizeObserver(queueResize).observe(viewport);
  resizeRail();
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    content.hidden = expanded;
    panel.classList.toggle('is-collapsed', expanded);
    queueResize();
  });

  const archives = new Map();
  const readArchive = source => {
    if (archives.has(source.href)) return archives.get(source.href);
    const promise = (async () => {
      const rows = new Map();
      const visited = new Set();
      let next = source;
      // Navigation is capped at the same 100-article limit as XBlog's index.
      while (next && visited.size < 20 && rows.size < 100) {
        if (visited.has(next.href)) break;
        visited.add(next.href);
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 8000);
        let response;
        try { response = await fetch(next.href, { credentials: 'omit', mode: 'same-origin', signal: abort.signal }); }
        finally { clearTimeout(timer); }
        if (!response.ok || !sameOriginURL(response.url)) throw new Error('Archive unavailable');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const cards = doc.querySelector('.article-list');
        if (!cards) throw new Error('Archive list unavailable');
        cards.querySelectorAll('.article-card h2 a[href]').forEach(a => {
          const url = sameOriginURL(new URL(a.getAttribute('href'), response.url));
          if (!url || !url.pathname.includes('/posts/')) return;
          url.search = ''; url.hash = '';
          rows.set(key(url), { url, title: a.textContent.trim() });
        });
        const nextLink = [...doc.querySelectorAll('.pagination a[href]')]
          .find(a => a.relList.contains('next') || a.textContent.includes('下一页'));
        const candidate = nextLink && sameOriginURL(new URL(nextLink.getAttribute('href'), response.url));
        next = candidate && candidate.pathname.startsWith(source.pathname) ? candidate : null;
      }
      return [...rows.values()].slice(0, 100);
    })();
    archives.set(source.href, promise);
    return promise;
  };
  const loadGroup = async group => {
    const rows = group.archive ? [...await readArchive(group.archive)] : [];
    if (group.entry && !rows.some(row => key(row.url) === key(group.entry))) {
      const entry = { url: group.entry, title: catalog.get(key(group.entry)) || group.name };
      if (group.prependEntry) rows.unshift(entry); else rows.push(entry);
    }
    return rows;
  };
  const showGroup = group => {
    label.textContent = group.name;
    const target = group.archive || group.entry;
    if (target) {
      browse.href = target.href;
      browse.textContent = `查看${group.name}文章 ↗`;
    }
    document.querySelectorAll('#site-navigation a[href]').forEach(a => {
      if (!group.entry) return;
      if (key(a.href) === key(group.entry)) a.setAttribute('aria-current', currentKey === key(group.entry) ? 'page' : 'true');
      else a.removeAttribute('aria-current');
    });
  };
  showGroup(selected);
  (async () => {
    let rows = await loadGroup(selected);
    // A copied section parameter cannot put an unrelated article in a menu.
    if (!rows.some(row => key(row.url) === currentKey) && selected !== defaultGroup) {
      selected = defaultGroup;
      rows = await loadGroup(selected);
    }
    showGroup(selected);
    if (!rows.length) throw new Error('No section articles');
    const fragment = document.createDocumentFragment();
    rows.forEach(row => {
      const a = document.createElement('a');
      const url = new URL(row.url);
      url.searchParams.set('section', selected.id);
      a.href = url.href;
      a.textContent = row.title;
      if (key(row.url) === currentKey) a.setAttribute('aria-current', 'page');
      fragment.append(a);
    });
    list.replaceChildren(fragment);
    count.textContent = `${rows.length} 篇`;
    count.hidden = false;
    panel.dataset.indexGroup = selected.id;
    panel.dataset.indexReady = 'true';
    queueResize();
  })().catch(() => {
    // The current article and a normal archive link work without a request.
    status.hidden = false;
    panel.dataset.indexReady = 'fallback';
    queueResize();
  });
})();
