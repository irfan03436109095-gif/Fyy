(() => {
  'use strict';
  const footer = document.querySelector('body > .site-footer');
  const scroll = document.querySelector('.page-scroll');
  if (!footer || !scroll) return;
  const originalPosition = document.createComment('footer desktop position');
  footer.before(originalPosition);
  const mobile = window.matchMedia('(max-width: 760px)');
  const placeFooter = () => {
    if (mobile.matches) {
      if (footer.parentElement !== scroll) scroll.append(footer);
    } else if (footer.parentElement !== originalPosition.parentElement) {
      originalPosition.after(footer);
    }
  };
  placeFooter();
  mobile.addEventListener('change', placeFooter);
})();
