/* Full editor: top bar, Bloki/Struktura, canvas, settings panel, dialogs, toasts.
 * Mocked state only: values live in this component's state and reset on reload. */
(function () {
  'use strict';
  const DCLogic = window.Buildr.Component;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { device: null, theme: null, sel: 'heroBtn', leftTab: 'blocks', leftOpen: true, rightOpen: true, inspTab: 'style', guides: false, menuOpen: false, issuesOpen: false, open: { recent: true, basic: true, layout: false }, tb: null, ov: {}, q: '', pop: null, toasts: [], dlg: null, removed: {}, animKey: 0, animId: null, bound: {}, secOpen: { spacing: true, colors: true } };
    try { const so = JSON.parse(window.localStorage.getItem('buildr.editor.sections') || 'null'); if (so) this.state.secOpen = so; } catch (e) {}
    this.tid = 0;
    this.frameEl = null;
    this.onResize = () => this.place();
  }
  componentDidMount() { this.place(); window.addEventListener('resize', this.onResize); setTimeout(() => this.place(), 400); }
  componentWillUnmount() { window.removeEventListener('resize', this.onResize); }
  pushToast(ts) { const id = ++this.tid; this.setState((stt) => ({ toasts: [...(stt.toasts || []), { ...ts, id }].slice(-3) })); setTimeout(() => this.dropToast(id), 5000); }
  dropToast(id) { this.setState((stt) => ({ toasts: (stt.toasts || []).filter((x) => x.id !== id) })); }
  openDlg(k) { this.opener = document.activeElement; this.setState({ dlg: k, menuOpen: false }); setTimeout(() => { const b = document.querySelector('.bd-scrim .bd-btn--primary') || document.querySelector('.bd-scrim .bd-iconbtn'); if (b) b.focus(); }, 30); }
  closeDlg() { this.setState({ dlg: null }); const o = this.opener; if (o && o.focus) setTimeout(() => o.focus(), 0); }
  componentDidUpdate(pp, ps) {
    const s = this.state;
    if (pp.device !== this.props.device || ps.device !== s.device || ps.sel !== s.sel || ps.leftOpen !== s.leftOpen || ps.rightOpen !== s.rightOpen || ps.issuesOpen !== s.issuesOpen) {
      this.place();
      clearTimeout(this.t);
      this.t = setTimeout(() => this.place(), 360);
    }
  }
  place() {
    const f = this.frameEl, sel = this.state.sel;
    let tb = null;
    if (f && sel && sel !== 'page') {
      const el = f.querySelector('[data-blk="' + sel + '"]');
      if (el) {
        let x = 0, y = 0, n = el;
        while (n && n !== f) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
        const h = el.offsetHeight, fw = f.offsetWidth;
        const chipTop = y - 2 - 20, chipLeft = x - 2;
        let top = chipTop - 8 - 40;
        if (top < 4) top = y + h + 2 + 8;
        const left = Math.max(0, Math.min(x - 2, fw - 316));
        tb = { chipTop: Math.round(chipTop), chipLeft: Math.round(chipLeft), top: Math.round(top), left: Math.round(left) };
      }
    }
    const o = this.state.tb;
    if (JSON.stringify(o) !== JSON.stringify(tb)) this.setState({ tb });
  }
  renderVals() {
    const s = this.state;
    const I = {
      desktop: ['M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4', '', ''],
      tablet: ['M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01', ''],
      mobile: ['M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01', ''],
      content: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z', ''],
      style: ['M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22Z', 'M7.5 11h.01M10.5 7h.01M15 7.5h.01', ''],
      adv: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3', 'M2 14h4M10 8h4M18 16h4', ''],
      aL: ['M21 6H3', 'M15 12H3', 'M17 18H3'], aC: ['M21 6H3', 'M17 12H7', 'M19 18H5'], aR: ['M21 6H3', 'M21 12H9', 'M21 18H7'],
      none: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'm5.6 5.6 12.8 12.8', ''],
      page: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', ''],
      section: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 9h18', ''],
      columns: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 3v18', 'M15 3v18'],
      column: ['M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', '', ''],
      heading: ['M6 12h12', 'M6 20V4', 'M18 20V4'],
      text: ['M13 4v16', 'M17 4v16', 'M19 4H9.5a4.5 4.5 0 0 0 0 9H13'],
      button: ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M8 12h8', ''],
      image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'],
      card: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M4 11h16', 'M8 15h6'],
      quote: ['M4 21c3 0 6-1 6-7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2c0 3-1 4-3 4z', 'M15 21c3 0 6-1 6-7V6a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2c0 3-1 4-3 4z', ''],
      list: ['M3 6h.01M3 12h.01M3 18h.01', 'M8 6h13M8 12h13', 'M8 18h13'],
      separator: ['M3 12h18', 'M8 6h8', 'M8 18h8'],
      spacer: ['M12 3v18', 'm8 7 4-4 4 4', 'm8 17 4 4 4-4'],
      gallery: ['M3 3h7v7H3zM14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
      faq: ['M4 4h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M4 14h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z', 'm15 6.5 1.5 1.5L18 6.5'],
      hero: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M6 10h9', 'M6 14h5'],
      video: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'm10 9 5 3-5 3z', ''],
      layout: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 9h18', 'M9 21V9'],
      spacing: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 8h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', ''],
      type: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
      color: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z', '', ''],
      bg: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'm3 16 5-5 4 4 3-3 6 6', ''],
      border: ['M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3', 'M21 16v3a2 2 0 0 1-2 2h-3', 'M8 21H5a2 2 0 0 1-2-2v-3'],
      shadow: ['M4 3h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 20h11a1 1 0 0 0 1-1V8', ''],
      effects: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 17v4M17 19h4', ''],
      anim: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'm10 8 6 4-6 4z', ''],
      eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0', ''],
      pos: ['M12 2v4M12 18v4M2 12h4M18 12h4', 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0', ''],
      code: ['m16 18 6-6-6-6', 'm8 6-6 6 6 6', ''],
      tag: ['M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z', 'M7.5 7.5h.01', ''],
      link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7', ''],
      cond: ['M3 6h18', 'M7 12h10', 'M10 18h4'],
      anchor: ['M12 8a3 3 0 1 0 0-6a3 3 0 1 0 0 6z', 'M12 22V8', 'M5 12H2a10 10 0 0 0 20 0h-3']
    };
    const B = {
      page: { n: 'Strona', t: 'page', p: null },
      hero: { n: 'Sekcja', l: 'Baner', t: 'section', p: 'page' },
      heroCols: { n: 'Kolumny', t: 'columns', p: 'hero' },
      heroCol1: { n: 'Kolumna', t: 'column', p: 'heroCols' },
      heroH: { n: 'Nagłówek', t: 'heading', p: 'heroCol1' },
      heroP: { n: 'Tekst', t: 'text', p: 'heroCol1' },
      heroBtn: { n: 'Przycisk', l: 'Umów konsultację', t: 'button', p: 'heroCol1' },
      heroBtn2: { n: 'Przycisk', l: 'Zobacz realizacje', t: 'button', p: 'heroCol1' },
      heroCol2: { n: 'Kolumna', t: 'column', p: 'heroCols' },
      heroImg: { n: 'Obraz', t: 'image', p: 'heroCol2' },
      offer: { n: 'Sekcja', l: 'Oferta', t: 'section', p: 'page' },
      offerH: { n: 'Nagłówek', t: 'heading', p: 'offer' },
      offerCols: { n: 'Kolumny', t: 'columns', p: 'offer' },
      card1: { n: 'Karta', l: 'Projekt koncepcyjny', t: 'card', p: 'offerCols' },
      card2: { n: 'Karta', l: 'Projekt wykonawczy', t: 'card', p: 'offerCols' },
      card3: { n: 'Karta', l: 'Nadzór nad realizacją', t: 'card', p: 'offerCols' },
      about: { n: 'Sekcja', l: 'Jak pracujemy', t: 'section', p: 'page' },
      aboutText: { n: 'Tekst', t: 'text', p: 'about' },
      quote: { n: 'Cytat', t: 'quote', p: 'about' },
      cta: { n: 'Sekcja', l: 'Kontakt', t: 'section', p: 'page' },
      ctaH: { n: 'Nagłówek', t: 'heading', p: 'cta' },
      ctaBtn: { n: 'Przycisk', l: 'Napisz do nas', t: 'button', p: 'cta' }
    };
    const ico = (k) => { const a = I[k] || I.section; return { d1: a[0], d2: a[1], d3: a[2] }; };
    const pick = (id) => (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.setState({ sel: id, menuOpen: false }); };
    const depth = (id) => { let d = 0, n = B[id].p; while (n) { d++; n = B[n].p; } return d; };

    const device = s.device || this.props.device || 'desktop';
    const themePick = s.theme || this.props.theme || 'light';
    let sysDark = false;
    try { sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) {}
    const theme = themePick === 'system' ? (sysDark ? 'dark' : 'light') : themePick;
    const sel = s.sel;

    const c = {}, p = {};
    Object.keys(B).forEach((id) => { c[id] = sel === id ? 'is-sel' : ''; p[id] = pick(id); });

    const chain = [];
    if (sel) { let n = sel; while (n) { chain.unshift(n); n = B[n].p; } }
    const crumbs = (sel ? chain : ['page']).map((id, i, arr) => ({ name: B[id].n, sep: i > 0, cur: i === arr.length - 1 ? 'true' : 'false', pick: pick(id) }));

    const tree = Object.keys(B).map((id) => ({
      name: B[id].n, label: B[id].l || '', cls: 'bd-trow' + (sel === id ? ' is-sel' : ''), selStr: sel === id ? 'true' : 'false', hasKids: Object.keys(B).some((x) => B[x].p === id), noKids: !Object.keys(B).some((x) => B[x].p === id),
      guides: Array.from({ length: depth(id) }, (_, i) => i), pick: pick(id), ...ico(B[id].t)
    }));

    const G = [
      { k: 'recent', name: 'Ostatnio używane', tiles: [['Przycisk', 'button', 'Link w formie przycisku'], ['Tekst', 'text', 'Akapit z formatowaniem'], ['Kolumny', 'columns', 'Treść obok siebie']] },
      { k: 'basic', name: 'Podstawowe', tiles: [['Nagłówek', 'heading', 'Tytuł sekcji lub strony'], ['Tekst', 'text', 'Akapit z formatowaniem'], ['Przycisk', 'button', 'Link w formie przycisku'], ['Obraz', 'image', 'Zdjęcie lub grafika'], ['Lista', 'list', 'Punktowana lub numerowana'], ['Cytat', 'quote', 'Wyróżniona wypowiedź']] },
      { k: 'layout', name: 'Układ', tiles: [['Sekcja', 'section', 'Kontener na całą szerokość'], ['Kolumny', 'columns', 'Treść obok siebie'], ['Odstęp', 'spacer', 'Pusta przestrzeń o stałej wysokości'], ['Separator', 'separator', 'Pozioma linia']] },
      { k: 'media', name: 'Media', tiles: [['Galeria', 'gallery', 'Siatka zdjęć z powiększeniem'], ['Wideo', 'video', 'Film z pliku lub serwisu']] },
      { k: 'content', name: 'Treść', tiles: [['Karta', 'card', 'Obraz, tytuł, tekst i przycisk'], ['Baner (Hero)', 'hero', 'Duży nagłówek z tłem i przyciskami']] },
      { k: 'inter', name: 'Interakcje', tiles: [['FAQ / Akordeon', 'faq', 'Rozwijane pytania i odpowiedzi']] }
    ];
    const groups = G.map((g) => {
      const open = !!s.open[g.k];
      return {
        name: g.name, count: String(g.tiles.length), open, openStr: open ? 'true' : 'false',
        toggle: () => this.setState({ open: { ...s.open, [g.k]: !open } }),
        tiles: g.tiles.map(([n, k, d]) => ({ name: n, desc: d, aria: 'Dodaj blok: ' + n, ...ico(k) }))
      };
    });

    const t = sel ? B[sel].t : 'page';
    const devK = device;
    const devName = { desktop: 'Komputer', tablet: 'Tablet', mobile: 'Telefon' }[device];
    const devIco = ico(device);
    const q = (s.q || '').trim().toLowerCase();
    const KIND = (id) => { const ty = B[id].t; return ty === 'button' ? 'button' : ty === 'image' ? 'image' : ['heading', 'text', 'quote', 'card'].includes(ty) ? 'text' : 'box'; };
    const C = (hex, a) => ({ hex, a: a == null ? 100 : a });
    const DEF = (id) => {
      const d = { ta: 'left', m: { t: 0, r: 0, b: 0, l: 0 }, mLink: true, p: { t: 0, r: 0, b: 0, l: 0 }, pLink: true, fs: 16, fw: '400', fg: C('#15201d'), btnBg: C('#1f6f5c'), bgType: 'none', bg: C('#ffffff'), r: 0, sh: 'none', op: 100, aType: 'none', aDur: 600, aEase: 'out',
        hideD: false, hideT: false, hideM: false, pos: 'static', elId: '', cls: '', anchor: '', css: '', label: '', url: '', newTab: false, alt: '', tag: 'h2', desc: '', name: B[id].l || B[id].n };
      const o = {
        heroBtn: { label: 'Umów konsultację', url: '/kontakt', p: { t: 0, r: 24, b: 0, l: 24 }, pLink: false, fs: 15, fw: '600', fg: C('#ffffff'), r: 10 },
        heroBtn2: { label: 'Zobacz realizacje', url: '', p: { t: 0, r: 24, b: 0, l: 24 }, pLink: false, fs: 15, fw: '600', btnBg: C('#ffffff', 0), r: 10 },
        ctaBtn: { label: 'Napisz do nas', url: '/kontakt', p: { t: 0, r: 24, b: 0, l: 24 }, pLink: false, fs: 15, fw: '600', btnBg: C('#ffffff'), r: 10 },
        heroH: { label: 'Wnętrza, w których chce się zostać na dłużej', fs: 48, fw: '700', tag: 'h1' },
        offerH: { label: 'Trzy etapy, jedna osoba prowadząca', fs: 34, fw: '700' },
        ctaH: { label: 'Porozmawiajmy o Twoim wnętrzu', fs: 32, fw: '700', fg: C('#ffffff') },
        heroP: { desc: 'Projektujemy mieszkania i małe biura od pierwszego szkicu po odbiór. Spokojnie, z jasnym planem i budżetem.', fs: 18, fg: C('#4a5753') },
        aboutText: { desc: 'Zaczynamy od rozmowy o tym, jak mieszkasz na co dzień. Dopiero potem rysujemy.', fg: C('#4a5753') },
        quote: { desc: 'Pierwszy raz remont nie zjadł nam nerwów.', label: 'Klientka, mieszkanie na Mokotowie', fs: 20, fw: '600', bgType: 'color', bg: C('#eef4f1'), r: 14, p: { t: 28, r: 32, b: 28, l: 32 }, pLink: false },
        heroImg: { r: 16, alt: '' },
        heroCols: { bgType: 'color', bg: C('#f6f3ee'), p: { t: 72, r: 48, b: 72, l: 48 }, pLink: false },
        cta: { m: { t: 0, r: 48, b: 72, l: 48 }, mLink: false }
      };
      ['card1', 'card2', 'card3'].forEach((cid, i) => { o[cid] = { label: ['Projekt koncepcyjny', 'Projekt wykonawczy', 'Nadzór nad realizacją'][i], url: '#oferta', bgType: 'color', bg: C('#ffffff'), r: 14, p: { t: 28, r: 28, b: 28, l: 28 } }; });
      return { ...d, ...(o[id] || {}) };
    };
    const RESP = { ta: 1, m: 1, p: 1, fs: 1 };
    const chainOf = (dv) => dv === 'mobile' ? ['mobile', 'tablet', 'desktop'] : dv === 'tablet' ? ['tablet', 'desktop'] : ['desktop'];
    const getOf = (id, k, dv) => { const o = (s.ov[id]) || {}; if (RESP[k]) { for (const d of chainOf(dv || devK)) { if (o[d] && k in o[d]) return o[d][k]; } } else if (o.desktop && k in o.desktop) return o.desktop[k]; return DEF(id)[k]; };
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const rgba = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(((c && c.hex) || '').trim()); if (!m) return 'transparent'; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + ((c.a ?? 100) / 100) + ')'; };
    const SH = { none: 'none', soft: '0 1px 3px rgba(21, 32, 29, 0.12)', medium: '0 8px 24px -4px rgba(21, 32, 29, 0.18)', strong: '0 20px 48px -8px rgba(21, 32, 29, 0.28)' };
    const EASE = { standard: ['Łagodna', '0.2, 0, 0, 1'], out: ['Wyhamowanie', '0, 0, 0.2, 1'], in: ['Przyspieszenie', '0.4, 0, 1, 1'], spring: ['Sprężysta', '0.34, 1.56, 0.64, 1'] };

    // ---- canvas output: style string per block ----
    const st = {}, al = {}, tx = {};
    const hiddenOn = (id) => !!getOf(id, { desktop: 'hideD', tablet: 'hideT', mobile: 'hideM' }[devK]);
    Object.keys(B).forEach((id) => {
      if (id === 'page') return;
      const D0 = DEF(id), g = (k) => getOf(id, k), ch = (k) => !eq(g(k), D0[k]);
      const out = [];
      if (id === 'cta') out.push('padding-top: 1px');
      if (ch('ta')) out.push('text-align: ' + g('ta'));
      if (ch('m')) { const m = g('m'); out.push('margin: ' + m.t + 'px ' + m.r + 'px ' + m.b + 'px ' + m.l + 'px'); }
      if (ch('p')) { const p = g('p'); out.push('--o-pad: ' + p.t + 'px ' + p.r + 'px ' + p.b + 'px ' + p.l + 'px'); }
      if (ch('fs')) out.push('--o-fs: ' + g('fs') + 'px');
      if (ch('fw')) out.push('--o-fw: ' + g('fw'));
      if (ch('fg')) out.push('--o-fg: ' + rgba(g('fg')));
      if (KIND(id) === 'button' && ch('btnBg')) out.push('--o-bg: ' + rgba(g('btnBg')));
      if (KIND(id) !== 'button' && (ch('bgType') || ch('bg'))) out.push('--o-bg: ' + (g('bgType') === 'none' ? 'transparent' : rgba(g('bg'))));
      if (ch('r')) out.push('--o-r: ' + g('r') + 'px');
      if (ch('sh')) out.push('--o-sh: ' + SH[g('sh')]);
      if (ch('op')) out.push('opacity: ' + g('op') / 100);
      if (g('aType') !== 'none') { const ty = g('aType'); out.push('--adur: ' + g('aDur') + 'ms', '--aease: cubic-bezier(' + EASE[g('aEase')][1] + ')', '--a-op: 0', '--a-x: 0px', '--a-y: ' + (ty === 'slide' ? '32px' : '0px'), '--a-sc: ' + (ty === 'zoom' ? '0.9' : '1')); }
      st[id] = out.join('; ');
      al[id] = B[id].n + (B[id].l ? ': ' + B[id].l : '') + (sel === id ? ' (zaznaczony)' : '');
      tx[id] = g('label');
      const extra = (hiddenOn(id) ? ' is-hidden-dev' : '') + ((s.removed || {})[id] ? ' is-removed' : '') + (s.animId === id && s.animKey > 0 ? (s.animKey % 2 ? ' is-run-a' : ' is-run-b') : '');
      c[id] = (c[id] + extra).trim();
    });

    // ---- inspector model ----
    const hasSelBlock = !!sel;
    const sid = sel || 'page';
    const D = DEF(sid);
    const get = (k) => getOf(sid, k);
    const changed = (k) => !eq(get(k), D[k]);
    const ovr = (k) => devK !== 'desktop' && RESP[k] && s.ov[sid] && s.ov[sid][devK] && k in s.ov[sid][devK];
    const set = (k, val) => this.setState((stt) => { const target = RESP[k] && devK !== 'desktop' ? devK : 'desktop'; const cur = stt.ov[sid] || {}; return { ov: { ...stt.ov, [sid]: { ...cur, [target]: { ...(cur[target] || {}), [k]: val } } } }; });
    const reset = (k) => this.setState((stt) => { const cur = { ...(stt.ov[sid] || {}) }; const target = devK !== 'desktop' && RESP[k] && cur[devK] && k in cur[devK] ? devK : 'desktop'; const o = { ...(cur[target] || {}) }; delete o[k]; cur[target] = o; return { ov: { ...stt.ov, [sid]: cur } }; });
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const num = (x) => { const n = parseFloat(x); return isNaN(n) ? 0 : n; };
    const scrub = (k, min, max, step) => (e) => { if (e.button !== 0) return; const sx = e.clientX, sv = num(get(k)); const mv = (ev) => set(k, clamp(sv + Math.round((ev.clientX - sx) / 3) * step * (ev.shiftKey ? 10 : 1), min, max)); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };
    const labelParts = (label) => { const i = q ? label.toLowerCase().indexOf(q) : -1; return i < 0 ? { lpre: label, lmid: '', lpost: '' } : { lpre: label.slice(0, i), lmid: label.slice(i, i + q.length), lpost: label.slice(i + q.length) }; };
    const FLAGS = { isRange: false, isSeg: false, isNum: false, isSelect: false, isFont: false, isColor: false, isSwitch: false, isText: false, isArea: false, isSides: false, isPad: false, isBox: false, isCorners: false, isShadowCards: false, isCards: false, isCurve: false, isPlay: false, isBgPrev: false, isImg: false, isChecks: false, isVis: false, isCond: false, isKV: false, isMore: false, isNote: false };
    const base = (k, label, o) => { o = o || {}; const chg = changed(k), ov = ovr(k); return { key: k, id: 'mf-' + k, label, kw: o.kw || '', ...labelParts(label), isGeneric: true, isSub: false, rowCls: 'bd-field' + (o.top ? ' bd-field--top' : '') + (chg ? ' is-changed' : ''), labelCls: 'bd-flabel' + (o.scrub ? ' bd-flabel--scrub' : ''), scrub: o.scrub || (() => {}), scrubTip: o.scrub ? 'Przeciągnij w bok, aby zmienić wartość' : '', resp: !!RESP[k], devCls: 'bd-dev' + (ov ? ' is-ovr' : ''), devTip: ov ? 'Własna wartość dla: ' + devName.toLowerCase() : 'Wartość responsywna – edytujesz: ' + devName.toLowerCase(), hasHelp: !!o.help, help: o.help || '', changed: chg, unchanged: !chg, reset: () => reset(k), hasResetSlot: true, ...FLAGS }; };
    const range = (k, label, min, max, step, unit, o) => { const val = get(k); return { ...base(k, label, { ...o, scrub: scrub(k, min, max, step) }), isRange: true, min: String(min), max: String(max), step: String(step), val: String(val), unit, valText: val + ' ' + unit, p: clamp((num(val) - min) / (max - min) * 100, 0, 100).toFixed(1) + '%', onVal: (e) => set(k, Number(e.target.value)) }; };
    const seg = (k, label, opts, o) => { o = o || {}; const cur = get(k); return { ...base(k, label, o), isSeg: true, segCls: 'bd-seg bd-seg--fill' + (o.icons ? ' bd-seg--icons' : ''), opts: opts.map(([v, text, icon, tip], i) => ({ checked: cur === v ? 'true' : 'false', aria: tip || text, tip: tip || '', tipPos: i === opts.length - 1 ? 'end' : '', hasIcon: !!icon, hasText: !icon, text, ...ico(icon || 'layout'), pick: () => set(k, v) })) }; };
    const select = (k, label, opts, o) => ({ ...base(k, label, o), isSelect: true, val: String(get(k)), opts: opts.map(([v, l]) => ({ v, l })), onVal: (e) => set(k, e.target.value) });
    const sw = (k, label, o) => ({ ...base(k, label, o), isSwitch: true, on: get(k) ? 'true' : 'false', toggle: () => set(k, !get(k)) });
    const text = (k, label, o) => { o = o || {}; const bound = !!(o.bind && (s.bound || {})[sid + k]); return { ...base(k, label, { ...o, top: true }), isText: true, val: bound ? '{wpis.link}' : String(get(k)), placeholder: o.placeholder || '', inputCls: 'bd-input' + (o.mono ? ' mono' : '') + (bound ? ' is-bound' : ''), onVal: (e) => set(k, e.target.value), bound, canBind: !!o.bind, srcCls: 'bd-srcmode' + (bound ? ' is-on' : ''), srcTip: bound ? 'Powiązane z danymi – kliknij, by wpisać stałą wartość' : 'Pobierz wartość z danych (Stała / Dane / Formuła)', toggleBind: () => this.setState((stt) => ({ bound: { ...(stt.bound || {}), [sid + k]: !(stt.bound || {})[sid + k] } })) }; };
    const area = (k, label, o) => ({ ...base(k, label, { ...o, top: true }), isArea: true, val: String(get(k)), placeholder: (o && o.placeholder) || '', inputCls: 'bd-input bd-input--area' + (o && o.mono ? ' mono' : ''), onVal: (e) => set(k, e.target.value) });
    const PAL = [['Marka', '#1f6f5c'], ['Marka ciemna', '#17574a'], ['Tekst', '#15201d'], ['Tekst drugorzędny', '#4a5753'], ['Mięta', '#eef4f1'], ['Piasek', '#f6f3ee'], ['Biały', '#ffffff'], ['Akcent ciepły', '#c8742c']];
    const color = (k, label, o) => { const cv = get(k); const open = s.pop === k; return { ...base(k, label, o), isColor: true, hex: cv.hex, op: String(cv.a), css: rgba(cv), open, openStr: open ? 'true' : 'false', toggle: () => this.setState({ pop: open ? null : k }), onHex: (e) => { let h = e.target.value.trim(); if (h && h[0] !== '#') h = '#' + h; set(k, { ...cv, hex: h }); }, onOp: (e) => set(k, { ...cv, a: clamp(num(e.target.value), 0, 100) }), opP: cv.a + '%', hue: '0', hueP: '0%', onHue: () => {}, palette: PAL.map(([n, h]) => ({ name: n, hex: h, on: h === (cv.hex || '').toLowerCase() ? 'true' : 'false', pick: () => set(k, { hex: h, a: cv.a === 0 ? 100 : cv.a }) })) }; };
    const sub = (label) => ({ ...base('_', label), isGeneric: false, isSub: true });
    const special = (kind, extra) => ({ ...base('_' + kind, (extra && extra.label) || ''), isGeneric: false, [kind]: true, changed: false, ...(extra || {}) });
    const boxSide = (k, lk) => { const v = get(k), linked = get(lk); const o = {}; ['t', 'r', 'b', 'l'].forEach((sd) => { o[sd] = { val: String(v[sd]), cls: v[sd] !== D[k][sd] ? 'is-changed' : '', onVal: (e) => { const n = num(e.target.value); set(k, linked ? { t: n, r: n, b: n, l: n } : { ...get(k), [sd]: n }); } }; }); return o; };
    const lt = (k) => ({ [k + 'Linked']: get(k + 'Link') ? 'true' : 'false' });
    const kind = KIND(sid);

    const styleSecs = [];
    if (kind !== 'image') styleSecs.push({ key: 'layout', name: 'Układ', icon: 'layout', fields: [seg('ta', 'Wyrównanie tekstu', [['left', 'Do lewej', 'aL', 'Wyrównaj do lewej'], ['center', 'Do środka', 'aC', 'Wyśrodkuj'], ['right', 'Do prawej', 'aR', 'Wyrównaj do prawej']], { icons: true, kw: 'align' })] });
    styleSecs.push({ key: 'spacing', name: 'Odstępy', icon: 'spacing', keys: ['m', 'p', 'mLink', 'pLink'], fields: [special('isBox', { label: 'Margines i dopełnienie', kw: 'margines dopełnienie padding margin odstęp', m: boxSide('m', 'mLink'), p: boxSide('p', 'pLink'), units: ['px', '%', 'rem', 'vw'], mUnit: 'px', pUnit: 'px', onMUnit: () => {}, onPUnit: () => {}, mLinked: get('mLink') ? 'true' : 'false', pLinked: get('pLink') ? 'true' : 'false', mLinkTip: get('mLink') ? 'Rozłącz marginesy' : 'Połącz marginesy', pLinkTip: get('pLink') ? 'Rozłącz dopełnienie' : 'Połącz dopełnienie', mLinkMid: get('mLink') ? 'M8 12h8' : '', pLinkMid: get('pLink') ? 'M8 12h8' : '', toggleMLink: () => set('mLink', !get('mLink')), togglePLink: () => set('pLink', !get('pLink')), devCls: 'bd-dev' + (ovr('m') || ovr('p') ? ' is-ovr' : ''), devTip: ovr('m') || ovr('p') ? 'Własne odstępy dla: ' + devName.toLowerCase() : 'Odstępy responsywne – edytujesz: ' + devName.toLowerCase() })] });
    if (kind !== 'image') styleSecs.push({ key: 'type', name: 'Typografia', icon: 'type', fields: [range('fs', 'Rozmiar', 10, 72, 1, 'px', { kw: 'font size czcionka' }), select('fw', 'Grubość', [['400', 'Normalna (400)'], ['500', 'Średnia (500)'], ['600', 'Półgruba (600)'], ['700', 'Gruba (700)']], { kw: 'weight bold' })] });
    if (kind !== 'image') styleSecs.push({ key: 'colors', name: 'Kolory', icon: 'color', fields: kind === 'button' ? [color('btnBg', 'Kolor przycisku', { kw: 'button tło' }), color('fg', 'Kolor tekstu', { kw: 'text' })] : [color('fg', 'Kolor tekstu', { kw: 'text' })] });
    if (kind !== 'button' && kind !== 'image') { const f = [seg('bgType', 'Rodzaj tła', [['none', 'Brak', 'none', 'Brak tła'], ['color', 'Kolor', 'color', 'Jednolity kolor']], { icons: true, kw: 'background' })]; if (get('bgType') === 'color') f.push(color('bg', 'Kolor tła')); f.push(special('isNote', { label: 'Gradient, obraz i wideo: te same pola co na tablicy „Panel ustawień”.' })); styleSecs.push({ key: 'bg', name: 'Tło', icon: 'bg', fields: f, keys: ['bg'] }); }
    styleSecs.push({ key: 'border', name: 'Obramowanie i zaokrąglenia', icon: 'border', fields: [range('r', 'Zaokrąglenie', 0, 40, 1, 'px', { kw: 'radius rogi' })] });
    styleSecs.push({ key: 'shadow', name: 'Cień', icon: 'shadow', keys: ['sh'], fields: [special('isShadowCards', { kw: 'cień shadow', css: SH[get('sh')], cards: [['none', 'Brak'], ['soft', 'Delikatny'], ['medium', 'Średni'], ['strong', 'Mocny']].map(([k, n]) => ({ name: n, css: SH[k], on: get('sh') === k ? 'true' : 'false', pick: () => set('sh', k) })) })] });
    styleSecs.push({ key: 'effects', name: 'Efekty', icon: 'effects', fields: [range('op', 'Krycie', 0, 100, 1, '%', { kw: 'opacity przezroczystość' })] });
    const af = [select('aType', 'Animacja wejścia', [['none', 'Brak'], ['fade', 'Pojawienie'], ['slide', 'Wysunięcie z dołu'], ['zoom', 'Powiększenie']], { kw: 'animacja wejście' })];
    if (get('aType') !== 'none') af.push(range('aDur', 'Czas trwania', 100, 2000, 50, 'ms'), select('aEase', 'Krzywa', Object.keys(EASE).map((k) => [k, EASE[k][0]])), special('isPlay', { play: () => this.setState((stt) => ({ animId: sid, animKey: (stt.animKey || 0) + 1 })) }));
    styleSecs.push({ key: 'anim', name: 'Animacje', icon: 'anim', fields: af });

    const contentFields = kind === 'button' ? [text('label', 'Tekst przycisku'), text('url', 'Adres linku', { mono: true, bind: true, placeholder: 'np. /kontakt' }), sw('newTab', 'Otwórz w nowej karcie')]
      : t === 'heading' ? [text('label', 'Treść nagłówka'), seg('tag', 'Poziom', [['h1', 'H1', null, 'Nagłówek 1. poziomu'], ['h2', 'H2', null, 'Nagłówek 2. poziomu'], ['h3', 'H3', null, 'Nagłówek 3. poziomu']], { help: 'Ważne dla SEO i czytników ekranu. Na stronie powinien być jeden H1.' })]
      : t === 'image' ? [special('isImg', {}), text('alt', 'Tekst alternatywny', { placeholder: 'Opisz, co widać na zdjęciu', help: 'Czytają go osoby niewidome i wyszukiwarki.' }), text('url', 'Link po kliknięciu', { mono: true, placeholder: 'brak' })]
      : t === 'card' ? [text('label', 'Tytuł'), text('url', 'Link', { mono: true, bind: true })]
      : t === 'quote' ? [area('desc', 'Cytat'), text('label', 'Autor')]
      : t === 'text' ? [area('desc', 'Treść')]
      : t === 'page' ? [text('name', 'Tytuł strony'), special('isNote', { label: 'Adres: pracowniakadr.pl/ · opis dla wyszukiwarek w ustawieniach strony w CMS.' })]
      : [text('name', 'Nazwa w strukturze', { help: 'Widoczna tylko w edytorze.' })];
    const contentSecs = [{ key: 'c-main', name: t === 'image' ? 'Obraz' : t === 'button' ? 'Tekst i link' : 'Treść', icon: t === 'image' ? 'image' : t === 'button' ? 'link' : 'text', fields: contentFields }];
    const advSecs = [
      { key: 'a-vis', name: 'Widoczność', icon: 'eye', keys: ['hideD', 'hideT', 'hideM'], fields: [special('isVis', { kw: 'ukryj', vis: [['hideD', 'Komputer', 'desktop'], ['hideT', 'Tablet', 'tablet'], ['hideM', 'Telefon', 'mobile']].map(([k, n, ic]) => ({ name: n, aria: (get(k) ? 'Pokaż' : 'Ukryj') + ' na urządzeniu: ' + n.toLowerCase(), on: get(k) ? 'true' : 'false', toggle: () => set(k, !get(k)), ...ico(ic) })) })] },
      { key: 'a-cond', name: 'Warunek wyświetlania', icon: 'cond', fields: [special('isCond', {})] },
      { key: 'a-pos', name: 'Pozycjonowanie', icon: 'pos', fields: [select('pos', 'Pozycja', [['static', 'Domyślna (w przepływie)'], ['relative', 'Względna'], ['absolute', 'Bezwzględna'], ['sticky', 'Przyklejona'], ['fixed', 'Stała w oknie']])] },
      { key: 'a-id', name: 'Identyfikator i klasa CSS', icon: 'tag', fields: [text('elId', 'Identyfikator', { mono: true }), text('cls', 'Klasa CSS', { mono: true, help: 'Kilka klas oddziel spacją.' })] },
      { key: 'a-anchor', name: 'Kotwica', icon: 'anchor', fields: [text('anchor', 'Nazwa kotwicy', { mono: true, placeholder: 'np. oferta' })] },
      { key: 'a-attr', name: 'Atrybuty', icon: 'list', fields: [special('isKV', {})] },
      { key: 'a-css', name: 'Własny CSS', icon: 'code', fields: [area('css', 'Reguły CSS', { mono: true, placeholder: 'selector { }' })] }
    ];
    const secOpen = s.secOpen || {};
    const keysOf = (sec) => { const k = new Set(sec.keys || []); sec.fields.forEach((f) => { if (f.key && f.key[0] !== '_') k.add(f.key); }); return [...k]; };
    const tabSecs = { content: contentSecs, style: styleSecs, adv: advSecs };
    const tabKey = s.inspTab;
    const sections = tabSecs[tabKey].map((sec) => {
      const keys = keysOf(sec);
      const mod = keys.some((k) => k in D && changed(k));
      const ovs = keys.filter((k) => ovr(k));
      const nameHit = q && sec.name.toLowerCase().includes(q);
      let fields = sec.fields;
      if (q && !nameHit) fields = fields.filter((f) => !f.isSub && ((f.label || '').toLowerCase().includes(q) || (f.kw || '').includes(q)));
      const visible = !q || nameHit || fields.length > 0;
      const open = q ? visible : !!secOpen[sec.key];
      return { visible, name: sec.name, ...ico(sec.icon), mod, ovr: ovs.length > 0, ovrCount: String(ovs.length), ovrLabel: ovs.length + ' wartości dla: ' + devName.toLowerCase(), open, openStr: open ? 'true' : 'false', bodyId: 'msec-' + sec.key, bodyCls: 'bd-sec__body' + (open ? ' is-open' : ''),
        toggle: () => { const o = { ...(this.state.secOpen || {}), [sec.key]: !(this.state.secOpen || {})[sec.key] }; try { window.localStorage.setItem('buildr.editor.sections', JSON.stringify(o)); } catch (e) {} this.setState({ secOpen: o }); },
        reset: () => this.setState((stt) => { const cur = { ...(stt.ov[sid] || {}) }; ['desktop', 'tablet', 'mobile'].forEach((d) => { if (d !== 'desktop' && d !== devK) return; const o = { ...(cur[d] || {}) }; keys.forEach((k) => { if (d === devK || !RESP[k]) delete o[k]; }); cur[d] = o; }); return { ov: { ...stt.ov, [sid]: cur } }; }),
        fields };
    }).filter((x) => x.visible);
    const tabMod = (tk) => tabSecs[tk].some((sec) => keysOf(sec).some((k) => k in D && changed(k)));
    const allKeys = tabSecs[tabKey].map((x) => x.key);
    const allOpen = allKeys.every((k) => secOpen[k]);
    const TABS = [['content', 'Treść', 'Treść i link bloku', ''], ['style', 'Styl', 'Wygląd bloku', ''], ['adv', 'Zaawansowane', 'Widoczność, pozycja, CSS', 'end']];

    // ---- issues, toasts, dialogs ----
    const issue1 = !getOf('heroImg', 'alt'), issue2 = !getOf('heroBtn2', 'url');
    const nIss = (issue1 ? 1 : 0) + (issue2 ? 1 : 0);
    const TI = { ok: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'm8 12 3 3 5-6'], undo: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'] };
    const toasts = (s.toasts || []).map((ts) => ({ text: ts.text, cls: ts.kind === 'ok' ? 'ok' : '', d1: TI[ts.icon || 'ok'][0], d2: TI[ts.icon || 'ok'][1], hasAct: !!ts.actText, actText: ts.actText || '', act: () => { if (ts.undo) this.setState((stt) => ({ removed: { ...(stt.removed || {}), [ts.undo]: false }, sel: ts.undo })); this.dropToast(ts.id); }, close: () => this.dropToast(ts.id) }));
    const canvasKey = (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-blk]') : null;
      if (!el) return;
      const id = el.getAttribute('data-blk');
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.setState({ sel: id }); }
      else if (e.key === 'Escape') { const pid = B[id].p; if (pid && pid !== 'page') { e.preventDefault(); this.setState({ sel: pid }); const pe = this.frameEl && this.frameEl.querySelector('[data-blk="' + pid + '"]'); if (pe) pe.focus(); } }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel === id) { e.preventDefault(); this.setState((stt) => ({ removed: { ...(stt.removed || {}), [id]: true }, sel: B[id].p === 'page' ? null : B[id].p })); this.pushToast({ text: 'Usunięto blok „' + (B[id].l || B[id].n) + '”', icon: 'undo', actText: 'Cofnij', undo: id }); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); this.pushToast({ text: 'Zduplikowano blok „' + (B[id].l || B[id].n) + '”', icon: 'ok', kind: 'ok' }); }
      else if (e.key === '?') { this.openDlg('keys'); }
    };
    const parentId = sel ? B[sel].p : null;
    const frameW = device === 'desktop' ? '100%' : device === 'tablet' ? 'var(--bd-device-tablet)' : 'var(--bd-device-mobile)';

    return {
      theme, yes: true, hasTarget: !!sel && sel !== 'page', targetName: sel && sel !== 'page' ? B[sel].n : '',
      cols: (s.leftOpen ? 'var(--bd-left)' : 'var(--bd-rail)') + ' minmax(0, 1fr) ' + (s.rightOpen ? 'var(--bd-right)' : 'var(--bd-rail)'),
      leftOpen: s.leftOpen, leftClosed: !s.leftOpen, leftOpenStr: s.leftOpen ? 'true' : 'false',
      rightOpen: s.rightOpen, rightClosed: !s.rightOpen, rightOpenStr: s.rightOpen ? 'true' : 'false',
      toggleLeft: () => this.setState({ leftOpen: !s.leftOpen }),
      toggleRight: () => this.setState({ rightOpen: !s.rightOpen }),
      openBlocks: (e) => { if (e && e.stopPropagation) e.stopPropagation(); this.setState({ leftOpen: true, leftTab: 'blocks' }); },
      openTree: () => this.setState({ leftOpen: true, leftTab: 'tree' }),
      openContent: () => this.setState({ rightOpen: true, inspTab: 'content' }),
      openStyle: () => this.setState({ rightOpen: true, inspTab: 'style' }),
      openAdv: () => this.setState({ rightOpen: true, inspTab: 'adv' }),
      dev: { desktop: device === 'desktop' ? 'true' : 'false', tablet: device === 'tablet' ? 'true' : 'false', mobile: device === 'mobile' ? 'true' : 'false' },
      setDesktop: () => this.setState({ device: 'desktop' }),
      setTablet: () => this.setState({ device: 'tablet' }),
      setMobile: () => this.setState({ device: 'mobile' }),
      isDevice: device !== 'desktop',
      deviceLabel: device === 'tablet' ? 'Tablet · 768 px' : 'Telefon · 390 px',
      deviceReadout: devName + (device === 'desktop' ? ' · pełna szerokość' : device === 'tablet' ? ' · 768 px' : ' · 390 px'),
      deviceNote: device !== 'desktop' && s.inspTab === 'style', deviceName: devName.toLowerCase(),
      frameW, frameCls: 'bd-frame dev-' + device + (device !== 'desktop' ? ' is-device' : '') + (s.guides ? ' show-guides' : ''),
      frameRef: (el) => { this.frameEl = el; },
      menuOpen: s.menuOpen, menuOpenStr: s.menuOpen ? 'true' : 'false',
      toggleMenu: () => this.setState({ menuOpen: !s.menuOpen }),
      th: { light: themePick === 'light' ? 'true' : 'false', dark: themePick === 'dark' ? 'true' : 'false', system: themePick === 'system' ? 'true' : 'false' },
      setSystem: () => this.setState({ theme: 'system' }),
      setLight: () => this.setState({ theme: 'light' }),
      setDark: () => this.setState({ theme: 'dark' }),
      guidesStr: s.guides ? 'true' : 'false', guidesMark: s.guides ? 'Wł.' : 'Wył.',
      toggleGuides: () => this.setState({ guides: !s.guides, menuOpen: false }),
      lt: { blocks: s.leftTab === 'blocks' ? 'true' : 'false', tree: s.leftTab === 'tree' ? 'true' : 'false', blocksOn: s.leftTab === 'blocks', treeOn: s.leftTab === 'tree' },
      tabBlocks: () => this.setState({ leftTab: 'blocks' }),
      tabTree: () => this.setState({ leftTab: 'tree' }),
      groups, tree, crumbs, sections, st, al, tx, canvasKey,
      devIco, devName: devName.toLowerCase(), devNote: device !== 'desktop' && s.inspTab === 'style' && hasSelBlock,
      tabs: TABS.map(([k, n, tip, pos]) => ({ name: n, tip, tipPos: pos, on: s.inspTab === k ? 'true' : 'false', mod: tabMod(k), pick: () => this.setState({ inspTab: k, pop: null }), ...ico(k) })),
      q: s.q, onQ: (e) => this.setState({ q: e.target.value }), noResults: !!q && sections.length === 0,
      allOpen, notAllOpen: !allOpen, allLabel: allOpen ? 'Zwiń wszystkie sekcje' : 'Rozwiń wszystkie sekcje',
      toggleAll: () => { const o = { ...(this.state.secOpen || {}) }; allKeys.forEach((k) => { o[k] = !allOpen; }); try { window.localStorage.setItem('buildr.editor.sections', JSON.stringify(o)); } catch (e) {} this.setState({ secOpen: o }); },
      issue1, issue2, noIssues: nIss === 0, issueCount: String(nIss), issueText: nIss === 0 ? 'Brak problemów' : nIss === 1 ? '1 ostrzeżenie' : nIss + ' ostrzeżenia',
      toasts, dlgPublish: s.dlg === 'publish', dlgKeys: s.dlg === 'keys',
      openPublish: () => this.openDlg('publish'), openKeys: () => this.openDlg('keys'), closeDlg: () => this.closeDlg(),
      scrimClose: (e) => { if (e.target === e.currentTarget) this.closeDlg(); },
      dlgKey: (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.closeDlg(); } if (e.key === 'Tab') { const f = [...e.currentTarget.querySelectorAll('button, input, select, textarea, [tabindex="0"]')]; if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } },
      doPublish: () => { this.closeDlg(); this.pushToast({ text: 'Opublikowano. Strona jest już widoczna.', kind: 'ok', icon: 'ok', actText: 'Zobacz stronę' }); },
      showIssues: () => { this.setState({ dlg: null, issuesOpen: true }); },
      c, p,
      clearSel: () => this.setState({ sel: null, menuOpen: false }),
      selectPage: () => this.setState({ sel: 'page' }),
      hasSel: !!sel, noSel: !sel,
      selName: sel ? B[sel].n : '',
      selSub: !sel ? '' : sel === 'page' ? 'Pracownia Kadr · /' : (B[sel].l ? '„' + B[sel].l + '” · ' : '') + 'w bloku: ' + B[parentId].n,
      selIco: ico(t),
      parentTip: parentId ? 'Zaznacz blok nadrzędny: ' + B[parentId].n : 'Blok najwyższego poziomu',
      selectParent: (e) => { if (e && e.stopPropagation) e.stopPropagation(); if (parentId) this.setState({ sel: parentId }); },
      hasTb: !!s.tb && !!sel && sel !== 'page', tb: s.tb || { chipTop: 0, chipLeft: 0, top: 0, left: 0 },
      it: { content: s.inspTab === 'content' ? 'true' : 'false', style: s.inspTab === 'style' ? 'true' : 'false', adv: s.inspTab === 'adv' ? 'true' : 'false' },
      itContent: () => this.setState({ inspTab: 'content' }),
      itStyle: () => this.setState({ inspTab: 'style' }),
      itAdv: () => this.setState({ inspTab: 'adv' }),
      issuesCls: 'bd-issues' + (s.issuesOpen ? ' is-open' : ''), issuesStr: s.issuesOpen ? 'true' : 'false',
      toggleIssues: () => this.setState({ issuesOpen: !s.issuesOpen }),
      pickIssue1: () => this.setState({ sel: 'heroImg' }),
      pickIssue2: () => this.setState({ sel: 'heroBtn2' })
    };
  }
}

  window.Buildr.register('editor', Component, {"theme": "light", "device": "desktop"});
})();
