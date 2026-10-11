/* 避免自定义 Google tag 与 XBlog 自动统计重复初始化同一个 GA4 属性。 */
(() => {
  const automatic = document.querySelector('script[data-xblog-google-analytics]');
  if (!automatic) return;
  const id = automatic.getAttribute('data-xblog-google-analytics') || '';
  const hosts = (automatic.getAttribute('data-site-hosts') || '').split(',');
  if (!/^https?:$/.test(location.protocol) || !hosts.includes(location.hostname.toLowerCase())) return;
  const loader = document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]');
  const configured = Array.isArray(window.dataLayer) && window.dataLayer.some(command =>
    command && command[0] === 'config' && command[1] === id
  );
  if (loader && configured) window.__xblogGoogleAnalytics = true;
})();
