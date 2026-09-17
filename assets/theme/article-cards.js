/* 将文章中明确标记的 Markdown 列表增强为图文卡片，保留原始内容与链接。 */
(() => {
  const prose = document.querySelector('article[data-pagefind-body] > .prose');
  if (!prose) return;
  const text = (node) => (node?.textContent || '').replace(/\s+/gu, ' ').trim();
  const safeLink = (link) => {
    try { return ['http:', 'https:'].includes(new URL(link.getAttribute('href'), document.baseURI).protocol); }
    catch { return false; }
  };
  const inspect = (item) => {
    const marker = item.firstElementChild;
    if (marker?.tagName !== 'P' || text(marker) !== '图文卡片') return null;
    const heading = [...item.children].find((node) => /^H[2-6]$/u.test(node.tagName));
    const image = item.querySelector('img');
    if (!heading || !image) return null;
    const paragraphs = [...item.children].filter((node) => node.tagName === 'P' && !node.querySelector('img,code'));
    const price = paragraphs.find((node) => /^价格\s*[：:]/u.test(text(node)));
    const tags = paragraphs.find((node) => /^标签\s*[：:]/u.test(text(node)));
    const last = paragraphs.filter((node) => ![marker, price, tags].includes(node)).at(-1);
    const links = last ? [...last.querySelectorAll('a[href]')] : [];
    let remainder = text(last);
    links.forEach((link) => { remainder = remainder.replace(text(link), ''); });
    const actions = links.length && links.every(safeLink) && /^[\s|｜、]*$/u.test(remainder) ? last : null;
    return { item, marker, heading, image, price, tags, actions };
  };
  [...prose.children].filter((node) => node.tagName === 'UL').forEach((list) => {
    if (list.classList.contains('article-recommend-grid')) return;
    const cards = [...list.children].map(inspect);
    // 普通列表或填写不完整的列表保留原样，不删除内容。
    if (!cards.length || cards.some((card) => !card)) return;
    list.classList.add('article-recommend-grid');
    list.setAttribute('aria-label', '图文推荐');
    cards.forEach(({ item, marker, heading, image, price, tags, actions }) => {
      const media = document.createElement('div');
      media.className = 'article-recommend-media';
      const imageNode = image.closest('a') || image;
      const oldParent = imageNode.parentElement;
      media.append(imageNode);
      if (oldParent !== item && !text(oldParent) && !oldParent.querySelector('img,video')) oldParent.remove();
      image.loading = 'lazy';
      image.decoding = 'async';
      const failure = document.createElement('span');
      failure.className = 'article-recommend-image-error';
      failure.textContent = '图片暂不可用';
      failure.hidden = true;
      media.append(failure);
      const updateImage = () => {
        const broken = image.complete && !image.naturalWidth;
        media.classList.toggle('image-unavailable', broken);
        failure.hidden = !broken;
      };
      image.addEventListener('error', updateImage);
      image.addEventListener('load', updateImage);
      updateImage();

      const copy = document.createElement('div');
      copy.className = 'article-recommend-copy';
      const header = document.createElement('div');
      header.className = 'article-recommend-heading';
      header.append(heading);
      if (price) {
        const value = text(price).replace(/^价格\s*[：:]\s*/u, '');
        if (value) {
          const badge = document.createElement('span');
          badge.className = 'article-recommend-price';
          badge.textContent = value;
          header.append(badge);
        }
        price.remove();
      }
      let tagList;
      if (tags) {
        const values = text(tags).replace(/^标签\s*[：:]\s*/u, '').split(/[、,，|｜]/u).map((value) => value.trim()).filter(Boolean);
        if (values.length) {
          tagList = document.createElement('div');
          tagList.className = 'article-recommend-tags';
          values.forEach((value) => {
            const tag = document.createElement('span');
            tag.textContent = value;
            tagList.append(tag);
          });
        }
        tags.remove();
      }
      let buttons;
      if (actions) {
        buttons = document.createElement('div');
        buttons.className = 'article-recommend-actions';
        [...actions.querySelectorAll('a[href]')].forEach((link, index) => {
          link.classList.add(index === 0 ? 'recommend-primary' : 'recommend-secondary');
          if (new URL(link.getAttribute('href'), document.baseURI).origin !== location.origin) {
            link.target = '_blank';
            link.classList.add('recommend-external');
          }
          if (link.target === '_blank') {
            link.rel = [...new Set([...(link.rel || '').split(/\s+/u).filter(Boolean), 'noopener', 'noreferrer'])].join(' ');
            link.setAttribute('aria-label', `${text(link)}（新标签页）`);
          }
          buttons.append(link);
        });
        actions.remove();
      }
      marker.remove();
      const body = document.createElement('div');
      body.className = 'article-recommend-body';
      body.append(...item.childNodes);
      copy.append(header, body);
      if (tagList) copy.append(tagList);
      if (buttons) copy.append(buttons);
      item.classList.add('article-recommend-card');
      item.append(media, copy);
    });
  });
})();
