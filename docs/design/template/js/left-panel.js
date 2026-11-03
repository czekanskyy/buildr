/* Block library, search, patterns and structure tree states.
 * Mocked state only: values live in this component's state and reset on reload. */
(function () {
  'use strict';
  const DCLogic = window.Buildr.Component;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      q1: '', q2: 'prz', v1: 'blocks', open: { recent: true, basic: true, layout: true }, chip: 'all',
      sel: 'heroBtn', exp: { page: 1, hero: 1, heroCols: 1, heroCol1: 1, offer: 1, offerCols: 0, about: 1, cta: 0 },
      hidden: { quote: 1 }, locked: { cta: 1 }, names: { offerH: 'Nagłówek oferty' }, renaming: null, draft: ''
    };
  }
  renderVals() {
    const s = this.state;
    const I = {
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
      page: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', '']
    };
    const ico = (k) => { const a = I[k] || I.section; return { d1: a[0], d2: a[1], d3: a[2] }; };

    const CAT = [
      { k: 'basic', name: 'Podstawowe', items: [['Nagłówek', 'heading', 'Tytuł sekcji lub strony', 'tytuł h1 h2'], ['Tekst', 'text', 'Akapit z formatowaniem', 'akapit paragraf'], ['Przycisk', 'button', 'Link w formie przycisku', 'button link cta'], ['Obraz', 'image', 'Zdjęcie lub grafika', 'zdjęcie grafika foto'], ['Lista', 'list', 'Punktowana lub numerowana', 'wypunktowanie'], ['Cytat', 'quote', 'Wyróżniona wypowiedź', 'opinia']] },
      { k: 'layout', name: 'Układ', items: [['Sekcja', 'section', 'Kontener na całą szerokość', 'kontener wrapper'], ['Kolumny', 'columns', 'Treść obok siebie', 'siatka grid'], ['Odstęp', 'spacer', 'Pusta przestrzeń o stałej wysokości', 'spacer przerwa'], ['Separator', 'separator', 'Pozioma linia', 'linia hr']] },
      { k: 'media', name: 'Media', items: [['Galeria', 'gallery', 'Siatka zdjęć z powiększeniem', 'zdjęcia'], ['Wideo', 'video', 'Film z pliku lub serwisu', 'film youtube']] },
      { k: 'content', name: 'Treść', items: [['Karta', 'card', 'Obraz, tytuł, tekst i przycisk', 'kafelek box'], ['Baner (Hero)', 'hero', 'Duży nagłówek z tłem i przyciskami', 'hero nagłówek strony']] },
      { k: 'inter', name: 'Interakcje', items: [['FAQ / Akordeon', 'faq', 'Rozwijane pytania i odpowiedzi', 'pytania accordion']] }
    ];
    const RECENT = [['Przycisk', 'button', 'Link w formie przycisku'], ['Tekst', 'text', 'Akapit z formatowaniem'], ['Kolumny', 'columns', 'Treść obok siebie']];
    const tile = ([n, k, d]) => ({ name: n, desc: d, aria: 'Dodaj blok: ' + n, ...ico(k) });

    const lib = (q) => {
      const query = (q || '').trim().toLowerCase();
      if (!query) {
        const groups = [{ k: 'recent', name: 'Ostatnio używane', tiles: RECENT.map(tile) }].concat(CAT.map((c) => ({ k: c.k, name: c.name, tiles: c.items.map(tile) })))
          .map((g) => { const open = !!s.open[g.k]; return { name: g.name, count: String(g.tiles.length), tiles: g.tiles, open, openStr: open ? 'true' : 'false', toggle: () => this.setState({ open: { ...this.state.open, [g.k]: !open } }) }; });
        return { browse: true, search: false, none: false, groups, results: [], countLabel: '' };
      }
      const results = [];
      CAT.forEach((c) => c.items.forEach(([n, k, d, syn]) => {
        const i = n.toLowerCase().indexOf(query);
        if (i >= 0 || syn.indexOf(query) >= 0) {
          results.push({ pre: i >= 0 ? n.slice(0, i) : n, mid: i >= 0 ? n.slice(i, i + query.length) : '', post: i >= 0 ? n.slice(i + query.length) : '', cat: c.name, desc: d, aria: 'Dodaj blok: ' + n, ...ico(k) });
        }
      }));
      const nn = results.length;
      return { browse: false, search: nn > 0, none: nn === 0, groups: [], results, countLabel: nn === 1 ? '1 wynik' : nn < 5 ? nn + ' wyniki' : nn + ' wyników' };
    };

    const CHIPS = [['all', 'Wszystkie'], ['hero', 'Banery'], ['content', 'Treść'], ['social', 'Opinie'], ['contact', 'Kontakt'], ['mine', 'Moje wzorce']];
    const PATTERNS = [
      { c: 'hero', name: 'Baner z obrazem', desc: 'Nagłówek, opis, dwa przyciski, zdjęcie', hero: true },
      { c: 'content', name: 'Trzy karty', desc: 'Nagłówek sekcji i trzy karty z ikonami', cards: true },
      { c: 'social', name: 'Opinia klienta', desc: 'Cytat na tle z podpisem', quote: true },
      { c: 'contact', name: 'Wezwanie do działania', desc: 'Ciemny pas z nagłówkiem i przyciskiem', cta: true }
    ];
    const patterns = PATTERNS.filter((p) => s.chip === 'all' || p.c === s.chip).map((p) => ({ hero: false, cards: false, quote: false, cta: false, ...p, aria: 'Wstaw wzorzec: ' + p.name }));
    const chips = CHIPS.map(([k, n]) => ({ name: n, on: s.chip === k ? 'true' : 'false', pick: () => this.setState({ chip: k }) }));

    const B = {
      page: { n: 'Strona', t: 'page', p: null },
      hero: { n: 'Sekcja', l: 'Baner', t: 'section', p: 'page' },
      heroCols: { n: 'Kolumny', t: 'columns', p: 'hero' },
      heroCol1: { n: 'Kolumna', t: 'column', p: 'heroCols' },
      heroH: { n: 'Nagłówek', t: 'heading', p: 'heroCol1', ovr: 1 },
      heroP: { n: 'Tekst', t: 'text', p: 'heroCol1' },
      heroBtn: { n: 'Przycisk', l: 'Umów konsultację', t: 'button', p: 'heroCol1' },
      heroBtn2: { n: 'Przycisk', l: 'Zobacz realizacje', t: 'button', p: 'heroCol1' },
      heroCol2: { n: 'Kolumna', t: 'column', p: 'heroCols' },
      heroImg: { n: 'Obraz', t: 'image', p: 'heroCol2', warn: 1 },
      offer: { n: 'Sekcja', l: 'Oferta', t: 'section', p: 'page', cond: 1 },
      offerH: { n: 'Nagłówek', t: 'heading', p: 'offer' },
      offerCols: { n: 'Kolumny', t: 'columns', p: 'offer' },
      card1: { n: 'Karta', l: 'Projekt koncepcyjny', t: 'card', p: 'offerCols' },
      card2: { n: 'Karta', l: 'Projekt wykonawczy', t: 'card', p: 'offerCols' },
      card3: { n: 'Karta', l: 'Nadzór', t: 'card', p: 'offerCols' },
      about: { n: 'Sekcja', l: 'Jak pracujemy', t: 'section', p: 'page' },
      aboutText: { n: 'Tekst', t: 'text', p: 'about' },
      quote: { n: 'Cytat', t: 'quote', p: 'about' },
      cta: { n: 'Sekcja', l: 'Kontakt', t: 'section', p: 'page' },
      ctaH: { n: 'Nagłówek', t: 'heading', p: 'cta' },
      ctaBtn: { n: 'Przycisk', l: 'Napisz do nas', t: 'button', p: 'cta' }
    };
    const ids = Object.keys(B);
    const kids = (id) => ids.filter((x) => B[x].p === id);
    const depth = (id) => { let d = 0, n = B[id].p; while (n) { d++; n = B[n].p; } return d; };
    const shown = (id) => { let n = B[id].p; while (n) { if (!s.exp[n]) return false; n = B[n].p; } return true; };
    const rows = ids.filter(shown).map((id) => {
      const hasKids = kids(id).length > 0, exp = !!s.exp[id], hidden = !!s.hidden[id], locked = !!s.locked[id], sel = s.sel === id;
      const custom = s.names[id];
      return {
        level: String(depth(id) + 1),
        cls: 'bd-trow' + (sel ? ' is-sel' : '') + (hidden ? ' is-hidden' : ''),
        selStr: sel ? 'true' : 'false', expStr: hasKids ? (exp ? 'true' : 'false') : undefined,
        guides: Array.from({ length: depth(id) }, (_, i) => i),
        hasKids, noKids: !hasKids, twLabel: exp ? 'Zwiń' : 'Rozwiń',
        toggle: () => this.setState({ exp: { ...this.state.exp, [id]: !exp } }),
        name: custom || B[id].n, label: custom ? '' : (B[id].l || ''), ...ico(B[id].t),
        ovr: !!B[id].ovr, cond: !!B[id].cond, warn: !!B[id].warn,
        pick: () => this.setState({ sel: id }),
        rename: () => this.setState({ sel: id, renaming: id, draft: custom || B[id].n }),
        renaming: s.renaming === id, notRenaming: s.renaming !== id,
        visible: !hidden, hidden, hiddenStr: hidden ? 'true' : 'false',
        eyeLabel: hidden ? 'Pokaż w edytorze' : 'Ukryj w edytorze',
        eyeCls: 'bd-iconbtn' + (hidden ? ' is-on' : ''),
        toggleHide: () => this.setState({ hidden: { ...this.state.hidden, [id]: !hidden } }),
        locked, unlocked: !locked, lockedStr: locked ? 'true' : 'false',
        lockLabel: locked ? 'Odblokuj' : 'Zablokuj',
        lockCls: 'bd-iconbtn' + (locked ? ' is-on' : ''),
        toggleLock: () => this.setState({ locked: { ...this.state.locked, [id]: !locked } })
      };
    });
    const commit = () => { const id = this.state.renaming; if (!id) return; const v = (this.state.draft || '').trim(); this.setState({ renaming: null, names: { ...this.state.names, [id]: v && v !== B[id].n ? v : undefined } }); };

    const theme = this.props.theme ?? 'light';
    return {
      theme, yes: true,
      q1: s.q1, onQ1: (e) => this.setState({ q1: e.target.value }), L1: s.v1 === 'patterns' ? { browse: false, search: false, none: false, groups: [], results: [], countLabel: '' } : lib(s.q1),
      q2: s.q2, onQ2: (e) => this.setState({ q2: e.target.value }), clearQ2: () => this.setState({ q2: '' }), L2: lib(s.q2),
      v1: { blocks: s.v1 === 'blocks' ? 'true' : 'false', patterns: s.v1 === 'patterns' ? 'true' : 'false', patternsOn: s.v1 === 'patterns', toBlocks: () => this.setState({ v1: 'blocks' }), toPatterns: () => this.setState({ v1: 'patterns' }) },
      chips, patterns, rows,
      collapseAll: () => this.setState({ exp: { page: 1 } }),
      expandAll: () => { const e = {}; ids.forEach((x) => { e[x] = 1; }); this.setState({ exp: e }); },
      draft: s.draft, onDraft: (e) => this.setState({ draft: e.target.value }),
      onRenameKey: (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') this.setState({ renaming: null }); },
      commitRename: commit
    };
  }
}

  window.Buildr.register('left-panel', Component, {"theme": "light"});
})();
