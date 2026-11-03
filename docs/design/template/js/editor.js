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
    if (pp.device !== this.props.device || ps.device !== s.device || ps.sel !== s.sel || ps.leftOpen !== s.leftOpen || ps.rightOpen !== s.rightOpen || ps.issuesOpen !== s.issuesOpen || ps.ov !== s.ov) {
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
      anchor: ['M12 8a3 3 0 1 0 0-6a3 3 0 1 0 0 6z', 'M12 22V8', 'M5 12H2a10 10 0 0 0 20 0h-3'],
      dBlock: ['M4 4h16v6H4z', 'M4 14h16v6H4z', ''],
      dFlex: ['M3 5h18v14H3z', 'M9 5v14', 'M15 5v14'],
      dGrid: ['M3 3h7v7H3zM14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
      row: ['M5 12h14', 'm13 6 6 6-6 6', ''],
      col: ['M12 5v14', 'm6 13 6 6 6-6', ''],
      aJ: ['M21 6H3', 'M21 12H3', 'M21 18H3'],
      italic: ['M19 4h-9', 'M14 20H5', 'M15 4 9 20'],
      upright: ['M7 4h10', 'M7 20h10', 'M12 4v16'],
      under: ['M6 4v6a6 6 0 0 0 12 0V4', 'M4 20h16', ''],
      strike: ['M16 4H9a3 3 0 0 0-2.8 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16'],
      bold: ['M6 4h7a4 4 0 0 1 0 8H6z', 'M6 12h8a4 4 0 0 1 0 8H6z', ''],
      ul: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01', 'M3 18h.01'],
      ol: ['M10 6h11M10 12h11M10 18h11', 'M4 6h1v4', 'M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1'],
      clear: ['M4 7V4h16v3', 'M5 20h6M13 4 8 20', 'm15 15 5 5M20 15l-5 5'],
      bSolid: ['M3 12h18', '', ''],
      bDash: ['M3 12h4M10 12h4M17 12h4', '', ''],
      bDot: ['M4 12h.01M8 12h.01M12 12h.01M16 12h.01M20 12h.01', '', ''],
      bDouble: ['M3 9h18', 'M3 15h18', ''],
      bgGrad: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 15 15 3M9 21 21 9', ''],
      up: ['M12 19V5', 'm5 12 7-7 7 7', ''],
      down: ['M12 5v14', 'm19 12-7 7-7-7', ''],
      left: ['M19 12H5', 'm12 19-7-7 7-7', ''],
      right: ['M5 12h14', 'm12 5 7 7-7 7', ''],
      hStart: ['M4 4v16', 'M8 9h9v6H8z', ''],
      hCenter: ['M12 4v5M12 15v5', 'M6 9h12v6H6z', ''],
      hEnd: ['M20 4v16', 'M7 9h9v6H7z', ''],
      hStretch: ['M4 4v16M20 4v16', 'M7 9h10v6H7z', ''],
      vStart: ['M4 4h16', 'M9 8h6v9H9z', ''],
      vCenter: ['M4 12h5M15 12h5', 'M9 6h6v12H9z', ''],
      vEnd: ['M4 20h16', 'M9 7h6v9H9z', ''],
      vStretch: ['M4 4h16M4 20h16', 'M9 7h6v10H9z', ''],
      size: ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7M3 21l7-7'],
      item: ['M3 3h18v18H3z', 'M7 7h6v10H7z', 'M16 7h1M16 12h1M16 17h1']
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
    const KIND = (id) => { const ty = B[id].t; return ty === 'button' ? 'button' : ty === 'image' ? 'image' : ['heading', 'text', 'quote'].includes(ty) ? 'text' : 'box'; };
    const C = (hex, a) => ({ hex, a: a == null ? 100 : a });
    const R4 = (n) => ({ tl: n, tr: n, br: n, bl: n });
    const S4 = (n) => ({ t: n, r: n, b: n, l: n });
    const CONTAINERS = ['page', 'section', 'columns', 'column', 'card'];
    const isBox = (id) => CONTAINERS.includes(B[id].t);
    // Rich text kept as HTML (what the WYSIWYG field edits).
    const RICH = { heroH: 1, offerH: 1, ctaH: 1, heroP: 1, aboutText: 1, quote: 1 };
    const TAGS = {
      section: [['section', '<section>'], ['header', '<header>'], ['footer', '<footer>'], ['main', '<main>'], ['article', '<article>'], ['aside', '<aside>'], ['nav', '<nav>'], ['div', '<div>']],
      columns: [['div', '<div>'], ['section', '<section>'], ['article', '<article>'], ['aside', '<aside>'], ['nav', '<nav>'], ['ul', '<ul> (lista)']],
      column: [['div', '<div>'], ['section', '<section>'], ['article', '<article>'], ['aside', '<aside>'], ['header', '<header>'], ['footer', '<footer>']],
      card: [['article', '<article>'], ['div', '<div>'], ['section', '<section>'], ['li', '<li> (element listy)']],
      heading: [['h1', '<h1>'], ['h2', '<h2>'], ['h3', '<h3>'], ['h4', '<h4>'], ['h5', '<h5>'], ['h6', '<h6>'], ['p', '<p>'], ['div', '<div>'], ['span', '<span>']],
      text: [['p', '<p>'], ['div', '<div>'], ['span', '<span>']],
      richText: [['div', '<div>'], ['section', '<section>'], ['article', '<article>']],
      quote: [['blockquote', '<blockquote>'], ['figure', '<figure>'], ['div', '<div>']],
      button: [['a', '<a> (link)'], ['button', '<button>']],
      image: [['img', '<img>'], ['figure', '<figure> z podpisem'], ['picture', '<picture>']]
    };
    const tagList = (id) => id === 'aboutText' ? TAGS.richText : TAGS[B[id].t] || [];
    const DEF = (id) => {
      const ty = B[id].t, k = KIND(id);
      const d = {
        // layout (containers) and position inside a flex/grid parent
        disp: 'block', dir: 'row', wrap: 'nowrap', jx: 'start', jy: 'start', dist: 'pack', stretch: false, cols: 2, colTpl: '', gap: 16, rowGap: 16, gjx: 'stretch', gjy: 'stretch',
        self: 'auto', jself: 'auto', grow: 0, shrink: 1, basis: 'auto', order: 0, colSpan: 1, rowSpan: 1,
        // size
        wmode: 'auto', w: 100, wUnit: '%', h: '', hUnit: 'px', minW: '', maxW: '', minH: '', maxH: '', ovf: 'visible', ar: 'auto',
        // spacing
        m: S4(0), mLink: true, mUnit: 'px', p: S4(0), pLink: true, pUnit: 'px',
        // typography
        font: 'Manrope', fs: 16, fsUnit: 'px', fw: '400', fst: 'normal', lh: k === 'button' ? 1 : 1.6, ls: 0, ta: 'left', tt: 'none', td: 'none',
        // colours, background, border, shadow, effects
        fg: C('#15201d'), cLink: C('#1f6f5c'), cLinkH: C('#17574a'), btnBg: C('#1f6f5c'), bgType: 'none', bg: C('#ffffff'), gKind: 'linear', g1: C('#eef4f1'), g2: C('#f6f3ee'), gAngle: 135,
        bStyle: 'none', bw: S4(1), bwLink: true, bColor: C('#d9e3df'), r: R4(0), rLink: true,
        shPreset: 'none', shX: 0, shY: 8, shBlur: 24, shSpread: -4, shOp: 18, shColor: C('#15201d'), shInset: false, tsOn: false, tsX: 0, tsY: 2, tsBlur: 6, tsColor: C('#15201d', 30),
        op: 100, blur: 0, br: 100, ct: 100, sat: 100, rot: 0, sc: 100, tx: 0, ty: 0, blend: 'normal',
        aType: 'none', aDir: 'up', aDur: 600, aDelay: 0, aEase: 'out',
        // content and advanced
        hideD: false, hideT: false, hideM: false, pos: 'static', elId: '', cls: '', anchor: '', css: '', label: '', html: '', url: '', newTab: false, alt: '', desc: '', name: B[id].l || B[id].n,
        tag: { section: 'section', columns: 'div', column: 'div', card: 'article', heading: 'h2', text: 'p', quote: 'blockquote', button: 'a', image: 'img' }[ty] || 'div'
      };
      if (ty === 'heading') { d.fw = '700'; d.lh = 1.15; d.ls = -0.02; }
      const o = {
        hero: { tag: 'header' },
        heroCols: { disp: 'grid', cols: 2, colTpl: '1.1fr 1fr', gap: 48, rowGap: 48, gjy: 'center', bgType: 'color', bg: C('#f6f3ee'), p: { t: 72, r: 48, b: 72, l: 48 }, pLink: false },
        offerCols: { disp: 'grid', cols: 3, gap: 24, rowGap: 24, tag: 'div' },
        about: { disp: 'grid', cols: 2, gap: 48, rowGap: 48 },
        cta: { disp: 'flex', wrap: 'wrap', jy: 'center', dist: 'space-between', gap: 32, m: { t: 0, r: 48, b: 72, l: 48 }, mLink: false, tag: 'footer' },
        heroBtn: { label: 'Umów konsultację', url: '/kontakt', p: { t: 0, r: 24, b: 0, l: 24 }, pLink: false, fs: 15, fw: '600', fg: C('#ffffff'), r: R4(10), h: 48 },
        heroBtn2: { label: 'Zobacz realizacje', url: '', p: { t: 0, r: 24, b: 0, l: 24 }, pLink: false, fs: 15, fw: '600', btnBg: C('#ffffff', 0), r: R4(10), h: 48, bStyle: 'solid', bw: S4(1.5), bColor: C('#15201d') },
        ctaBtn: { label: 'Napisz do nas', url: '/kontakt', p: { t: 0, r: 24, b: 0, l: 24 }, pLink: false, fs: 15, fw: '600', btnBg: C('#ffffff'), r: R4(10), h: 48 },
        heroH: { html: 'Wnętrza, w których chce się zostać na dłużej', fs: 48, tag: 'h1' },
        offerH: { html: 'Trzy etapy, jedna osoba prowadząca', fs: 34 },
        ctaH: { html: 'Porozmawiajmy o Twoim wnętrzu', fs: 32, fg: C('#ffffff') },
        heroP: { html: 'Projektujemy mieszkania i małe biura od pierwszego szkicu po odbiór. Spokojnie, z jasnym planem i budżetem.', fs: 18, fg: C('#4a5753') },
        aboutText: { html: '<p>Zaczynamy od rozmowy o tym, jak mieszkasz na co dzień. Dopiero potem rysujemy. Każdą decyzję pokazujemy na wizualizacji, zanim trafi do wykonawcy.</p><p>Na każdym etapie wiesz, ile wydałeś i co zostało do zrobienia.</p>', fg: C('#4a5753'), tag: 'div' },
        quote: { html: 'Pierwszy raz remont nie zjadł nam nerwów. Wiedzieliśmy, co się dzieje, nawet gdy byliśmy w pracy.', label: 'Klientka, mieszkanie na Mokotowie', fs: 20, fw: '600', lh: 1.5, ls: -0.01, bgType: 'color', bg: C('#eef4f1'), r: R4(14), p: { t: 28, r: 32, b: 28, l: 32 }, pLink: false },
        heroImg: { r: R4(16), alt: '', ar: '4 / 3.4' }
      };
      ['card1', 'card2', 'card3'].forEach((cid, i) => { o[cid] = { label: ['Projekt koncepcyjny', 'Projekt wykonawczy', 'Nadzór nad realizacją'][i], url: '#oferta', bgType: 'color', bg: C('#ffffff'), r: R4(14), p: S4(28), bStyle: 'solid', bw: S4(1) }; });
      return { ...d, ...(o[id] || {}) };
    };
    const RESP = { ta: 1, m: 1, p: 1, fs: 1, lh: 1, ls: 1, disp: 1, dir: 1, wrap: 1, jx: 1, jy: 1, dist: 1, gap: 1, rowGap: 1, cols: 1, colTpl: 1, gjx: 1, gjy: 1, self: 1, jself: 1, order: 1, colSpan: 1, wmode: 1, w: 1, h: 1 };
    const chainOf = (dv) => dv === 'mobile' ? ['mobile', 'tablet', 'desktop'] : dv === 'tablet' ? ['tablet', 'desktop'] : ['desktop'];
    const getOf = (id, k, dv) => { const o = (s.ov[id]) || {}; if (RESP[k]) { for (const d of chainOf(dv || devK)) { if (o[d] && k in o[d]) return o[d][k]; } } else if (o.desktop && k in o.desktop) return o.desktop[k]; return DEF(id)[k]; };
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const rgba = (cv) => { const m = /^#?([0-9a-f]{6})$/i.exec(((cv && cv.hex) || '').trim()); if (!m) return 'transparent'; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + ((cv.a ?? 100) / 100) + ')'; };
    const hsl2hex = (h) => { const S = 0.55, L = 0.45; const k = (n) => (n + h / 30) % 12; const a = S * Math.min(L, 1 - L); const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
    const hex2hue = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0; const n = parseInt(m[1], 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; const d = mx - mn; const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round(h * 60); };
    const PRE = { none: null, soft: [0, 1, 3, 0, 12], medium: [0, 8, 24, -4, 18], strong: [0, 20, 48, -8, 28] };
    const shCss = (a) => a ? a[0] + 'px ' + a[1] + 'px ' + a[2] + 'px ' + a[3] + 'px rgba(21, 32, 29, ' + (a[4] / 100) + ')' : 'none';
    const shadowOf = (g) => g('shPreset') === 'none' ? 'none' : (g('shInset') ? 'inset ' : '') + g('shX') + 'px ' + g('shY') + 'px ' + g('shBlur') + 'px ' + g('shSpread') + 'px ' + rgba({ hex: g('shColor').hex, a: g('shOp') });
    const EASE = { standard: ['Łagodna', [0.2, 0, 0, 1]], out: ['Wyhamowanie', [0, 0, 0.2, 1]], in: ['Przyspieszenie', [0.4, 0, 1, 1]], linear: ['Liniowa', [0, 0, 1, 1]], spring: ['Sprężysta', [0.34, 1.56, 0.64, 1]] };
    const easeCss = (k) => 'cubic-bezier(' + EASE[k][1].join(', ') + ')';
    const FONTS = [['Manrope', '"Manrope", sans-serif', 'Bezszeryfowy'], ['Inter', '"Inter", sans-serif', 'Bezszeryfowy'], ['DM Sans', '"DM Sans", sans-serif', 'Bezszeryfowy'], ['Lora', '"Lora", serif', 'Szeryfowy'], ['Fraunces', '"Fraunces", serif', 'Szeryfowy'], ['Systemowy', 'system-ui, sans-serif', 'Systemowy']];
    const fontCss = (n) => (FONTS.find((f) => f[0] === n) || FONTS[0])[1];
    const num = (x) => { const n = parseFloat(x); return isNaN(n) ? 0 : n; };
    const dim = (v, unit) => (v === '' || v == null ? '' : v + unit);
    const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const plain = (h) => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const tagOf = (id) => getOf(id, 'tag');

    // ---- canvas output: inline style per block, layout style for inner layout elements, rich HTML ----
    const st = {}, al = {}, tx = {}, lay = {}, hx = {};
    const LAY_CHILD = { offer: 1, about: 1, cta: 1 };
    const hiddenOn = (id) => !!getOf(id, { desktop: 'hideD', tablet: 'hideT', mobile: 'hideM' }[devK]);
    const layoutCss = (g) => {
      const dsp = g('disp');
      if (dsp === 'flex') {
        const col = g('dir') === 'column';
        const main = col ? g('jy') : g('jx'), cross = col ? g('jx') : g('jy');
        return ['display: flex', 'flex-direction: ' + g('dir'), 'flex-wrap: ' + g('wrap'), 'justify-content: ' + (g('dist') === 'pack' ? main : g('dist')), 'align-items: ' + (g('stretch') ? 'stretch' : cross), 'gap: ' + g('gap') + 'px'];
      }
      if (dsp === 'grid') {
        const tpl = (g('colTpl') || '').trim();
        return ['display: grid', 'grid-template-columns: ' + (tpl || 'repeat(' + g('cols') + ', minmax(0, 1fr))'), 'column-gap: ' + g('gap') + 'px', 'row-gap: ' + g('rowGap') + 'px', 'justify-items: ' + g('gjx'), 'align-items: ' + g('gjy')];
      }
      return ['display: block'];
    };
    const LAYK = ['disp', 'dir', 'wrap', 'jx', 'jy', 'dist', 'stretch', 'cols', 'colTpl', 'gap', 'rowGap', 'gjx', 'gjy'];
    Object.keys(B).forEach((id) => {
      if (id === 'page') return;
      const D0 = DEF(id), g = (k) => getOf(id, k), ch = (k) => !eq(g(k), D0[k]);
      const kd = KIND(id);
      const out = [];
      if (id === 'cta') out.push('padding-top: 1px');
      // position inside a flex/grid parent
      const par = B[id].p, pd = par && par !== 'page' ? getOf(par, 'disp') : 'block';
      if (pd !== 'block') {
        if (ch('self')) out.push('align-self: ' + g('self'));
        if (ch('order')) out.push('order: ' + g('order'));
        if (pd === 'flex' && (ch('grow') || ch('shrink') || ch('basis'))) out.push('flex: ' + g('grow') + ' ' + g('shrink') + ' ' + (g('basis') || 'auto'));
        if (pd === 'grid') { if (ch('jself')) out.push('justify-self: ' + g('jself')); if (ch('colSpan')) out.push('grid-column: span ' + g('colSpan')); if (ch('rowSpan')) out.push('grid-row: span ' + g('rowSpan')); }
      }
      // layout of a container
      if (isBox(id) && LAYK.some(ch)) { const L = layoutCss(g); if (LAY_CHILD[id]) lay[id] = L.join('; '); else out.push(...L); }
      if (!lay[id]) lay[id] = '';
      // size
      if (ch('wmode') || ch('w')) { const wm = g('wmode'); out.push('--o-w: ' + (wm === 'full' ? '100%' : wm === 'custom' ? g('w') + g('wUnit') : 'auto')); if (kd === 'button' && wm !== 'auto') out.push('display: block'); }
      if (ch('h') || ch('hUnit')) out.push('--o-h: ' + (dim(g('h'), g('hUnit')) || 'auto'));
      [['minW', '--o-minw'], ['maxW', '--o-maxw'], ['minH', '--o-minh'], ['maxH', '--o-maxh']].forEach(([k, v]) => { if (ch(k) && g(k) !== '') out.push(v + ': ' + g(k) + 'px'); });
      if (ch('ovf')) out.push('--o-ovf: ' + g('ovf'));
      if (ch('ar')) out.push('--o-ar: ' + g('ar'));
      // spacing
      if (ch('m') || ch('mUnit')) { const m = g('m'), u = g('mUnit'); out.push('margin: ' + m.t + u + ' ' + m.r + u + ' ' + m.b + u + ' ' + m.l + u); }
      if (ch('p') || ch('pUnit')) { const pp = g('p'), u = g('pUnit'); out.push('--o-pad: ' + pp.t + u + ' ' + pp.r + u + ' ' + pp.b + u + ' ' + pp.l + u); }
      // typography
      if (ch('ta')) out.push('text-align: ' + g('ta'));
      if (ch('font')) out.push('--o-ff: ' + fontCss(g('font')));
      if (ch('fs') || ch('fsUnit')) out.push('--o-fs: ' + g('fs') + g('fsUnit'));
      if (ch('fw')) out.push('--o-fw: ' + g('fw'));
      if (ch('fst')) out.push('--o-fst: ' + g('fst'));
      if (ch('lh')) out.push('--o-lh: ' + g('lh'));
      if (ch('ls')) out.push('--o-ls: ' + g('ls') + 'em');
      if (ch('tt')) out.push('--o-tt: ' + g('tt'));
      if (ch('td')) out.push('--o-td: ' + g('td'));
      if (g('tsOn')) out.push('--o-ts: ' + g('tsX') + 'px ' + g('tsY') + 'px ' + g('tsBlur') + 'px ' + rgba(g('tsColor')));
      // colours and background
      if (ch('fg')) out.push('--o-fg: ' + rgba(g('fg')));
      if (ch('cLink')) out.push('--o-link: ' + rgba(g('cLink')));
      if (kd === 'button' && ch('btnBg')) out.push('--o-bg: ' + rgba(g('btnBg')));
      if (kd !== 'button' && ['bgType', 'bg', 'gKind', 'g1', 'g2', 'gAngle'].some(ch)) {
        const bt = g('bgType');
        out.push('--o-bg: ' + (bt === 'none' ? 'transparent' : bt === 'color' ? rgba(g('bg')) : g('gKind') === 'linear' ? 'linear-gradient(' + g('gAngle') + 'deg, ' + rgba(g('g1')) + ', ' + rgba(g('g2')) + ')' : 'radial-gradient(circle at center, ' + rgba(g('g1')) + ', ' + rgba(g('g2')) + ')'));
      }
      // border and corners
      if (['bStyle', 'bw', 'bColor'].some(ch)) { const bw = g('bw'); out.push('--o-bs: ' + g('bStyle'), '--o-bw: ' + bw.t + 'px ' + bw.r + 'px ' + bw.b + 'px ' + bw.l + 'px', '--o-bc: ' + rgba(g('bColor'))); }
      if (ch('r')) { const r = g('r'); out.push('--o-r: ' + r.tl + 'px ' + r.tr + 'px ' + r.br + 'px ' + r.bl + 'px'); }
      // shadow
      if (['shPreset', 'shX', 'shY', 'shBlur', 'shSpread', 'shOp', 'shColor', 'shInset'].some(ch)) out.push('--o-sh: ' + shadowOf(g));
      // effects
      if (ch('op')) out.push('opacity: ' + g('op') / 100);
      const fx = []; if (g('blur')) fx.push('blur(' + g('blur') + 'px)'); if (g('br') !== 100) fx.push('brightness(' + g('br') + '%)'); if (g('ct') !== 100) fx.push('contrast(' + g('ct') + '%)'); if (g('sat') !== 100) fx.push('saturate(' + g('sat') + '%)');
      if (fx.length) out.push('filter: ' + fx.join(' '));
      const tf = []; if (num(g('tx')) || num(g('ty'))) tf.push('translate(' + num(g('tx')) + 'px, ' + num(g('ty')) + 'px)'); if (g('rot')) tf.push('rotate(' + g('rot') + 'deg)'); if (g('sc') !== 100) tf.push('scale(' + g('sc') / 100 + ')');
      if (tf.length) out.push('transform: ' + tf.join(' '));
      if (ch('blend')) out.push('mix-blend-mode: ' + g('blend'));
      // entrance animation
      if (g('aType') !== 'none') { const ty = g('aType'), dr = g('aDir'), sl = ty === 'slide'; out.push('--adur: ' + g('aDur') + 'ms', '--aease: ' + easeCss(g('aEase')), 'animation-delay: ' + g('aDelay') + 'ms', '--a-op: 0', '--a-x: ' + (sl && dr === 'left' ? '32px' : sl && dr === 'right' ? '-32px' : '0px'), '--a-y: ' + (sl && dr === 'up' ? '32px' : sl && dr === 'down' ? '-32px' : '0px'), '--a-sc: ' + (ty === 'zoom' ? '0.9' : '1')); }
      st[id] = out.join('; ');
      al[id] = B[id].n + (B[id].l ? ': ' + B[id].l : '') + (sel === id ? ' (zaznaczony)' : '');
      // content: plain text for buttons/cards, HTML for rich text (the static fallback is plain text)
      if (RICH[id]) {
        const h = g('html') || '', tg = g('tag');
        tx[id] = plain(h);
        hx[id] = id === 'offerH' ? '<div class="site-sec__head"><' + tg + ' class="site-h">' + h + '</' + tg + '><p>Możesz zamówić cały proces albo tylko wybrany etap.</p></div>'
          : id === 'ctaH' ? '<' + tg + ' class="site-h">' + h + '</' + tg + '><p>Pierwsza konsultacja online jest bezpłatna.</p>'
          : id === 'heroP' ? '<' + tg + ' class="site-lead">' + h + '</' + tg + '>'
          : id === 'aboutText' ? '<h2>Jak pracujemy</h2><' + tg + ' class="site-rt">' + h + '</' + tg + '>'
          : id === 'quote' ? '<' + tg + ' class="site-quote o-skin">„' + h + '”<cite>' + esc(g('label')) + '</cite></' + tg + '>'
          : '<' + tg + ' class="site-h">' + h + '</' + tg + '>';
      } else tx[id] = g('label');
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
    const tgt = (k) => (RESP[k] && devK !== 'desktop' ? devK : 'desktop');
    const setMany = (obj) => this.setState((stt) => { const cur = { ...(stt.ov[sid] || {}) }; Object.keys(obj).forEach((k) => { const d = tgt(k); cur[d] = { ...(cur[d] || {}), [k]: obj[k] }; }); return { ov: { ...stt.ov, [sid]: cur } }; });
    const set = (k, val) => setMany({ [k]: val });
    const reset = (k) => this.setState((stt) => { const cur = { ...(stt.ov[sid] || {}) }; const target = devK !== 'desktop' && RESP[k] && cur[devK] && k in cur[devK] ? devK : 'desktop'; const o = { ...(cur[target] || {}) }; delete o[k]; cur[target] = o; return { ov: { ...stt.ov, [sid]: cur } }; });
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const scrub = (k, min, max, step) => (e) => {
      if (e.button !== 0) return;
      const sx = e.clientX, sv = num(get(k));
      const dec = String(step).includes('.') ? String(step).split('.')[1].length : 0;
      const mv = (ev) => set(k, Number(clamp(sv + Math.round((ev.clientX - sx) / 3) * step * (ev.shiftKey ? 10 : 1), min, max).toFixed(dec)));
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    const labelParts = (label) => { const i = q ? label.toLowerCase().indexOf(q) : -1; return i < 0 ? { lpre: label, lmid: '', lpost: '' } : { lpre: label.slice(0, i), lmid: label.slice(i, i + q.length), lpost: label.slice(i + q.length) }; };
    const FLAGS = { isRange: false, isSeg: false, isNum: false, isSelect: false, isFont: false, isColor: false, isSwitch: false, isText: false, isArea: false, isSides: false, isPad: false, isBox: false, isCorners: false, isShadowCards: false, isCards: false, isCurve: false, isPlay: false, isBgPrev: false, isImg: false, isChecks: false, isVis: false, isCond: false, isKV: false, isMore: false, isNote: false, isWys: false };
    const base = (k, label, o) => { o = o || {}; const chg = changed(k), ov = ovr(k); return { key: k, id: 'mf-' + k, label, kw: o.kw || '', ...labelParts(label), isGeneric: true, isSub: false, rowCls: 'bd-field' + (o.top ? ' bd-field--top' : '') + (chg ? ' is-changed' : ''), labelCls: 'bd-flabel' + (o.scrub ? ' bd-flabel--scrub' : ''), scrub: o.scrub || (() => {}), scrubTip: o.scrub ? 'Przeciągnij w bok, aby zmienić wartość' : '', resp: !!RESP[k], devCls: 'bd-dev' + (ov ? ' is-ovr' : ''), devTip: ov ? 'Własna wartość dla: ' + devName.toLowerCase() : 'Wartość responsywna – edytujesz: ' + devName.toLowerCase(), hasHelp: !!o.help, help: o.help || '', changed: chg, unchanged: !chg, reset: () => reset(k), hasResetSlot: true, ...FLAGS }; };
    const range = (k, label, min, max, step, unit, o) => { const val = get(k); return { ...base(k, label, { ...o, scrub: scrub(k, min, max, step) }), isRange: true, min: String(min), max: String(max), step: String(step), val: String(val), unit, valText: val + ' ' + unit, p: clamp((num(val) - min) / (max - min) * 100, 0, 100).toFixed(1) + '%', onVal: (e) => set(k, e.target.value === '' ? D[k] : Number(e.target.value)) }; };
    const seg = (k, label, opts, o) => { o = o || {}; const cur = get(k); return { ...base(k, label, o), isSeg: true, segCls: 'bd-seg bd-seg--fill' + (o.icons ? ' bd-seg--icons' : ''), opts: opts.map(([v, text, icon, tip], i) => ({ checked: cur === v ? 'true' : 'false', aria: tip || text, tip: tip || '', tipPos: i === opts.length - 1 ? 'end' : '', hasIcon: !!icon, hasText: !icon, text, ...ico(icon || 'layout'), pick: () => set(k, v) })) }; };
    const numf = (k, label, o) => { o = o || {}; const val = get(k); const step = o.step || 1; return { ...base(k, label, { ...o, scrub: scrub(k, o.min ?? -9999, o.max ?? 9999, step) }), isNum: true, val: String(val), placeholder: o.placeholder || '', step: String(step), hasUnits: !!o.unitKey, noUnits: !o.unitKey, units: o.units || ['px', '%', 'rem', 'vw'], unitVal: o.unitKey ? get(o.unitKey) : '', unit: o.unit || '', onUnit: (e) => set(o.unitKey, e.target.value), onVal: (e) => set(k, e.target.value === '' ? '' : Number(e.target.value)), inc: () => set(k, num(get(k)) + step), dec: () => set(k, num(get(k)) - step) }; };
    const select = (k, label, opts, o) => ({ ...base(k, label, o), isSelect: true, val: String(get(k)), opts: opts.map(([v, l]) => ({ v, l })), onVal: (e) => set(k, e.target.value) });
    const sw = (k, label, o) => ({ ...base(k, label, o), isSwitch: true, on: get(k) ? 'true' : 'false', toggle: () => set(k, !get(k)) });
    const text = (k, label, o) => { o = o || {}; const bound = !!(o.bind && (s.bound || {})[sid + k]); return { ...base(k, label, { ...o, top: true }), isText: true, val: bound ? '{wpis.link}' : String(get(k)), placeholder: o.placeholder || '', inputCls: 'bd-input' + (o.mono ? ' mono' : '') + (bound ? ' is-bound' : ''), onVal: (e) => set(k, e.target.value), bound, canBind: !!o.bind, srcCls: 'bd-srcmode' + (bound ? ' is-on' : ''), srcTip: bound ? 'Powiązane z danymi – kliknij, by wpisać stałą wartość' : 'Pobierz wartość z danych (Stała / Dane / Formuła)', toggleBind: () => this.setState((stt) => ({ bound: { ...(stt.bound || {}), [sid + k]: !(stt.bound || {})[sid + k] } })) }; };
    const area = (k, label, o) => ({ ...base(k, label, { ...o, top: true }), isArea: true, val: String(get(k)), placeholder: (o && o.placeholder) || '', inputCls: 'bd-input bd-input--area' + (o && o.mono ? ' mono' : ''), onVal: (e) => set(k, e.target.value) });
    const PAL = [['Marka', '#1f6f5c'], ['Marka ciemna', '#17574a'], ['Tekst', '#15201d'], ['Tekst drugorzędny', '#4a5753'], ['Mięta', '#eef4f1'], ['Piasek', '#f6f3ee'], ['Biały', '#ffffff'], ['Akcent ciepły', '#c8742c']];
    const color = (k, label, o) => { const cv = get(k); const open = s.pop === k; const hue = hex2hue(cv.hex); return { ...base(k, label, o), isColor: true, hex: cv.hex, op: String(cv.a), css: rgba(cv), open, openStr: open ? 'true' : 'false', toggle: () => this.setState({ pop: open ? null : k }), onHex: (e) => { let h = e.target.value.trim(); if (h && h[0] !== '#') h = '#' + h; set(k, { ...cv, hex: h }); }, onOp: (e) => set(k, { ...cv, a: clamp(num(e.target.value), 0, 100) }), opP: cv.a + '%', hue: String(hue), hueP: (hue / 360 * 100).toFixed(1) + '%', onHue: (e) => set(k, { ...cv, hex: hsl2hex(num(e.target.value)) }), palette: PAL.map(([n, h]) => ({ name: n, hex: h, on: h === (cv.hex || '').toLowerCase() ? 'true' : 'false', pick: () => set(k, { hex: h, a: cv.a === 0 ? 100 : cv.a }) })) }; };
    const sides = (k, linkKey, label, o) => { const v = get(k), linked = get(linkKey); const setSide = (sd) => (e) => { const n = num(e.target.value); set(k, linked ? S4(n) : { ...get(k), [sd]: n }); }; return { ...base(k, label, o), isSides: true, linked: linked ? 'true' : 'false', linkTip: linked ? 'Rozłącz wartości' : 'Połącz wartości', linkMid: linked ? 'M8 12h8' : '', toggleLink: () => set(linkKey, !linked), sides: [['t', 'Góra'], ['r', 'Prawo'], ['b', 'Dół'], ['l', 'Lewo']].map(([sd, n]) => ({ name: n, val: String(v[sd]), onVal: setSide(sd) })) }; };
    const pad = (kx, ky, label, o) => {
      const X = ['start', 'center', 'end'];
      const XN = { start: 'do lewej', center: 'do środka', end: 'do prawej' }, YN = { start: 'u góry', center: 'pośrodku', end: 'na dole' };
      const cx = get(kx), cy = get(ky);
      const cells = []; X.forEach((y) => X.forEach((x) => cells.push({ name: 'Wyrównaj ' + XN[x] + ', ' + YN[y], on: cx === x && cy === y ? 'true' : 'false', pick: () => setMany({ [kx]: x, [ky]: y }) })));
      const ch = changed(kx) || changed(ky);
      return { ...base(kx, label, o), isPad: true, changed: ch, unchanged: !ch, reset: () => { reset(kx); reset(ky); }, padCls: 'bd-pad' + (get('dir') === 'column' ? ' bd-pad--col' : ''), cells, padText: ((XN[cx] || '').charAt(0).toUpperCase() + (XN[cx] || '').slice(1)) + ', ' + (YN[cy] || ''), padHint: (o && o.hint) || '' };
    };
    const sub = (label) => ({ ...base('_', label), isGeneric: false, isSub: true });
    const special = (kind, extra) => ({ ...base('_' + kind, (extra && extra.label) || ''), isGeneric: false, [kind]: true, changed: false, ...(extra || {}) });
    const boxSide = (k, lk) => { const v = get(k), linked = get(lk); const o = {}; ['t', 'r', 'b', 'l'].forEach((sd) => { o[sd] = { val: String(v[sd]), cls: v[sd] !== D[k][sd] ? 'is-changed' : '', onVal: (e) => { const n = num(e.target.value); set(k, linked ? S4(n) : { ...get(k), [sd]: n }); } }; }); return o; };

    // WYSIWYG: a contenteditable area with a small toolbar (document.execCommand – enough for a mock).
    const wys = (k, label, o) => {
      o = o || {};
      const area = () => document.querySelector('.bd-wys__area[data-key="' + sid + k + '"]');
      const keep = () => { const a = area(); const sl = window.getSelection(); if (a && sl && sl.rangeCount && a.contains(sl.anchorNode)) this.wysRange = sl.getRangeAt(0).cloneRange(); };
      const restore = () => { const a = area(); if (!a) return; if (document.activeElement !== a) a.focus(); if (this.wysRange) { const sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(this.wysRange); } };
      const sync = () => { keep(); const a = area(); const qs = (cmd) => { try { return document.queryCommandState(cmd); } catch (e) { return false; } }; const fm = { bold: qs('bold'), italic: qs('italic'), underline: qs('underline'), strikeThrough: qs('strikeThrough'), insertUnorderedList: qs('insertUnorderedList'), insertOrderedList: qs('insertOrderedList') }; if (a && JSON.stringify(fm) !== JSON.stringify(this.state.fmt || {})) this.setState({ fmt: fm }); };
      const run = (cmd) => () => { restore(); if (cmd === 'createLink') { keep(); this.setState({ wysLink: sid + k, wysUrl: '' }); return; } if (cmd === 'removeFormat') { document.execCommand('removeFormat'); document.execCommand('unlink'); } else document.execCommand(cmd); const a = area(); if (a) set(k, a.innerHTML); sync(); };
      const T = [['bold', 'Pogrubienie', 'Ctrl+B', 'bold'], ['italic', 'Kursywa', 'Ctrl+I', 'italic'], ['underline', 'Podkreślenie', 'Ctrl+U', 'under'], ['strikeThrough', 'Przekreślenie', '', 'strike'], ['|'], ['createLink', 'Wstaw link', 'Ctrl+K', 'link']];
      if (o.lists) T.push(['|'], ['insertUnorderedList', 'Lista punktowana', '', 'ul'], ['insertOrderedList', 'Lista numerowana', '', 'ol']);
      T.push(['|'], ['removeFormat', 'Usuń formatowanie', '', 'clear']);
      const fm = this.state.fmt || {};
      const linkOpen = s.wysLink === sid + k;
      const html = String(get(k) || '');
      return { ...base(k, label, { ...o, top: true }), isGeneric: false, isWys: true, html, plain: plain(html), wkey: sid + k, areaId: 'mf-' + k,
        tools: T.map(([cmd, name, keys, icon], i) => cmd === '|' ? { sep: true, tool: false, i } : { sep: false, tool: true, name, tip: name + (keys ? ' (' + keys + ')' : ''), tipPos: i === T.length - 1 ? 'end' : '', on: fm[cmd] ? 'true' : 'false', down: (e) => { e.preventDefault(); keep(); }, run: run(cmd), ...ico(icon) }),
        onInput: (e) => set(k, e.currentTarget.innerHTML), sync,
        onKey: (e) => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); run('createLink')(); } },
        linkOpen, wysUrl: s.wysUrl || '', onUrl: (e) => this.setState({ wysUrl: e.target.value }),
        applyLink: () => { const u = (this.state.wysUrl || '').trim(); restore(); if (u) document.execCommand('createLink', false, u); const a = area(); if (a) set(k, a.innerHTML); this.setState({ wysLink: null }); },
        cancelLink: () => { this.setState({ wysLink: null }); restore(); },
        urlKey: (e) => { if (e.key === 'Enter') { e.preventDefault(); const u = (this.state.wysUrl || '').trim(); restore(); if (u) document.execCommand('createLink', false, u); const a = area(); if (a) set(k, a.innerHTML); this.setState({ wysLink: null }); } if (e.key === 'Escape') { e.stopPropagation(); this.setState({ wysLink: null }); restore(); } },
        hint: o.hint || 'Zaznacz fragment, aby go sformatować. Enter dodaje nowy akapit.' };
    };

    const kind = KIND(sid);
    const tt = B[sid].t;
    const parent = B[sid].p;
    const parentDisp = parent && parent !== 'page' ? getOf(parent, 'disp') : 'block';
    const boxy = isBox(sid) && sid !== 'page';

    // ---------- STYLE ----------
    const styleSecs = [];
    // Układ – layout of a container (block / flex / grid)
    if (boxy) {
      const dsp = get('disp');
      const f = [seg('disp', 'Tryb', [['block', 'Blok', 'dBlock', 'Blok – elementy jeden pod drugim'], ['flex', 'Elastyczny', 'dFlex', 'Układ elastyczny – w rzędzie lub kolumnie'], ['grid', 'Siatka', 'dGrid', 'Siatka – kolumny i wiersze']], { icons: true, kw: 'display flex grid układ' })];
      if (dsp === 'flex') {
        f.push(seg('dir', 'Kierunek', [['row', 'W poziomie', 'row', 'Kierunek: w poziomie (obok siebie)'], ['column', 'W pionie', 'col', 'Kierunek: w pionie (jeden pod drugim)']], { icons: true, kw: 'direction kierunek' }));
        f.push(seg('wrap', 'Zawijanie', [['nowrap', 'Jedna linia', null, 'Wszystkie elementy w jednej linii'], ['wrap', 'Zawijaj', null, 'Przenoś elementy do kolejnej linii']], { kw: 'wrap zawijanie' }));
        f.push(pad('jx', 'jy', 'Wyrównanie', { hint: get('dir') === 'column' ? 'Poziomo: wyrównanie elementów. Pionowo: rozmieszczenie w kontenerze.' : 'Poziomo: rozmieszczenie. Pionowo: wyrównanie elementów.', kw: 'align justify wyrównanie' }));
        f.push(select('dist', 'Rozkład', [['pack', 'Według wyrównania'], ['space-between', 'Rozsuń do krawędzi'], ['space-around', 'Równe odstępy wokół'], ['space-evenly', 'Równe odstępy']], { kw: 'justify space between rozmieszczenie' }));
        f.push(sw('stretch', 'Rozciągnij', { kw: 'stretch rozciągnij', help: 'Elementy wypełniają kontener w poprzek kierunku układu.' }));
        f.push(range('gap', 'Odstęp', 0, 96, 1, 'px', { kw: 'gap odstęp' }));
      }
      if (dsp === 'grid') {
        f.push(range('cols', 'Kolumny', 1, 6, 1, 'kol.', { kw: 'columns kolumny grid' }));
        f.push(text('colTpl', 'Własny układ kolumn', { mono: true, placeholder: 'np. 2fr 1fr', help: 'Szerokości kolumn, np. „1.1fr 1fr” albo „240px 1fr”. Puste – równe kolumny.', kw: 'grid template' }));
        f.push(range('gap', 'Odstęp X', 0, 96, 1, 'px', { kw: 'gap column odstęp' }), range('rowGap', 'Odstęp Y', 0, 96, 1, 'px', { kw: 'gap row odstęp' }));
        const AL = (k, label, ax) => seg(k, label, [['stretch', 'Rozciągnij', ax + 'Stretch', 'Rozciągnij'], ['start', 'Początek', ax + 'Start', ax === 'h' ? 'Do lewej' : 'Do góry'], ['center', 'Środek', ax + 'Center', 'Do środka'], ['end', 'Koniec', ax + 'End', ax === 'h' ? 'Do prawej' : 'Do dołu']], { icons: true, kw: 'align justify items wyrównanie' });
        f.push(AL('gjx', 'Wyrównaj X', 'h'), AL('gjy', 'Wyrównaj Y', 'v'));
      }
      styleSecs.push({ key: 'layout', name: 'Układ', icon: 'layout', fields: f, keys: ['jy', 'stretch'] });
    }
    // Element w kontenerze – shown when the parent is flex or grid
    if (sel && parentDisp !== 'block') {
      const f = [special('isNote', { label: 'Blok nadrzędny „' + (B[parent].l || B[parent].n) + '” ma układ ' + (parentDisp === 'grid' ? 'siatki' : 'elastyczny') + '. Te ustawienia dotyczą tylko tego elementu.' })];
      const SELF = [['auto', 'Jak w kontenerze'], ['start', 'Początek'], ['center', 'Środek'], ['end', 'Koniec'], ['stretch', 'Rozciągnij']];
      if (parentDisp === 'grid') {
        const pc = getOf(parent, 'cols');
        f.push(range('colSpan', 'Kolumny', 1, Math.max(2, pc), 1, 'kol.', { kw: 'span kolumny' }), range('rowSpan', 'Wiersze', 1, 4, 1, 'wiersz.', { kw: 'span wiersze' }));
        f.push(select('jself', 'Wyrównaj X', SELF, { kw: 'justify self' }), select('self', 'Wyrównaj Y', SELF, { kw: 'align self' }));
      } else {
        f.push(select('self', 'Wyrównanie', SELF, { kw: 'align self' }));
        f.push(numf('grow', 'Rozciąganie', { min: 0, kw: 'flex grow', help: '0 – zachowuje swój rozmiar. 1 lub więcej – zajmuje wolne miejsce.' }), numf('shrink', 'Zwężanie', { min: 0, kw: 'flex shrink' }), text('basis', 'Rozmiar bazowy', { mono: true, placeholder: 'auto', kw: 'flex basis' }));
      }
      f.push(numf('order', 'Kolejność', { kw: 'order kolejność', help: 'Zmienia tylko kolejność wyświetlania, nie kolejność w strukturze.' }));
      styleSecs.push({ key: 'item', name: 'Element w kontenerze', icon: 'item', fields: f });
    }
    // Wymiary
    if (sid !== 'page') {
      const f = [seg('wmode', 'Szerokość', [['auto', 'Auto', null, 'Dopasowana do treści'], ['full', 'Pełna', null, 'Cała dostępna szerokość'], ['custom', 'Własna', null, 'Własna szerokość']], { kw: 'width szerokość' })];
      if (get('wmode') === 'custom') f.push(numf('w', 'Wartość', { unitKey: 'wUnit', min: 0, kw: 'width' }));
      f.push(numf('h', 'Wysokość', { placeholder: 'auto', unitKey: 'hUnit', units: ['px', 'vh', '%', 'rem'], min: 0, kw: 'height wysokość' }));
      f.push(special('isMore', { label: s.moreDims ? 'Mniej wymiarów' : 'Min. i maks. wymiary', openStr: s.moreDims ? 'true' : 'false', chev: s.moreDims ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6', toggle: () => this.setState({ moreDims: !s.moreDims }) }));
      if (s.moreDims || q) f.push(numf('minW', 'Min. szerokość', { placeholder: 'brak', unit: 'px', kw: 'min width' }), numf('maxW', 'Maks. szerokość', { placeholder: 'brak', unit: 'px', kw: 'max width' }), numf('minH', 'Min. wysokość', { placeholder: 'brak', unit: 'px', kw: 'min height' }), numf('maxH', 'Maks. wysokość', { placeholder: 'brak', unit: 'px', kw: 'max height' }));
      f.push(seg('ovf', 'Nadmiar treści', [['visible', 'Widoczny', null, 'Treść może wychodzić poza blok'], ['hidden', 'Przytnij', null, 'Ukryj to, co wychodzi poza blok'], ['auto', 'Przewijaj', null, 'Pokaż pasek przewijania']], { kw: 'overflow' }));
      f.push(select('ar', 'Proporcje', [['auto', 'Automatyczne'], ['1 / 1', 'Kwadrat 1:1'], ['4 / 3', '4:3'], ['4 / 3.4', 'Zdjęcie 4:3,4'], ['3 / 2', '3:2'], ['16 / 9', 'Panorama 16:9'], ['3 / 4', 'Pion 3:4']], { kw: 'aspect ratio proporcje' }));
      styleSecs.push({ key: 'size', name: 'Wymiary', icon: 'size', fields: f, keys: ['wUnit', 'hUnit'] });
    }
    // Odstępy
    styleSecs.push({ key: 'spacing', name: 'Odstępy', icon: 'spacing', keys: ['m', 'p', 'mLink', 'pLink', 'mUnit', 'pUnit'], fields: [special('isBox', { label: 'Margines i dopełnienie', kw: 'margines dopełnienie padding margin odstęp', m: boxSide('m', 'mLink'), p: boxSide('p', 'pLink'), units: ['px', '%', 'rem', 'vw'], mUnit: get('mUnit'), pUnit: get('pUnit'), onMUnit: (e) => set('mUnit', e.target.value), onPUnit: (e) => set('pUnit', e.target.value), mLinked: get('mLink') ? 'true' : 'false', pLinked: get('pLink') ? 'true' : 'false', mLinkTip: get('mLink') ? 'Rozłącz marginesy' : 'Połącz marginesy', pLinkTip: get('pLink') ? 'Rozłącz dopełnienie' : 'Połącz dopełnienie', mLinkMid: get('mLink') ? 'M8 12h8' : '', pLinkMid: get('pLink') ? 'M8 12h8' : '', toggleMLink: () => set('mLink', !get('mLink')), togglePLink: () => set('pLink', !get('pLink')), devCls: 'bd-dev' + (ovr('m') || ovr('p') ? ' is-ovr' : ''), devTip: ovr('m') || ovr('p') ? 'Własne odstępy dla: ' + devName.toLowerCase() : 'Odstępy responsywne – edytujesz: ' + devName.toLowerCase() })] });
    // Typografia
    if (kind !== 'image') {
      const fontOpen = s.pop === 'font', fq = s.fq || '';
      const fontF = { ...base('font', 'Krój pisma', { kw: 'font czcionka krój' }), isFont: true, val: get('font'), fontCss: fontCss(get('font')), open: fontOpen, openStr: fontOpen ? 'true' : 'false', toggle: () => this.setState({ pop: fontOpen ? null : 'font', fq: '' }), fq, onFq: (e) => this.setState({ fq: e.target.value }), yes: true,
        fonts: FONTS.filter((f) => f[0].toLowerCase().includes(fq.toLowerCase())).map(([n, css, fk]) => ({ name: n, css, kind: fk, on: get('font') === n ? 'true' : 'false', pick: () => { set('font', n); this.setState({ pop: null }); } })) };
      styleSecs.push({ key: 'type', name: 'Typografia', icon: 'type', keys: ['fsUnit'], fields: [
        fontF,
        numf('fs', 'Rozmiar', { unitKey: 'fsUnit', units: ['px', 'rem', 'em'], min: 8, max: 160, kw: 'font size rozmiar' }),
        select('fw', 'Grubość', [['300', 'Cienka (300)'], ['400', 'Normalna (400)'], ['500', 'Średnia (500)'], ['600', 'Półgruba (600)'], ['700', 'Gruba (700)'], ['800', 'Bardzo gruba (800)']], { kw: 'weight bold grubość' }),
        seg('fst', 'Styl', [['normal', 'Prosty', 'upright', 'Styl: prosty'], ['italic', 'Kursywa', 'italic', 'Styl: kursywa']], { icons: true, kw: 'italic kursywa' }),
        range('lh', 'Wysokość linii', 0.8, 2.4, 0.05, '×', { kw: 'line height interlinia' }),
        range('ls', 'Odstęp liter', -0.1, 0.3, 0.01, 'em', { kw: 'letter spacing' }),
        seg('ta', 'Wyrównanie tekstu', [['left', 'Do lewej', 'aL', 'Wyrównaj do lewej'], ['center', 'Do środka', 'aC', 'Wyśrodkuj'], ['right', 'Do prawej', 'aR', 'Wyrównaj do prawej'], ['justify', 'Justuj', 'aJ', 'Wyjustuj']], { icons: true, kw: 'align wyrównanie' }),
        seg('tt', 'Wielkość liter', [['none', '–', null, 'Bez zmian'], ['uppercase', 'AB', null, 'WIELKIE LITERY'], ['lowercase', 'ab', null, 'małe litery'], ['capitalize', 'Ab', null, 'Każde Słowo Wielką Literą']], { kw: 'transform transformacja wielkie' }),
        seg('td', 'Dekoracja', [['none', 'Brak', 'none', 'Bez dekoracji'], ['underline', 'Podkreślenie', 'under', 'Podkreślenie'], ['line-through', 'Przekreślenie', 'strike', 'Przekreślenie']], { icons: true, kw: 'decoration underline dekoracja' })
      ] });
    }
    // Kolory
    if (kind !== 'image') {
      const f = kind === 'button' ? [color('btnBg', 'Kolor przycisku', { kw: 'button tło' }), color('fg', 'Kolor tekstu', { kw: 'text' })] : [color('fg', 'Kolor tekstu', { kw: 'text' })];
      if (kind !== 'button') f.push(color('cLink', 'Kolor linków', { kw: 'link' }), color('cLinkH', 'Hover linków', { kw: 'hover link' }));
      styleSecs.push({ key: 'colors', name: 'Kolory', icon: 'color', fields: f });
    }
    // Tło
    if (kind !== 'button' && kind !== 'image') {
      const bt = get('bgType');
      const f = [seg('bgType', 'Rodzaj tła', [['none', 'Brak', 'none', 'Brak tła'], ['color', 'Kolor', 'color', 'Jednolity kolor'], ['gradient', 'Gradient', 'bgGrad', 'Gradient']], { icons: true, kw: 'background tło' })];
      if (bt === 'color') f.push(color('bg', 'Kolor tła'));
      if (bt === 'gradient') f.push(seg('gKind', 'Rodzaj', [['linear', 'Liniowy', null, 'Gradient liniowy'], ['radial', 'Kołowy', null, 'Gradient kołowy']]), color('g1', 'Kolor 1'), color('g2', 'Kolor 2'), range('gAngle', 'Kąt', 0, 360, 5, '°'));
      f.push(special('isNote', { label: 'Obraz i wideo w tle: te same pola co na stronie „Panel ustawień”.' }));
      styleSecs.push({ key: 'bg', name: 'Tło', icon: 'bg', fields: f });
    }
    // Obramowanie i zaokrąglenia
    {
      const r = get('r'), rLinked = get('rLink');
      const corner = (cn) => ({ val: String(r[cn]), onVal: (e) => { const n = Math.max(0, num(e.target.value)); set('r', rLinked ? R4(n) : { ...get('r'), [cn]: n }); } });
      const f = [seg('bStyle', 'Styl obramowania', [['none', 'Brak', 'none', 'Bez obramowania'], ['solid', 'Ciągła', 'bSolid', 'Linia ciągła'], ['dashed', 'Kreskowana', 'bDash', 'Linia kreskowana'], ['dotted', 'Kropkowana', 'bDot', 'Linia kropkowana'], ['double', 'Podwójna', 'bDouble', 'Linia podwójna']], { icons: true, kw: 'border obramowanie' })];
      if (get('bStyle') !== 'none') f.push(sides('bw', 'bwLink', 'Grubość', { top: true, kw: 'border width grubość' }), color('bColor', 'Kolor', { kw: 'border kolor' }));
      f.push(special('isCorners', { label: 'Zaokrąglenie rogów', c: { tl: corner('tl'), tr: corner('tr'), br: corner('br'), bl: corner('bl') }, radiusCss: r.tl + 'px ' + r.tr + 'px ' + r.br + 'px ' + r.bl + 'px', linked: rLinked ? 'true' : 'false', linkTip: rLinked ? 'Rozłącz rogi' : 'Połącz rogi', linkMid: rLinked ? 'M8 12h8' : '', toggleLink: () => set('rLink', !rLinked), changed: changed('r'), reset: () => reset('r'), kw: 'radius zaokrąglenie rogów' }));
      styleSecs.push({ key: 'border', name: 'Obramowanie i zaokrąglenia', icon: 'border', fields: f, keys: ['r', 'rLink', 'bwLink'] });
    }
    // Cień
    {
      const f = [special('isShadowCards', { kw: 'cień shadow', css: shadowOf(get), cards: [['none', 'Brak'], ['soft', 'Delikatny'], ['medium', 'Średni'], ['strong', 'Mocny']].map(([k, n]) => ({ name: n, css: shCss(PRE[k]), on: get('shPreset') === k ? 'true' : 'false', pick: () => { if (PRE[k]) setMany({ shPreset: k, shX: PRE[k][0], shY: PRE[k][1], shBlur: PRE[k][2], shSpread: PRE[k][3], shOp: PRE[k][4], shInset: false }); else setMany({ shPreset: 'none' }); } })) })];
      f.push(sub(get('shPreset') === 'custom' ? 'Własny cień' : get('shPreset') === 'none' ? 'Własny cień – ustaw wartości' : 'Dostosuj cień'));
      const mk = (k) => (e) => setMany({ [k]: Number(e.target.value), shPreset: 'custom' });
      const shR = (k, label, min, max, unit) => ({ ...range(k, label, min, max, 1, unit || 'px', { kw: 'shadow cień' }), onVal: mk(k) });
      f.push(shR('shX', 'Przesunięcie X', -40, 40), shR('shY', 'Przesunięcie Y', -40, 40), shR('shBlur', 'Rozmycie', 0, 80), shR('shSpread', 'Rozpiętość', -40, 40), shR('shOp', 'Krycie cienia', 0, 100, '%'));
      f.push({ ...color('shColor', 'Kolor cienia', { kw: 'shadow' }), onHex: (e) => { let h = e.target.value.trim(); if (h && h[0] !== '#') h = '#' + h; setMany({ shColor: { ...get('shColor'), hex: h }, shPreset: get('shPreset') === 'none' ? 'custom' : get('shPreset') }); } });
      f.push({ ...sw('shInset', 'Cień wewnętrzny', { kw: 'inset' }), toggle: () => setMany({ shInset: !get('shInset'), shPreset: get('shPreset') === 'none' ? 'custom' : get('shPreset') }) });
      if (kind !== 'image') {
        f.push(sub('Cień tekstu'), sw('tsOn', 'Cień tekstu', { kw: 'text shadow' }));
        if (get('tsOn')) f.push(range('tsX', 'Przesunięcie X', -10, 10, 1, 'px'), range('tsY', 'Przesunięcie Y', -10, 10, 1, 'px'), range('tsBlur', 'Rozmycie', 0, 20, 1, 'px'), color('tsColor', 'Kolor'));
      }
      styleSecs.push({ key: 'shadow', name: 'Cień', icon: 'shadow', fields: f });
    }
    // Efekty
    styleSecs.push({ key: 'effects', name: 'Efekty', icon: 'effects', fields: [
      range('op', 'Krycie', 0, 100, 1, '%', { kw: 'opacity przezroczystość' }), range('blur', 'Rozmycie', 0, 20, 1, 'px', { kw: 'blur' }),
      sub('Filtry'), range('br', 'Jasność', 0, 200, 1, '%', { kw: 'brightness' }), range('ct', 'Kontrast', 0, 200, 1, '%', { kw: 'contrast' }), range('sat', 'Nasycenie', 0, 200, 1, '%', { kw: 'saturation' }),
      sub('Przekształcenia'), range('rot', 'Obrót', -180, 180, 1, '°', { kw: 'rotate' }), range('sc', 'Skala', 50, 150, 1, '%', { kw: 'scale' }), numf('tx', 'Przesunięcie X', { unit: 'px', kw: 'translate' }), numf('ty', 'Przesunięcie Y', { unit: 'px', kw: 'translate' }),
      select('blend', 'Tryb mieszania', [['normal', 'Normalny'], ['multiply', 'Mnożenie'], ['screen', 'Rozjaśnianie'], ['overlay', 'Nakładka'], ['darken', 'Ciemniejsze'], ['lighten', 'Jaśniejsze'], ['luminosity', 'Jasność']], { kw: 'blend mix' })
    ] });
    // Animacje
    {
      const f = [select('aType', 'Animacja wejścia', [['none', 'Brak'], ['fade', 'Pojawienie'], ['slide', 'Wysunięcie'], ['zoom', 'Powiększenie']], { kw: 'animacja wejście' })];
      if (get('aType') !== 'none') {
        if (get('aType') === 'slide') f.push(seg('aDir', 'Kierunek', [['up', 'Z dołu', 'up', 'Wysuwa się z dołu'], ['down', 'Z góry', 'down', 'Wysuwa się z góry'], ['left', 'Z prawej', 'left', 'Wysuwa się z prawej'], ['right', 'Z lewej', 'right', 'Wysuwa się z lewej']], { icons: true }));
        const ek = get('aEase'), b = EASE[ek][1], X = (x) => (4 + 56 * x).toFixed(1), Y = (y) => (60 - 56 * y).toFixed(1);
        f.push(range('aDur', 'Czas trwania', 100, 2000, 50, 'ms', { kw: 'duration' }), range('aDelay', 'Opóźnienie', 0, 2000, 50, 'ms', { kw: 'delay' }), select('aEase', 'Krzywa', Object.keys(EASE).map((k) => [k, EASE[k][0]]), { kw: 'easing' }),
          special('isCurve', { name: EASE[ek][0], css: easeCss(ek), path: 'M4 60 C' + X(b[0]) + ' ' + Y(b[1]) + ' ' + X(b[2]) + ' ' + Y(b[3]) + ' 60 4', ctl: 'M4 60 L' + X(b[0]) + ' ' + Y(b[1]) + ' M60 4 L' + X(b[2]) + ' ' + Y(b[3]) }),
          special('isPlay', { play: () => this.setState((stt) => ({ animId: sid, animKey: (stt.animKey || 0) + 1 })) }));
      }
      styleSecs.push({ key: 'anim', name: 'Animacje', icon: 'anim', fields: f });
    }

    // ---------- CONTENT ----------
    const levelSeg = seg('tag', 'Poziom', ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => [h, h.toUpperCase(), null, 'Nagłówek ' + h[1] + '. poziomu']), { help: 'Ważne dla SEO i czytników ekranu. Na stronie powinien być jeden H1. Wygląd ustawiasz w Stylu.' });
    const contentFields = kind === 'button' ? [text('label', 'Tekst przycisku'), text('url', 'Adres linku', { mono: true, bind: true, placeholder: 'np. /kontakt' }), sw('newTab', 'Otwórz w nowej karcie')]
      : tt === 'heading' ? [wys('html', 'Treść nagłówka', { hint: 'Zaznacz fragment, aby go pogrubić, pochylić albo dodać link.' }), levelSeg]
      : tt === 'image' ? [special('isImg', {}), text('alt', 'Tekst alternatywny', { placeholder: 'Opisz, co widać na zdjęciu', help: 'Czytają go osoby niewidome i wyszukiwarki.' }), text('url', 'Link po kliknięciu', { mono: true, placeholder: 'brak' })]
      : tt === 'card' ? [text('label', 'Tytuł'), text('url', 'Link', { mono: true, bind: true })]
      : tt === 'quote' ? [wys('html', 'Cytat'), text('label', 'Autor')]
      : tt === 'text' ? [wys('html', 'Treść', { lists: sid === 'aboutText', hint: sid === 'aboutText' ? 'Enter dodaje akapit, Shift+Enter nową linię. Listy z paska powyżej.' : 'Jeden akapit. Zaznacz fragment, aby go sformatować.' })]
      : tt === 'page' ? [text('name', 'Tytuł strony'), special('isNote', { label: 'Adres: pracowniakadr.pl/ · opis dla wyszukiwarek w ustawieniach strony w CMS.' })]
      : [text('name', 'Nazwa w strukturze', { help: 'Widoczna tylko w edytorze.' })];
    const contentSecs = [{ key: 'c-main', name: tt === 'image' ? 'Obraz' : kind === 'button' ? 'Tekst i link' : 'Treść', icon: tt === 'image' ? 'image' : kind === 'button' ? 'link' : 'text', fields: contentFields }];

    // ---------- ADVANCED ----------
    const tl = sid === 'page' ? [] : tagList(sid);
    const advSecs = [];
    if (tl.length) advSecs.push({ key: 'a-tag', name: 'Element HTML', icon: 'code', fields: [select('tag', 'Znacznik', tl, { kw: 'tag html element znacznik div span section', help: kind === 'text' || tt === 'heading' ? 'Znaczenie treści dla wyszukiwarek i czytników ekranu. Wygląd się nie zmienia.' : 'Wybierz znacznik, który najlepiej opisuje rolę bloku na stronie.' }), special('isNote', { label: 'Na stronie: <' + get('tag') + (get('elId') ? ' id="' + get('elId') + '"' : '') + (get('cls') ? ' class="' + get('cls') + '"' : '') + '>' })] });
    advSecs.push(
      { key: 'a-vis', name: 'Widoczność', icon: 'eye', keys: ['hideD', 'hideT', 'hideM'], fields: [special('isVis', { kw: 'ukryj', vis: [['hideD', 'Komputer', 'desktop'], ['hideT', 'Tablet', 'tablet'], ['hideM', 'Telefon', 'mobile']].map(([k, n, ic]) => ({ name: n, aria: (get(k) ? 'Pokaż' : 'Ukryj') + ' na urządzeniu: ' + n.toLowerCase(), on: get(k) ? 'true' : 'false', toggle: () => set(k, !get(k)), ...ico(ic) })) })] },
      { key: 'a-cond', name: 'Warunek wyświetlania', icon: 'cond', fields: [special('isCond', {})] },
      { key: 'a-pos', name: 'Pozycjonowanie', icon: 'pos', fields: [select('pos', 'Pozycja', [['static', 'Domyślna (w przepływie)'], ['relative', 'Względna'], ['absolute', 'Bezwzględna'], ['sticky', 'Przyklejona'], ['fixed', 'Stała w oknie']])] },
      { key: 'a-id', name: 'Identyfikator i klasa CSS', icon: 'tag', fields: [text('elId', 'Identyfikator', { mono: true }), text('cls', 'Klasa CSS', { mono: true, help: 'Kilka klas oddziel spacją.' })] },
      { key: 'a-anchor', name: 'Kotwica', icon: 'anchor', fields: [text('anchor', 'Nazwa kotwicy', { mono: true, placeholder: 'np. oferta' })] },
      { key: 'a-attr', name: 'Atrybuty', icon: 'list', fields: [special('isKV', {})] },
      { key: 'a-css', name: 'Własny CSS', icon: 'code', fields: [area('css', 'Reguły CSS', { mono: true, placeholder: 'selector { }' })] }
    );
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
    const TABS = [['content', 'Treść', 'Treść i link bloku', ''], ['style', 'Styl', 'Wygląd bloku', ''], ['adv', 'Zaawansowane', 'Element HTML, widoczność, pozycja, CSS', 'end']];

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
      groups, tree, crumbs, sections, st, al, tx, lay, hx, canvasKey,
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
      selName: sel ? B[sel].n + (sel !== 'page' ? ' · ' + tagOf(sel) : '') : '',
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
