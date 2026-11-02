/* Components page: one theme switch for every section. */
(function () {
  'use strict';
  const names = ['controls', 'left-panel', 'canvas-states', 'dialogs', 'motion'];
  const bar = document.getElementById('tpl-theme');
  const nav = document.querySelector('.tpl-nav');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-pick]');
    if (!b) return;
    const theme = b.getAttribute('data-theme-pick');
    bar.querySelectorAll('[data-theme-pick]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    [bar, nav].forEach((el) => el && el.setAttribute('data-theme', theme));
    document.body.style.background = theme === 'dark' ? '#121317' : '';
    names.forEach((n) => window.Buildr.setProps(n, { theme }));
  });
})();
