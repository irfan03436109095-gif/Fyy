/* 从 Banner 读取独立首屏标题、文章区文案与按钮，沿用基础轮播。 */
(() => {
  const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
  const settings = {};
  const settingKeys = { '首屏标题': 'heroTitle', '首屏标题第二行': 'heroTitleSecond', '文章区标题': 'title', '文章区说明': 'description' };
  const settingCopies = [...document.querySelectorAll('.hero-banner .banner-copy')];
  const settingTemplate = document.querySelector('#journal-banner-settings');
  if (settingTemplate) settingCopies.push(...settingTemplate.content.querySelectorAll('.banner-copy'));

  // 保留每段原有的链接和强调格式，只移除被识别的设置行。
  const readLines = (paragraph) => {
    const pieces = [];
    let text = '';
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        pieces.push({ node, start: text.length, length: node.data.length, br: false });
        text += node.data;
      } else if (node.nodeName === 'BR') {
        pieces.push({ node, start: text.length, length: 1, br: true });
        text += '\n';
      } else {
        [...node.childNodes].forEach(visit);
      }
    };
    visit(paragraph);
    const point = (offset) => {
      const piece = pieces.find((part) => part.length && offset < part.start + part.length) || pieces.at(-1);
      if (!piece) return [paragraph, 0];
      const within = Math.max(0, Math.min(offset - piece.start, piece.length));
      if (!piece.br) return [piece.node, within];
      return [piece.node.parentNode, [...piece.node.parentNode.childNodes].indexOf(piece.node) + (within ? 1 : 0)];
    };
    return { text, point };
  };

  settingCopies.forEach((copy) => {
    [...copy.querySelectorAll('p')].forEach((paragraph) => {
      if (paragraph.closest('pre,code,table') || paragraph.querySelector('code,img,video,svg,iframe')) return;
      const { text, point } = readLines(paragraph);
      const removals = [];
      let offset = 0;
      text.split('\n').forEach((line) => {
        const match = normalize(line).match(/^(首屏标题第二行|首屏标题|文章区标题|文章区说明)\s*[：:]\s*(.*)$/u);
        const end = Math.min(text.length, offset + line.length + 1);
        if (match) {
          const key = settingKeys[match[1]];
          if (!Object.prototype.hasOwnProperty.call(settings, key)) settings[key] = match[2].trim();
          removals.push([offset, end]);
        }
        offset += line.length + 1;
      });
      removals.reverse().forEach(([start, end]) => {
        const range = document.createRange();
        range.setStart(...point(start));
        range.setEnd(...point(end));
        range.deleteContents();
      });
      if (removals.length && !normalize(paragraph.textContent)) {
        let parent = paragraph.parentElement;
        paragraph.remove();
        while (parent && parent !== copy && !normalize(parent.textContent) && !parent.querySelector('img,video,svg,iframe')) {
          const next = parent.parentElement;
          parent.remove();
          parent = next;
        }
      }
    });
    if (!normalize(copy.textContent) && !copy.querySelector('img,video,svg,iframe')) {
      copy.closest('.banner-slide')?.classList.remove('banner-with-overlay');
      copy.remove();
    }
  });

  const heroHeading = document.querySelector('#journal-title');
  if (heroHeading && (settings.heroTitle || settings.heroTitleSecond)) {
    const lines = [settings.heroTitle, settings.heroTitleSecond].filter(Boolean);
    heroHeading.replaceChildren(...lines.map((text) => {
      const line = document.createElement('span');
      line.textContent = text;
      return line;
    }));
  }

  const articleHeading = document.querySelector('[data-banner-article-heading]');
  if (articleHeading) {
    if (settings.title) articleHeading.querySelector('h2').textContent = settings.title;
    if (Object.prototype.hasOwnProperty.call(settings, 'description')) {
      const description = articleHeading.querySelector('p');
      description.textContent = settings.description;
      description.hidden = !settings.description;
    }
  }
  settingTemplate?.remove();

  const hero = document.querySelector('.hero-copy');
  const banner = hero?.querySelector('.hero-banner');
  if (!banner) return;

  const fallback = hero.querySelector(':scope > .hero-actions');
  const fallbackLink = fallback?.querySelector('a');
  const slides = [...banner.querySelectorAll('.banner-slide')];
  const usableLink = (value) => {
    if (!value || value.includes('ZgotmplZ')) return '';
    try {
      const url = new URL(value, document.baseURI);
      return ['http:', 'https:'].includes(url.protocol) ? value : '';
    } catch {
      return '';
    }
  };
  const fallbackURL = usableLink(fallbackLink?.getAttribute('href'));

  slides.forEach((slide) => {
    const copy = slide.querySelector('.banner-copy');
    if (!copy) return;
    const paragraph = [...copy.querySelectorAll('p')].filter((p) =>
      normalize(p.textContent) || p.querySelector('img,video,svg,iframe')
    ).at(-1);
    if (!paragraph || paragraph.closest('li,table,pre') || paragraph.querySelector('img,video,svg,iframe')) return;

    const text = normalize(paragraph.textContent);
    const links = [...paragraph.querySelectorAll('a[href]')];
    const overlay = slide.querySelector('.banner-link');
    const bannerURL = usableLink(overlay?.getAttribute('href'));
    const marker = text.match(/^按钮(?:文字)?\s*[：:]\s*(.+)$/u);
    // XBlog 实际预览可能把独立 Markdown 链接输出为不带 href 的 span。
    const standaloneSpan = links.length === 0 && [...paragraph.querySelectorAll('span')].some((span) =>
      text === normalize(span.textContent)
    );
    let label = '';
    let href = '';
    let sourceLink = null;

    if (links.length === 1 && text === normalize(links[0].textContent)) {
      // 兼容加粗、引用、尾随换行和空段落包装的 Markdown 链接。
      label = normalize(links[0].textContent);
      sourceLink = links[0];
      href = usableLink(sourceLink.getAttribute('href')) || bannerURL;
    } else if (marker && links.length <= 1) {
      label = marker[1].trim();
      const inlineURL = usableLink(links[0]?.getAttribute('href'));
      href = inlineURL || bannerURL || fallbackURL;
      sourceLink = inlineURL ? links[0] : (bannerURL ? overlay : null);
    } else if ((bannerURL || standaloneSpan) && links.length === 0 && text.length <= 24 && !/[。！？!?，,；;：:]/u.test(text)) {
      // 保留末尾独立文案；缺少目标网址时先沿用已有的文章列表地址。
      label = text;
      href = bannerURL || fallbackURL;
      sourceLink = bannerURL ? overlay : null;
    }
    if (!label || !href) return;

    const action = document.createElement('a');
    action.className = 'journal-button';
    action.setAttribute('href', href);
    action.textContent = label;
    if (sourceLink?.getAttribute('target') === '_blank') {
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
      action.setAttribute('aria-label', `${label}（新标签页）`);
    }
    const actions = document.createElement('div');
    actions.className = 'hero-actions banner-actions';
    actions.append(action);

    // 用按钮替换原文案节点，避免页面同时出现一行文字和默认按钮。
    let parent = paragraph.parentElement;
    paragraph.remove();
    while (parent && parent !== copy && !normalize(parent.textContent) && !parent.querySelector('img,video,svg,iframe')) {
      const next = parent.parentElement;
      parent.remove();
      parent = next;
    }
    overlay?.remove();
    slide.append(actions);
    slide.classList.add('banner-has-action');
  });

  const updateActiveAction = () => {
    const active = slides.find((slide) => slide.getAttribute('aria-hidden') === 'false') || slides[0];
    const custom = !!active?.classList.contains('banner-has-action');
    if (fallback) fallback.hidden = custom;
    banner.classList.toggle('has-active-banner-action', custom);
  };
  banner.classList.add('banner-actions-ready');
  updateActiveAction();
  new MutationObserver(updateActiveAction).observe(banner, {
    attributes: true, subtree: true, attributeFilter: ['aria-hidden'],
  });
})();
