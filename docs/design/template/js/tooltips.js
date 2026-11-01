/*
 * Tooltips: a single floating element for every [data-tip] trigger on the page.
 * Hover shows it after 400 ms, keyboard focus shows it at once; Esc, scroll or leaving hides it.
 * Fixed positioning keeps it above panels, menus and the canvas whatever their z-index or overflow.
 */
(function () {
  'use strict';
  const GAP = 6;
  const DELAY = 400;
  let tip = null;
  let timer = 0;
  let current = null;

  function layer() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'buildr-editor bd-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.id = 'bd-tooltip';
    document.body.appendChild(tip);
    return tip;
  }

  function place(el) {
    const t = layer();
    const r = el.getBoundingClientRect();
    const pos = el.getAttribute('data-tip-pos') || 'bottom';
    const tw = t.offsetWidth;
    const th = t.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x;
    let y;
    let side = 'bottom';
    if (pos === 'right') {
      x = r.right + GAP;
      y = r.top + r.height / 2 - th / 2;
      if (x + tw > vw - GAP) x = r.left - GAP - tw;
    } else {
      if (pos === 'end') x = r.right - tw;
      else if (pos === 'start') x = r.left;
      else x = r.left + r.width / 2 - tw / 2;
      y = r.bottom + GAP;
      if (pos === 'top' || y + th > vh - GAP) { y = r.top - GAP - th; side = 'top'; }
    }
    x = Math.max(GAP, Math.min(x, vw - tw - GAP));
    y = Math.max(GAP, Math.min(y, vh - th - GAP));
    t.style.left = Math.round(x) + 'px';
    t.style.top = Math.round(y) + 'px';
    t.setAttribute('data-side', side);
  }

  function show(el, now) {
    clearTimeout(timer);
    const text = el.getAttribute('data-tip');
    if (!text) return;
    current = el;
    const run = () => {
      if (current !== el || !el.isConnected) return;
      const t = layer();
      const themed = el.closest('[data-theme]');
      t.setAttribute('data-theme', themed ? themed.getAttribute('data-theme') : 'light');
      t.textContent = text;
      t.classList.remove('is-on');
      place(el);
      el.setAttribute('aria-describedby', 'bd-tooltip');
      requestAnimationFrame(() => t.classList.add('is-on'));
    };
    if (now) run();
    else timer = setTimeout(run, DELAY);
  }

  function hide() {
    clearTimeout(timer);
    if (current) current.removeAttribute('aria-describedby');
    current = null;
    if (tip) tip.classList.remove('is-on');
  }

  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && el !== current) show(el, false);
    else if (!el && current) hide();
  });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el && el.matches(':focus-visible')) show(el, true);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
})();
