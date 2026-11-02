/* Settings panel with every Styl section and a live card preview.
 * Mocked state only: values live in this component's state and reset on reload. */
(function () {
  'use strict';
  const DCLogic = window.Buildr.Component;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    let open = { layout: true, spacing: true };
    try { const o = JSON.parse(window.localStorage.getItem('buildr.inspector.open') || 'null'); if (o) open = o; } catch (e) {}
    this.state = {
      tab: 'style', device: 'desktop', q: '', open, pop: null, fq: '', moreDims: false, animKey: 0, bound: { title: false, url: true },
      v: { desktop: { shPreset: 'soft', shX: 0, shY: 1, shBlur: 3, shSpread: 0, shOp: 12, cBtn: { hex: '#1f6f5c', a: 100 } }, tablet: {}, mobile: { wmode: 'full', fs: 15, p: { t: 20, r: 20, b: 20, l: 20 } } }
    };
  }
  persistOpen(open) { try { window.localStorage.setItem('buildr.inspector.open', JSON.stringify(open)); } catch (e) {} }
  renderVals() {
    const s = this.state;
    const dev = s.device;
    const D = {
      display: 'flex', dir: 'column', jx: 'start', jy: 'start', cols: 2, gap: 12, wmode: 'custom', w: 340, wUnit: 'px', h: '', minW: '', maxW: '', minH: '', maxH: '',
      m: { t: 0, r: 0, b: 0, l: 0 }, mLink: true, mUnit: 'px', p: { t: 28, r: 28, b: 28, l: 28 }, pLink: true, pUnit: 'px',
      font: 'Manrope', fs: 16, fsUnit: 'px', fw: '400', fst: 'normal', lh: 1.6, ls: 0, ta: 'left', tt: 'none', td: 'none',
      cText: { hex: '#15201d', a: 100 }, cLink: { hex: '#1f6f5c', a: 100 }, cLinkH: { hex: '#17574a', a: 100 }, cBtn: { hex: '#1f6f5c', a: 100 },
      bgType: 'color', bgColor: { hex: '#ffffff', a: 100 }, gKind: 'linear', g1: { hex: '#eef4f1', a: 100 }, g2: { hex: '#ffffff', a: 100 }, gAngle: 160,
      bgPos: 'cc', bgSize: 'cover', bgRepeat: 'no-repeat', bgAttach: 'scroll', vUrl: 'https://wideo.example/salon.mp4', vLoop: true, vMute: true, ovOn: false, ovColor: { hex: '#15201d', a: 40 },
      bStyle: 'solid', bw: { t: 1, r: 1, b: 1, l: 1 }, bwLink: true, bColor: { hex: '#d9e3df', a: 100 }, r: { tl: 14, tr: 14, br: 14, bl: 14 }, rLink: true,
      shPreset: 'none', shX: 0, shY: 8, shBlur: 24, shSpread: -4, shColor: { hex: '#15201d', a: 18 }, shOp: 18, shInset: false,
      tsOn: false, tsX: 0, tsY: 1, tsBlur: 2, tsColor: { hex: '#000000', a: 25 },
      op: 100, blur: 0, br: 100, ct: 100, sat: 100, rot: 0, sc: 100, tx: 0, ty: 0, blend: 'normal',
      aType: 'slide', aDir: 'up', aDur: 600, aDelay: 0, aEase: 'out',
      hColor: true, hShadow: true, hMove: true, hDur: 200, hEase: 'standard', hY: 4, hSh: 'medium', reveal: true, parallax: 0,
      showIcon: true, title: 'Projekt koncepcyjny', tag: 'h3', desc: 'Układ funkcjonalny, moodboard i dwa warianty aranżacji do wyboru.', url: 'wpis.link', newTab: false, linkText: 'Szczegóły etapu',
      showBtn: true, btnText: 'Zamów etap', btnVar: 'solid',
      hideD: false, hideT: false, hideM: false, pos: 'static', off: { t: 0, r: 0, b: 0, l: 0 }, offLink: false, z: '', elId: 'karta-koncepcja', cls: 'karta karta--wyrozniona', anchor: 'koncepcja', css: '/* Ten blok */\nselector:hover h3 {\n  text-decoration: underline;\n}'
    };
    const RESP = { display: 1, dir: 1, jx: 1, jy: 1, cols: 1, gap: 1, wmode: 1, w: 1, h: 1, m: 1, p: 1, fs: 1, lh: 1, ls: 1, ta: 1 };
    const chain = dev === 'mobile' ? ['mobile', 'tablet', 'desktop'] : dev === 'tablet' ? ['tablet', 'desktop'] : ['desktop'];
    const get = (k, st) => { const vv = (st || this.state).v; for (const d of chain) { if (vv[d] && k in vv[d]) return vv[d][k]; } return D[k]; };
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const changed = (k) => !eq(get(k), D[k]);
    const ovr = (k) => dev !== 'desktop' && RESP[k] && k in s.v[dev];
    const set = (k, val) => this.setState((st) => { const target = RESP[k] && dev !== 'desktop' ? dev : 'desktop'; return { v: { ...st.v, [target]: { ...st.v[target], [k]: val } } }; });
    const setMany = (obj) => this.setState((st) => ({ v: { ...st.v, desktop: { ...st.v.desktop, ...obj } } }));
    const reset = (k) => this.setState((st) => { const v = { ...st.v }; const target = dev !== 'desktop' && RESP[k] && k in v[dev] ? dev : 'desktop'; const o = { ...v[target] }; delete o[k]; v[target] = o; return { v }; });
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const num = (x) => { const n = parseFloat(x); return isNaN(n) ? 0 : n; };
    const rgba = (c) => { const h = (c && c.hex) || '#000000'; const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); if (!m) return 'transparent'; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + ((c.a ?? 100) / 100) + ')'; };
    const hsl2hex = (h) => { const S = 0.55, L = 0.45; const k = (n) => (n + h / 30) % 12; const a = S * Math.min(L, 1 - L); const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
    const hex2hue = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0; const n = parseInt(m[1], 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; const d = mx - mn; let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round(h * 60); };

    const I = {
      desktop: ['M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4', '', ''],
      tablet: ['M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01', ''],
      mobile: ['M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'M12 18h.01', ''],
      content: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z', ''],
      style: ['M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4.5 4H15a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22Z', 'M7.5 11h.01M10.5 7h.01M15 7.5h.01', ''],
      adv: ['M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3', 'M2 14h4M10 8h4M18 16h4', ''],
      layout: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 9h18', 'M9 21V9'],
      spacing: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 8h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', ''],
      type: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
      color: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z', '', ''],
      bg: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'm3 16 5-5 4 4 3-3 6 6', ''],
      border: ['M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3', 'M21 16v3a2 2 0 0 1-2 2h-3', 'M8 21H5a2 2 0 0 1-2-2v-3'],
      shadow: ['M4 3h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 20h11a1 1 0 0 0 1-1V8', ''],
      effects: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 17v4M17 19h4', ''],
      anim: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'm10 8 6 4-6 4z', ''],
      image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'],
      text: ['M13 4v16', 'M17 4v16', 'M19 4H9.5a4.5 4.5 0 0 0 0 9H13'],
      link: ['M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7', 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7', ''],
      button: ['M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z', 'M8 12h8', ''],
      eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0', ''],
      cond: ['M3 6h18', 'M7 12h10', 'M10 18h4'],
      pos: ['M12 2v4M12 18v4M2 12h4M18 12h4', 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0', ''],
      tag: ['M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z', 'M7.5 7.5h.01', ''],
      anchor: ['M12 8a3 3 0 1 0 0-6a3 3 0 1 0 0 6z', 'M12 22V8', 'M5 12H2a10 10 0 0 0 20 0h-3'],
      list: ['M3 6h.01M3 12h.01M3 18h.01', 'M8 6h13M8 12h13', 'M8 18h13'],
      code: ['m16 18 6-6-6-6', 'm8 6-6 6 6 6', ''],
      dBlock: ['M4 4h16v6H4z', 'M4 14h16v6H4z', ''],
      dFlex: ['M3 5h18v14H3z', 'M9 5v14', 'M15 5v14'],
      dGrid: ['M3 3h7v7H3zM14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
      row: ['M5 12h14', 'm13 6 6 6-6 6', ''],
      col: ['M12 5v14', 'm6 13 6 6 6-6', ''],
      aL: ['M21 6H3', 'M15 12H3', 'M17 18H3'],
      aC: ['M21 6H3', 'M17 12H7', 'M19 18H5'],
      aR: ['M21 6H3', 'M21 12H9', 'M21 18H7'],
      aJ: ['M21 6H3', 'M21 12H3', 'M21 18H3'],
      italic: ['M19 4h-9', 'M14 20H5', 'M15 4 9 20'],
      upright: ['M7 4h10', 'M7 20h10', 'M12 4v16'],
      under: ['M6 4v6a6 6 0 0 0 12 0V4', 'M4 20h16', ''],
      strike: ['M16 4H9a3 3 0 0 0-2.8 4', 'M14 12a4 4 0 0 1 0 8H6', 'M4 12h16'],
      none: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'm5.6 5.6 12.8 12.8', ''],
      bSolid: ['M3 12h18', '', ''],
      bDash: ['M3 12h4M10 12h4M17 12h4', '', ''],
      bDot: ['M4 12h.01M8 12h.01M12 12h.01M16 12h.01M20 12h.01', '', ''],
      bDouble: ['M3 9h18', 'M3 15h18', ''],
      bgColor: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z', '', ''],
      bgGrad: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 15 15 3M9 21 21 9', ''],
      bgVideo: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'm10 9 5 3-5 3z', ''],
      up: ['M12 19V5', 'm5 12 7-7 7 7', ''], down: ['M12 5v14', 'm19 12-7 7-7-7', ''], left: ['M19 12H5', 'm12 19-7-7 7-7', ''], right: ['M5 12h14', 'm12 5 7 7-7 7', '']
    };
    const ico = (k) => { const a = I[k] || I.layout; return { d1: a[0], d2: a[1], d3: a[2] }; };
    const devIco = ico(dev);
    const devName = { desktop: 'Komputer', tablet: 'Tablet', mobile: 'Telefon' }[dev];
    const q = s.q.trim().toLowerCase();

    const scrub = (k, min, max, step) => (e) => {
      if (e.button !== 0) return;
      const sx = e.clientX, sv = num(get(k));
      const dec = String(step).includes('.') ? String(step).split('.')[1].length : 0;
      const mv = (ev) => { const d = Math.round((ev.clientX - sx) / 3) * step * (ev.shiftKey ? 10 : 1); set(k, Number(clamp(sv + d, min, max).toFixed(dec))); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    };
    const labelParts = (label) => { const i = q ? label.toLowerCase().indexOf(q) : -1; return i < 0 ? { lpre: label, lmid: '', lpost: '' } : { lpre: label.slice(0, i), lmid: label.slice(i, i + q.length), lpost: label.slice(i + q.length) }; };
    const base = (k, label, o) => {
      o = o || {};
      const ch = changed(k), resp = !!RESP[k], ov = ovr(k);
      return {
        key: k, id: 'f-' + k, label, kw: (o.kw || ''), ...labelParts(label), isGeneric: true, isSub: false,
        rowCls: 'bd-field' + (o.top ? ' bd-field--top' : '') + (ch ? ' is-changed' : ''),
        labelCls: 'bd-flabel' + (o.scrub ? ' bd-flabel--scrub' : ''), scrub: o.scrub || (() => {}), scrubTip: o.scrub ? 'Przeciągnij w bok, aby zmienić wartość' : '',
        resp, devCls: 'bd-dev' + (ov ? ' is-ovr' : ''), devTip: ov ? 'Własna wartość dla: ' + devName.toLowerCase() : 'Wartość responsywna – edytujesz: ' + devName.toLowerCase(),
        hasHelp: !!o.help, help: o.help || '', changed: ch, unchanged: !ch, reset: () => reset(k), hasResetSlot: o.noReset ? false : true,
        isRange: false, isSeg: false, isNum: false, isSelect: false, isFont: false, isColor: false, isSwitch: false, isText: false, isArea: false, isSides: false, isPad: false,
        isBox: false, isCorners: false, isShadowCards: false, isCards: false, isCurve: false, isPlay: false, isBgPrev: false, isImg: false, isChecks: false, isVis: false, isCond: false, isKV: false, isMore: false, isNote: false
      };
    };
    const range = (k, label, min, max, step, unit, o) => {
      const val = get(k); const p = ((num(val) - min) / (max - min)) * 100;
      return { ...base(k, label, { ...o, scrub: scrub(k, min, max, step) }), isRange: true, min: String(min), max: String(max), step: String(step), val: String(val), unit, valText: val + ' ' + unit, p: clamp(p, 0, 100).toFixed(1) + '%', onVal: (e) => set(k, e.target.value === '' ? D[k] : Number(e.target.value)) };
    };
    const seg = (k, label, opts, o) => {
      o = o || {}; const cur = get(k);
      return { ...base(k, label, o), isSeg: true, segCls: 'bd-seg bd-seg--fill' + (o.icons ? ' bd-seg--icons' : ''), opts: opts.map(([v, text, icon, tip], i) => ({ checked: cur === v ? 'true' : 'false', aria: tip || text, tip: tip || '', tipPos: i === opts.length - 1 ? 'end' : '', hasIcon: !!icon, hasText: !icon, text, ...ico(icon || 'layout'), pick: () => set(k, v) })) };
    };
    const numf = (k, label, o) => {
      o = o || {}; const val = get(k); const step = o.step || 1;
      return { ...base(k, label, { ...o, scrub: scrub(k, o.min ?? -9999, o.max ?? 9999, step) }), isNum: true, val: String(val), placeholder: o.placeholder || '', step: String(step), hasUnits: !!o.unitKey, noUnits: !o.unitKey, units: o.units || ['px', '%', 'rem', 'vw'], unitVal: o.unitKey ? get(o.unitKey) : '', unit: o.unit || '', onUnit: (e) => set(o.unitKey, e.target.value), onVal: (e) => set(k, e.target.value === '' ? '' : Number(e.target.value)), inc: () => set(k, num(get(k)) + step), dec: () => set(k, num(get(k)) - step) };
    };
    const select = (k, label, opts, o) => ({ ...base(k, label, o), isSelect: true, val: String(get(k)), opts: opts.map(([v, l]) => ({ v, l })), onVal: (e) => set(k, e.target.value) });
    const sw = (k, label, o) => ({ ...base(k, label, o), isSwitch: true, on: get(k) ? 'true' : 'false', toggle: () => set(k, !get(k)) });
    const text = (k, label, o) => {
      o = o || {}; const bound = !!(o.bind && s.bound[k]);
      return { ...base(k, label, o), isText: true, val: bound ? (o.boundVal || '') : String(get(k)), placeholder: o.placeholder || '', inputCls: 'bd-input' + (o.mono ? ' mono' : '') + (bound ? ' is-bound' : ''), onVal: (e) => set(k, e.target.value), bound, canBind: !!o.bind, srcCls: 'bd-srcmode' + (bound ? ' is-on' : ''), srcTip: bound ? 'Powiązane z danymi – kliknij, by wpisać stałą wartość' : 'Pobierz wartość z danych (Stała / Dane / Formuła)', toggleBind: () => this.setState((st) => ({ bound: { ...st.bound, [k]: !st.bound[k] } })) };
    };
    const area = (k, label, o) => ({ ...base(k, label, { ...o, top: true }), isArea: true, val: String(get(k)), placeholder: (o && o.placeholder) || '', inputCls: 'bd-input bd-input--area' + (o && o.mono ? ' mono' : ''), onVal: (e) => set(k, e.target.value) });
    const PAL = [['Marka', '#1f6f5c'], ['Marka ciemna', '#17574a'], ['Tekst', '#15201d'], ['Tekst drugorzędny', '#4a5753'], ['Mięta', '#eef4f1'], ['Piasek', '#f6f3ee'], ['Biały', '#ffffff'], ['Akcent ciepły', '#c8742c']];
    const color = (k, label, o) => {
      const c = get(k); const open = s.pop === k; const hue = hex2hue(c.hex);
      return { ...base(k, label, o), isColor: true, hex: c.hex, op: String(c.a), css: rgba(c), open, openStr: open ? 'true' : 'false', toggle: () => this.setState({ pop: open ? null : k }),
        onHex: (e) => { let h = e.target.value.trim(); if (h && h[0] !== '#') h = '#' + h; set(k, { ...c, hex: h }); },
        onOp: (e) => set(k, { ...c, a: clamp(num(e.target.value), 0, 100) }), opP: c.a + '%',
        hue: String(hue), hueP: (hue / 360 * 100).toFixed(1) + '%', onHue: (e) => set(k, { ...c, hex: hsl2hex(num(e.target.value)) }),
        palette: PAL.map(([n, h]) => ({ name: n, hex: h, on: h.toLowerCase() === (c.hex || '').toLowerCase() ? 'true' : 'false', pick: () => set(k, { ...c, hex: h }) })) };
    };
    const sides = (k, linkKey, label, o) => {
      const v = get(k), linked = get(linkKey);
      const setSide = (side) => (e) => { const n = num(e.target.value); set(k, linked ? { t: n, r: n, b: n, l: n } : { ...get(k), [side]: n }); };
      return { ...base(k, label, o), isSides: true, linked: linked ? 'true' : 'false', linkTip: linked ? 'Rozłącz wartości' : 'Połącz wartości', linkMid: linked ? 'M8 12h8' : '', toggleLink: () => set(linkKey, !linked),
        sides: [['t', 'Góra'], ['r', 'Prawo'], ['b', 'Dół'], ['l', 'Lewo']].map(([sd, n]) => ({ name: n, val: String(v[sd]), onVal: setSide(sd) })) };
    };
    const pad = (kx, ky, label, o) => {
      const X = ['start', 'center', 'end'], Y = ['start', 'center', 'end'];
      const XN = { start: 'do lewej', center: 'do środka', end: 'do prawej' }, YN = { start: 'u góry', center: 'pośrodku', end: 'na dole' };
      const cx = get(kx), cy = get(ky);
      const cells = []; Y.forEach((y) => X.forEach((x) => cells.push({ name: 'Wyrównaj ' + XN[x] + ', ' + YN[y], on: cx === x && cy === y ? 'true' : 'false', pick: () => { set(kx, x); set(ky, y); } })));
      const f = base(kx, label, o);
      return { ...f, isPad: true, changed: changed(kx) || changed(ky), unchanged: !(changed(kx) || changed(ky)), reset: () => { reset(kx); reset(ky); }, padCls: 'bd-pad' + (get('dir') === 'column' ? ' bd-pad--col' : ''), cells, padText: XN[cx][0].toUpperCase() + XN[cx].slice(1) + ', ' + YN[cy], padHint: (o && o.hint) || '' };
    };
    const sub = (label) => ({ ...base('_', label), isGeneric: false, isSub: true, changed: false });
    const special = (kind, extra) => ({ ...base('_' + kind, extra && extra.label || ''), isGeneric: false, [kind]: true, changed: false, ...(extra || {}) });

    // ---------- STYLE sections ----------
    const display = get('display');
    const layoutFields = [
      seg('display', 'Wyświetlanie', [['block', 'Blok', 'dBlock', 'Blok – elementy jeden pod drugim'], ['flex', 'Elastyczny', 'dFlex', 'Układ elastyczny – w rzędzie lub kolumnie'], ['grid', 'Siatka', 'dGrid', 'Siatka – kolumny i wiersze']], { icons: true, kw: 'display flex grid' })
    ];
    if (display === 'flex') {
      layoutFields.push(seg('dir', 'Kierunek', [['row', 'W poziomie', 'row', 'Kierunek: w poziomie (obok siebie)'], ['column', 'W pionie', 'col', 'Kierunek: w pionie (jeden pod drugim)']], { icons: true, kw: 'direction' }));
      layoutFields.push(pad('jx', 'jy', 'Wyrównanie', { hint: get('dir') === 'column' ? 'Poziomo: wyrównanie elementów. Pionowo: rozmieszczenie w karcie.' : 'Poziomo: rozmieszczenie. Pionowo: wyrównanie elementów.', kw: 'align justify wyrównanie' }));
    }
    if (display === 'grid') layoutFields.push(range('cols', 'Kolumny siatki', 1, 4, 1, 'kol.', { kw: 'columns grid' }));
    if (display !== 'block') layoutFields.push(range('gap', 'Odstęp między elementami', 0, 64, 1, 'px', { kw: 'gap odstęp' }));
    layoutFields.push(seg('wmode', 'Szerokość', [['auto', 'Auto', null, 'Dopasowana do treści'], ['full', 'Pełna', null, 'Cała dostępna szerokość'], ['custom', 'Własna', null, 'Własna szerokość']], { kw: 'width' }));
    if (get('wmode') === 'custom') layoutFields.push(numf('w', 'Wartość szerokości', { unitKey: 'wUnit', min: 0, kw: 'width' }));
    layoutFields.push(numf('h', 'Wysokość', { placeholder: 'auto', unit: 'px', min: 0, kw: 'height' }));
    layoutFields.push(special('isMore', { label: s.moreDims ? 'Mniej wymiarów' : 'Min. i maks. wymiary', openStr: s.moreDims ? 'true' : 'false', chev: s.moreDims ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6', toggle: () => this.setState({ moreDims: !s.moreDims }) }));
    if (s.moreDims) { layoutFields.push(numf('minW', 'Min. szerokość', { placeholder: 'brak', unit: 'px' }), numf('maxW', 'Maks. szerokość', { placeholder: 'brak', unit: 'px' }), numf('minH', 'Min. wysokość', { placeholder: 'brak', unit: 'px' }), numf('maxH', 'Maks. wysokość', { placeholder: 'brak', unit: 'px' })); }

    const boxSide = (k, linkKey) => { const v = get(k), linked = get(linkKey); const o = {}; ['t', 'r', 'b', 'l'].forEach((sd) => { o[sd] = { val: String(v[sd]), cls: v[sd] !== D[k][sd] ? 'is-changed' : '', onVal: (e) => { const n = num(e.target.value); set(k, linked ? { t: n, r: n, b: n, l: n } : { ...get(k), [sd]: n }); } }; }); return o; };
    const boxF = special('isBox', {
      label: 'Margines i dopełnienie', m: boxSide('m', 'mLink'), p: boxSide('p', 'pLink'), units: ['px', '%', 'rem', 'vw'],
      mUnit: get('mUnit'), pUnit: get('pUnit'), onMUnit: (e) => set('mUnit', e.target.value), onPUnit: (e) => set('pUnit', e.target.value),
      mLinked: get('mLink') ? 'true' : 'false', pLinked: get('pLink') ? 'true' : 'false', mLinkTip: get('mLink') ? 'Rozłącz marginesy' : 'Połącz marginesy', pLinkTip: get('pLink') ? 'Rozłącz dopełnienie' : 'Połącz dopełnienie',
      mLinkMid: get('mLink') ? 'M8 12h8' : '', pLinkMid: get('pLink') ? 'M8 12h8' : '', toggleMLink: () => set('mLink', !get('mLink')), togglePLink: () => set('pLink', !get('pLink')),
      devCls: 'bd-dev' + (ovr('m') || ovr('p') ? ' is-ovr' : ''), devTip: ovr('m') || ovr('p') ? 'Własne odstępy dla: ' + devName.toLowerCase() : 'Odstępy responsywne – edytujesz: ' + devName.toLowerCase(), kw: 'margines dopełnienie padding margin odstępy'
    });

    const FONTS = [['Manrope', '"Manrope", sans-serif', 'Bezszeryfowy'], ['Inter', '"Inter", sans-serif', 'Bezszeryfowy'], ['DM Sans', '"DM Sans", sans-serif', 'Bezszeryfowy'], ['Lora', '"Lora", serif', 'Szeryfowy'], ['Fraunces', '"Fraunces", serif', 'Szeryfowy'], ['Systemowy', 'system-ui, sans-serif', 'Systemowy']];
    const fontCss = (n) => (FONTS.find((f) => f[0] === n) || FONTS[0])[1];
    const fontOpen = s.pop === 'font';
    const fontF = { ...base('font', 'Krój pisma', { kw: 'font czcionka' }), isFont: true, val: get('font'), fontCss: fontCss(get('font')), open: fontOpen, openStr: fontOpen ? 'true' : 'false', toggle: () => this.setState({ pop: fontOpen ? null : 'font', fq: '' }), fq: s.fq, onFq: (e) => this.setState({ fq: e.target.value }), yes: true,
      fonts: FONTS.filter((f) => f[0].toLowerCase().includes(s.fq.toLowerCase())).map(([n, css, kind]) => ({ name: n, css, kind, on: get('font') === n ? 'true' : 'false', pick: () => { set('font', n); this.setState({ pop: null }); } })) };
    const typeFields = [
      fontF,
      numf('fs', 'Rozmiar', { unitKey: 'fsUnit', units: ['px', 'rem', 'em'], min: 8, max: 120, kw: 'font size' }),
      select('fw', 'Grubość', [['300', 'Cienka (300)'], ['400', 'Normalna (400)'], ['500', 'Średnia (500)'], ['600', 'Półgruba (600)'], ['700', 'Gruba (700)']], { kw: 'weight bold' }),
      seg('fst', 'Styl', [['normal', 'Prosty', 'upright', 'Styl: prosty'], ['italic', 'Kursywa', 'italic', 'Styl: kursywa']], { icons: true }),
      range('lh', 'Wysokość linii', 1, 2.4, 0.05, '×', { kw: 'line height interlinia' }),
      range('ls', 'Odstęp między literami', -2, 8, 0.5, 'px', { kw: 'letter spacing' }),
      seg('ta', 'Wyrównanie tekstu', [['left', 'Do lewej', 'aL', 'Wyrównaj do lewej'], ['center', 'Do środka', 'aC', 'Wyśrodkuj'], ['right', 'Do prawej', 'aR', 'Wyrównaj do prawej'], ['justify', 'Justuj', 'aJ', 'Wyjustuj']], { icons: true, kw: 'align' }),
      seg('tt', 'Wielkość liter', [['none', '–', null, 'Bez zmian'], ['uppercase', 'AB', null, 'WIELKIE LITERY'], ['lowercase', 'ab', null, 'małe litery'], ['capitalize', 'Ab', null, 'Każde Słowo Wielką Literą']], { kw: 'transform transformacja' }),
      seg('td', 'Dekoracja', [['none', 'Brak', 'none', 'Bez dekoracji'], ['underline', 'Podkreślenie', 'under', 'Podkreślenie'], ['line-through', 'Przekreślenie', 'strike', 'Przekreślenie']], { icons: true, kw: 'decoration underline' })
    ];
    const colorFields = [
      color('cText', 'Kolor tekstu', { kw: 'text' }),
      color('cLink', 'Kolor linków', { kw: 'link' }),
      color('cLinkH', 'Linki po najechaniu', { kw: 'hover link' }),
      color('cBtn', 'Kolor przycisku', { kw: 'button przycisk tło', help: 'Tło przycisku wewnątrz karty' }),
      special('isNote', { label: 'Kolory z palety strony zmieniają się razem z jej motywem.' })
    ];
    const bgType = get('bgType');
    const bgCss = () => {
      if (bgType === 'none') return 'background: transparent';
      if (bgType === 'color') return 'background: ' + rgba(get('bgColor'));
      if (bgType === 'gradient') return get('gKind') === 'linear' ? 'background: linear-gradient(' + get('gAngle') + 'deg, ' + rgba(get('g1')) + ', ' + rgba(get('g2')) + ')' : 'background: radial-gradient(circle at center, ' + rgba(get('g1')) + ', ' + rgba(get('g2')) + ')';
      if (bgType === 'image') { const P = { s: '0%', c: '50%', e: '100%' }; const pos = P[get('bgPos')[1]] + ' ' + P[get('bgPos')[0]]; return 'background-color: #d7e4de; background-image: radial-gradient(circle at 78% 26%, #f1d9b5 0 9%, transparent 9.5%), radial-gradient(ellipse 60% 45% at 38% 100%, #b9cfc6 0 98%, transparent 100%); background-size: ' + (get('bgSize') === 'auto' ? '240px 180px' : get('bgSize') === 'contain' ? 'contain' : 'cover') + '; background-repeat: ' + get('bgRepeat') + '; background-position: ' + pos + '; background-attachment: ' + (get('bgAttach') === 'fixed' ? 'fixed' : 'scroll'); }
      return 'background: #1d2a27';
    };
    const bgFields = [seg('bgType', 'Rodzaj tła', [['none', 'Brak', 'none', 'Brak tła'], ['color', 'Kolor', 'bgColor', 'Jednolity kolor'], ['gradient', 'Gradient', 'bgGrad', 'Gradient'], ['image', 'Obraz', 'image', 'Obraz'], ['video', 'Wideo', 'bgVideo', 'Wideo']], { icons: true, kw: 'background' }), special('isBgPrev', { css: bgCss() + (get('ovOn') && bgType !== 'none' && bgType !== 'color' ? '; box-shadow: inset 0 0 0 999px ' + rgba(get('ovColor')) : '') })];
    if (bgType === 'color') bgFields.push(color('bgColor', 'Kolor tła'));
    if (bgType === 'gradient') bgFields.push(seg('gKind', 'Rodzaj', [['linear', 'Liniowy', null, 'Gradient liniowy'], ['radial', 'Kołowy', null, 'Gradient kołowy']]), color('g1', 'Kolor początkowy'), color('g2', 'Kolor końcowy'), range('gAngle', 'Kąt', 0, 360, 5, '°'));
    if (bgType === 'image') {
      bgFields.push(special('isImg', {}));
      const posPad = (() => { const X = ['s', 'c', 'e'], N = { s: ['lewo', 'góra'], c: ['środek', 'środek'], e: ['prawo', 'dół'] }; const cur = get('bgPos'); const cells = []; X.forEach((y) => X.forEach((x) => cells.push({ name: 'Pozycja: ' + N[y][1] + ', ' + N[x][0], on: cur === y + x ? 'true' : 'false', pick: () => set('bgPos', y + x) }))); return { ...base('bgPos', 'Pozycja'), isPad: true, padCls: 'bd-pad', cells, padText: 'Punkt zaczepienia', padHint: 'Która część obrazu zostaje widoczna przy przycięciu.' }; })();
      bgFields.push(posPad,
        seg('bgSize', 'Rozmiar', [['cover', 'Wypełnij', null, 'Wypełnij całe tło (przycina)'], ['contain', 'Dopasuj', null, 'Pokaż cały obraz'], ['auto', 'Oryginalny', null, 'Oryginalny rozmiar']]),
        seg('bgRepeat', 'Powtarzanie', [['no-repeat', 'Brak', null, 'Bez powtarzania'], ['repeat', 'Kafelki', null, 'Powtarzaj w obu kierunkach'], ['repeat-x', 'Poziomo', null, 'Powtarzaj w poziomie']]),
        seg('bgAttach', 'Przewijanie', [['scroll', 'Zwykłe', null, 'Tło przewija się z treścią'], ['fixed', 'Stałe', null, 'Tło stoi w miejscu'], ['parallax', 'Paralaksa', null, 'Tło przesuwa się wolniej niż treść']]));
    }
    if (bgType === 'video') bgFields.push(text('vUrl', 'Adres wideo', { mono: true, top: true, placeholder: 'https://' }), sw('vLoop', 'Odtwarzaj w pętli'), sw('vMute', 'Bez dźwięku'), special('isNote', { label: 'Na telefonach zamiast wideo pokażemy pierwszą klatkę.' }));
    if (bgType === 'image' || bgType === 'video' || bgType === 'gradient') { bgFields.push(sw('ovOn', 'Nakładka')); if (get('ovOn')) bgFields.push(color('ovColor', 'Kolor nakładki')); }

    const r = get('r'), rLinked = get('rLink');
    const corner = (c) => ({ val: String(r[c]), onVal: (e) => { const n = Math.max(0, num(e.target.value)); set('r', rLinked ? { tl: n, tr: n, br: n, bl: n } : { ...get('r'), [c]: n }); } });
    const borderFields = [
      seg('bStyle', 'Styl obramowania', [['none', 'Brak', 'none', 'Bez obramowania'], ['solid', 'Ciągła', 'bSolid', 'Linia ciągła'], ['dashed', 'Kreskowana', 'bDash', 'Linia kreskowana'], ['dotted', 'Kropkowana', 'bDot', 'Linia kropkowana'], ['double', 'Podwójna', 'bDouble', 'Linia podwójna']], { icons: true, kw: 'border' })
    ];
    if (get('bStyle') !== 'none') borderFields.push(sides('bw', 'bwLink', 'Grubość', { top: true, kw: 'border width' }), color('bColor', 'Kolor obramowania', { kw: 'border' }));
    borderFields.push(special('isCorners', { label: 'Zaokrąglenie rogów', c: { tl: corner('tl'), tr: corner('tr'), br: corner('br'), bl: corner('bl') }, radiusCss: r.tl + 'px ' + r.tr + 'px ' + r.br + 'px ' + r.bl + 'px', linked: rLinked ? 'true' : 'false', linkTip: rLinked ? 'Rozłącz rogi' : 'Połącz rogi', linkMid: rLinked ? 'M8 12h8' : '', toggleLink: () => set('rLink', !rLinked), changed: changed('r'), reset: () => reset('r'), kw: 'radius zaokrąglenie rogów' }));

    const PRE = { none: null, soft: [0, 1, 3, 0, 12], medium: [0, 8, 24, -4, 18], strong: [0, 20, 48, -8, 28] };
    const shCss = (a, inset) => a ? (inset ? 'inset ' : '') + a[0] + 'px ' + a[1] + 'px ' + a[2] + 'px ' + a[3] + 'px rgba(21, 32, 29, ' + (a[4] / 100) + ')' : 'none';
    const shCur = get('shPreset') === 'none' ? 'none' : (get('shInset') ? 'inset ' : '') + get('shX') + 'px ' + get('shY') + 'px ' + get('shBlur') + 'px ' + get('shSpread') + 'px ' + rgba({ hex: get('shColor').hex, a: get('shOp') });
    const shadowFields = [
      special('isShadowCards', { css: shCur, cards: [['none', 'Brak'], ['soft', 'Delikatny'], ['medium', 'Średni'], ['strong', 'Mocny']].map(([k, n]) => ({ name: n, css: shCss(PRE[k]), on: get('shPreset') === k ? 'true' : 'false', pick: () => { if (PRE[k]) setMany({ shPreset: k, shX: PRE[k][0], shY: PRE[k][1], shBlur: PRE[k][2], shSpread: PRE[k][3], shOp: PRE[k][4], shInset: false }); else setMany({ shPreset: 'none' }); } })), kw: 'cień shadow' })
    ];
    if (get('shPreset') !== 'none') {
      const mk = (k) => (e) => setMany({ [k]: Number(e.target.value), shPreset: 'custom' });
      const shR = (k, label, min, max) => ({ ...range(k, label, min, max, 1, 'px'), onVal: mk(k) });
      shadowFields.push(sub(get('shPreset') === 'custom' ? 'Własny cień' : 'Dostosuj'), shR('shX', 'Przesunięcie X', -40, 40), shR('shY', 'Przesunięcie Y', -40, 40), shR('shBlur', 'Rozmycie', 0, 80), shR('shSpread', 'Rozpiętość', -40, 40), { ...range('shOp', 'Krycie cienia', 0, 100, 1, '%'), onVal: mk('shOp') }, color('shColor', 'Kolor cienia'), sw('shInset', 'Cień wewnętrzny'));
    }
    shadowFields.push(sub('Cień tekstu'), sw('tsOn', 'Cień nagłówka', { kw: 'text shadow' }));
    if (get('tsOn')) shadowFields.push(range('tsY', 'Przesunięcie Y', -10, 10, 1, 'px'), range('tsBlur', 'Rozmycie', 0, 20, 1, 'px'), color('tsColor', 'Kolor'));

    const effectFields = [
      range('op', 'Krycie', 0, 100, 1, '%', { kw: 'opacity przezroczystość' }), range('blur', 'Rozmycie', 0, 20, 1, 'px', { kw: 'blur' }),
      sub('Filtry'), range('br', 'Jasność', 0, 200, 1, '%', { kw: 'brightness' }), range('ct', 'Kontrast', 0, 200, 1, '%', { kw: 'contrast' }), range('sat', 'Nasycenie', 0, 200, 1, '%', { kw: 'saturation' }),
      sub('Przekształcenia'), range('rot', 'Obrót', -180, 180, 1, '°', { kw: 'rotate' }), range('sc', 'Skala', 50, 150, 1, '%', { kw: 'scale' }), numf('tx', 'Przesunięcie X', { unit: 'px' }), numf('ty', 'Przesunięcie Y', { unit: 'px' }),
      select('blend', 'Tryb mieszania', [['normal', 'Normalny'], ['multiply', 'Mnożenie'], ['screen', 'Rozjaśnianie'], ['overlay', 'Nakładka'], ['darken', 'Ciemniejsze'], ['lighten', 'Jaśniejsze'], ['luminosity', 'Jasność']], { kw: 'blend mix' })
    ];
    const EASE = { standard: ['Łagodna', [0.2, 0, 0, 1]], out: ['Wyhamowanie', [0, 0, 0.2, 1]], in: ['Przyspieszenie', [0.4, 0, 1, 1]], linear: ['Liniowa', [0, 0, 1, 1]], spring: ['Sprężysta', [0.34, 1.56, 0.64, 1]] };
    const easeCss = (k) => { const b = EASE[k][1]; return 'cubic-bezier(' + b.join(', ') + ')'; };
    const curve = (k) => { const b = EASE[k][1]; const X = (x) => (4 + 56 * x).toFixed(1), Y = (y) => (60 - 56 * y).toFixed(1); return { name: EASE[k][0], css: easeCss(k), path: 'M4 60 C' + X(b[0]) + ' ' + Y(b[1]) + ' ' + X(b[2]) + ' ' + Y(b[3]) + ' 60 4', ctl: 'M4 60 L' + X(b[0]) + ' ' + Y(b[1]) + ' M60 4 L' + X(b[2]) + ' ' + Y(b[3]) }; };
    const easeOpts = Object.keys(EASE).map((k) => [k, EASE[k][0]]);
    const animFields = [sub('Animacja wejścia'), select('aType', 'Efekt', [['none', 'Brak'], ['fade', 'Pojawienie'], ['slide', 'Wysunięcie'], ['zoom', 'Powiększenie']], { kw: 'entrance wejście' })];
    if (get('aType') !== 'none') {
      if (get('aType') === 'slide') animFields.push(seg('aDir', 'Kierunek', [['up', 'Z dołu', 'up', 'Wysuwa się z dołu'], ['down', 'Z góry', 'down', 'Wysuwa się z góry'], ['left', 'Z prawej', 'left', 'Wysuwa się z prawej'], ['right', 'Z lewej', 'right', 'Wysuwa się z lewej']], { icons: true }));
      animFields.push(range('aDur', 'Czas trwania', 100, 2000, 50, 'ms', { kw: 'duration' }), range('aDelay', 'Opóźnienie', 0, 2000, 50, 'ms', { kw: 'delay' }), select('aEase', 'Krzywa', easeOpts, { kw: 'easing' }), special('isCurve', curve(get('aEase'))), special('isPlay', { play: () => this.setState((st) => ({ animKey: st.animKey + 1 })) }));
    }
    animFields.push(sub('Po najechaniu'), special('isChecks', { label: 'Zmieniaj przy najechaniu', checks: [['hColor', 'Kolor linków'], ['hShadow', 'Cień'], ['hMove', 'Uniesienie']].map(([k, n]) => ({ name: n, on: !!get(k), toggle: () => set(k, !get(k)) })), kw: 'hover najechanie' }));
    if (get('hMove')) animFields.push(range('hY', 'Uniesienie', 0, 16, 1, 'px'));
    if (get('hShadow')) animFields.push(select('hSh', 'Cień po najechaniu', [['soft', 'Delikatny'], ['medium', 'Średni'], ['strong', 'Mocny']]));
    animFields.push(range('hDur', 'Czas przejścia', 0, 1000, 20, 'ms'), select('hEase', 'Krzywa przejścia', easeOpts), sub('Przy przewijaniu'), sw('reveal', 'Odsłaniaj przy przewijaniu', { kw: 'scroll' }), range('parallax', 'Siła paralaksy', 0, 100, 5, '%', { kw: 'parallax' }));

    // ---------- CONTENT and ADVANCED ----------
    const contentSecs = [
      { key: 'c-img', name: 'Ikona', icon: 'image', fields: [sw('showIcon', 'Pokaż ikonę')] },
      { key: 'c-text', name: 'Tekst', icon: 'text', fields: [text('title', 'Tytuł', { top: true, bind: true, boundVal: '{wpis.tytul}' }), seg('tag', 'Znacznik tytułu', [['h2', 'H2', null, 'Nagłówek 2. poziomu'], ['h3', 'H3', null, 'Nagłówek 3. poziomu'], ['h4', 'H4', null, 'Nagłówek 4. poziomu']], { help: 'Ważne dla SEO i czytników ekranu. Wygląd ustawiasz w Stylu.' }), area('desc', 'Opis')] },
      { key: 'c-link', name: 'Link', icon: 'link', fields: [text('url', 'Adres', { top: true, mono: true, bind: true, boundVal: '{wpis.link}' }), text('linkText', 'Tekst linku', { top: true }), sw('newTab', 'Otwórz w nowej karcie')] },
      { key: 'c-btn', name: 'Przycisk', icon: 'button', fields: get('showBtn') ? [sw('showBtn', 'Pokaż przycisk'), text('btnText', 'Tekst przycisku', { top: true }), special('isCards', { label: 'Wariant', cards: [['solid', 'Pełny', 'background: #1f6f5c; color: #ffffff'], ['outline', 'Obrys', 'box-shadow: inset 0 0 0 1.5px #15201d; color: #15201d'], ['text', 'Tekstowy', 'color: #1f6f5c; text-decoration: underline']].map(([k, n, css]) => ({ name: n, css, on: get('btnVar') === k ? 'true' : 'false', pick: () => set('btnVar', k) })) })] : [sw('showBtn', 'Pokaż przycisk')] }
    ];
    const advSecs = [
      { key: 'a-vis', name: 'Widoczność', icon: 'eye', fields: [special('isVis', { vis: [['hideD', 'Komputer', 'desktop'], ['hideT', 'Tablet', 'tablet'], ['hideM', 'Telefon', 'mobile']].map(([k, n, ic]) => ({ name: n, aria: (get(k) ? 'Pokaż' : 'Ukryj') + ' na urządzeniu: ' + n.toLowerCase(), on: get(k) ? 'true' : 'false', toggle: () => set(k, !get(k)), ...ico(ic) })), kw: 'ukryj hide' })], changedKeys: ['hideD', 'hideT', 'hideM'] },
      { key: 'a-cond', name: 'Warunek wyświetlania', icon: 'cond', fields: [special('isCond', {})] },
      { key: 'a-pos', name: 'Pozycjonowanie', icon: 'pos', fields: [select('pos', 'Pozycja', [['static', 'Domyślna (w przepływie)'], ['relative', 'Względna'], ['absolute', 'Bezwzględna'], ['sticky', 'Przyklejona'], ['fixed', 'Stała w oknie']], { help: 'Domyślna wystarcza w większości przypadków.' })].concat(get('pos') !== 'static' ? [sides('off', 'offLink', 'Przesunięcia', { top: true }), numf('z', 'Kolejność warstw', { placeholder: 'auto', help: 'Wyższa liczba = blok wyżej (z-index).' })] : []) },
      { key: 'a-id', name: 'Identyfikator i klasa CSS', icon: 'tag', fields: [text('elId', 'Identyfikator', { top: true, mono: true }), text('cls', 'Klasa CSS', { top: true, mono: true, help: 'Kilka klas oddziel spacją.' })] },
      { key: 'a-anchor', name: 'Kotwica', icon: 'anchor', fields: [text('anchor', 'Nazwa kotwicy', { top: true, mono: true }), special('isNote', { label: 'Link do tego miejsca: /#koncepcja' })] },
      { key: 'a-attr', name: 'Atrybuty', icon: 'list', fields: [special('isKV', {})] },
      { key: 'a-css', name: 'Własny CSS', icon: 'code', fields: [area('css', 'Reguły CSS', { mono: true }), special('isNote', { label: 'Słowo „selector” oznacza ten blok.' })] }
    ];
    const styleSecs = [
      { key: 'layout', name: 'Układ', icon: 'layout', fields: layoutFields, extra: ['jx', 'jy'] },
      { key: 'spacing', name: 'Odstępy', icon: 'spacing', fields: [boxF], keys: ['m', 'p', 'mLink', 'pLink', 'mUnit', 'pUnit'] },
      { key: 'type', name: 'Typografia', icon: 'type', fields: typeFields, extra: ['fsUnit'] },
      { key: 'colors', name: 'Kolory', icon: 'color', fields: colorFields },
      { key: 'bg', name: 'Tło', icon: 'bg', fields: bgFields },
      { key: 'border', name: 'Obramowanie i zaokrąglenia', icon: 'border', fields: borderFields, keys: ['r', 'rLink', 'bw', 'bwLink'] },
      { key: 'shadow', name: 'Cień', icon: 'shadow', fields: shadowFields, keys: ['shPreset', 'shX', 'shY', 'shBlur', 'shSpread', 'shOp', 'shColor', 'shInset'] },
      { key: 'effects', name: 'Efekty', icon: 'effects', fields: effectFields },
      { key: 'anim', name: 'Animacje', icon: 'anim', fields: animFields, keys: ['hColor', 'hShadow', 'hMove'] }
    ];
    const keysOf = (sec) => { const k = new Set(sec.keys || []); sec.fields.forEach((f) => { if (f.key && f.key[0] !== '_') k.add(f.key); }); (sec.extra || []).forEach((x) => k.add(x)); (sec.changedKeys || []).forEach((x) => k.add(x)); return [...k]; };
    const buildSecs = (secs) => secs.map((sec) => {
      const keys = keysOf(sec);
      const mod = keys.some((k) => k in D && changed(k));
      const ovs = keys.filter((k) => ovr(k));
      const nameHit = q && (sec.name.toLowerCase().includes(q));
      let fields = sec.fields;
      if (q && !nameHit) fields = fields.filter((f) => !f.isSub && ((f.label || '').toLowerCase().includes(q) || (f.kw || '').includes(q)));
      const visible = !q || nameHit || fields.length > 0;
      const open = q ? visible : !!s.open[sec.key];
      return { visible, name: sec.name, ...ico(sec.icon), mod, ovr: ovs.length > 0, ovrCount: String(ovs.length), ovrLabel: ovs.length + ' wartości dla: ' + devName.toLowerCase(), open, openStr: open ? 'true' : 'false', bodyId: 'sec-' + sec.key, bodyCls: 'bd-sec__body' + (open ? ' is-open' : ''),
        toggle: () => { const o = { ...this.state.open, [sec.key]: !this.state.open[sec.key] }; this.persistOpen(o); this.setState({ open: o }); },
        reset: () => this.setState((st) => { const v = { ...st.v }; const t = dev; const o = { ...v[t] }; keys.forEach((k) => { delete o[k]; }); v[t] = o; if (t !== 'desktop') { const d = { ...v.desktop }; keys.forEach((k) => { if (!RESP[k]) delete d[k]; }); v.desktop = d; } return { v }; }),
        fields, keysForTab: keys };
    }).filter((x) => x.visible);
    const tabSecs = { content: contentSecs, style: styleSecs, adv: advSecs };
    const sections = buildSecs(tabSecs[s.tab]);
    const tabMod = (t) => tabSecs[t].some((sec) => keysOf(sec).some((k) => k in D && changed(k)));
    const allKeys = sections.length ? (tabSecs[s.tab]).map((x) => x.key) : [];
    const allOpen = allKeys.every((k) => s.open[k]);

    // ---------- preview ----------
    const m = get('m'), p = get('p'), bw = get('bw');
    const mu = get('mUnit'), pu = get('pUnit');
    const wmode = get('wmode');
    const width = wmode === 'auto' ? 'fit-content' : wmode === 'full' ? '100%' : get('w') + get('wUnit');
    const hasBg = bgType !== 'none';
    const shHover = { soft: '0 2px 6px rgba(21, 32, 29, 0.14)', medium: '0 12px 28px -6px rgba(21, 32, 29, 0.22)', strong: '0 24px 56px -10px rgba(21, 32, 29, 0.32)' }[get('hSh')];
    const btnVar = get('btnVar');
    const tprop = [get('hColor') ? 'color' : null, get('hShadow') ? 'box-shadow' : null, get('hMove') ? 'transform' : null].filter(Boolean).join(', ') || 'none';
    const fw = (n) => n == null || n === '' ? '' : n;
    const cardStyle = [
      'display: ' + (display === 'grid' ? 'grid' : display === 'flex' ? 'flex' : 'block'),
      display === 'flex' ? 'flex-direction: ' + get('dir') : '',
      display === 'flex' ? (get('dir') === 'column' ? 'align-items: ' + get('jx') + '; justify-content: ' + get('jy') : 'justify-content: ' + get('jx') + '; align-items: ' + get('jy')) : '',
      display === 'grid' ? 'grid-template-columns: repeat(' + get('cols') + ', minmax(0, 1fr))' : '',
      display !== 'block' ? 'gap: ' + get('gap') + 'px' : '',
      'width: 100%',
      get('h') !== '' ? 'height: ' + get('h') + 'px' : '',
      fw(get('minH')) !== '' ? 'min-height: ' + get('minH') + 'px' : '', fw(get('maxH')) !== '' ? 'max-height: ' + get('maxH') + 'px' : '',
      'padding: ' + p.t + pu + ' ' + p.r + pu + ' ' + p.b + pu + ' ' + p.l + pu,
      'font-family: ' + fontCss(get('font')), 'font-size: ' + get('fs') + get('fsUnit'), 'font-weight: ' + get('fw'), 'font-style: ' + get('fst'), 'line-height: ' + get('lh'), 'letter-spacing: ' + get('ls') + 'px',
      'text-align: ' + get('ta'), 'text-transform: ' + get('tt'), 'text-decoration: ' + get('td'),
      'color: ' + rgba(get('cText')),
      '--link: ' + rgba(get('cLink')), '--link-h: ' + (get('hColor') ? rgba(get('cLinkH')) : rgba(get('cLink'))), '--btn: ' + rgba(get('cBtn')),
      bgCss(),
      get('bStyle') !== 'none' ? 'border-style: ' + get('bStyle') + '; border-color: ' + rgba(get('bColor')) + '; border-width: ' + bw.t + 'px ' + bw.r + 'px ' + bw.b + 'px ' + bw.l + 'px' : 'border: 0',
      'border-radius: ' + r.tl + 'px ' + r.tr + 'px ' + r.br + 'px ' + r.bl + 'px',
      'box-shadow: ' + shCur,
      'opacity: ' + get('op') / 100,
      'filter: blur(' + get('blur') + 'px) brightness(' + get('br') + '%) contrast(' + get('ct') + '%) saturate(' + get('sat') + '%)',
      '--tx: ' + num(get('tx')) + 'px', '--ty: ' + num(get('ty')) + 'px', '--rot: ' + get('rot') + 'deg', '--sc: ' + get('sc') / 100,
      'mix-blend-mode: ' + get('blend'),
      '--tprop: ' + tprop, '--tdur: ' + get('hDur') + 'ms', '--tease: ' + easeCss(get('hEase')),
      '--hy: ' + (get('hMove') ? get('hY') : 0) + 'px', '--hsh: ' + (get('hShadow') ? shHover : shCur)
    ].filter(Boolean).join('; ');
    const aType = get('aType'), aDir = get('aDir');
    const hiddenHere = { desktop: get('hideD'), tablet: get('hideT'), mobile: get('hideM') }[dev];
    const pv = {
      frameW: dev === 'desktop' ? '720px' : dev === 'tablet' ? '560px' : '360px', framePad: dev === 'mobile' ? '32px 20px' : '48px 40px', frameCls: 'pv-frame' + (dev !== 'desktop' ? ' is-device' : ''),
      marginCls: s.open.spacing && s.tab === 'style' ? 'pv-margin' : '', marginPad: m.t + mu + ' ' + m.r + mu + ' ' + m.b + mu + ' ' + m.l + mu, wrapDisplay: 'flow-root', wrapW: wmode === 'full' ? 'auto' : 'fit-content',
      selCls: 'pv-sel' + (aType !== 'none' && s.animKey > 0 ? (s.animKey % 2 ? ' pv-run-a' : ' pv-run-b') : ''), selDisplay: wmode === 'auto' ? 'inline-block' : 'block', selW: width,
      adur: get('aDur') + 'ms', aease: easeCss(get('aEase')), adelay: get('aDelay') + 'ms', aop: '0',
      ax: aType === 'slide' ? (aDir === 'left' ? '40px' : aDir === 'right' ? '-40px' : '0px') : '0px', ay: aType === 'slide' ? (aDir === 'up' ? '40px' : aDir === 'down' ? '-40px' : '0px') : '0px', asc: aType === 'zoom' ? '0.85' : '1',
      cardStyle, hasOverlay: get('ovOn') && (bgType === 'image' || bgType === 'video' || bgType === 'gradient'), overlay: rgba(get('ovColor')), isVideo: bgType === 'video',
      showIcon: !!get('showIcon'), title: s.bound.title ? 'Wiosenna promocja: projekt koncepcyjny' : get('title'), desc: get('desc'), linkText: get('linkText'), showBtn: !!get('showBtn'), btnText: get('btnText'),
      btnBg: btnVar === 'solid' ? rgba(get('cBtn')) : 'transparent', btnColor: btnVar === 'solid' ? '#ffffff' : btnVar === 'outline' ? rgba(get('cText')) : rgba(get('cBtn')), btnBorder: btnVar === 'outline' ? 'inset 0 0 0 1.5px ' + rgba(get('cText')) : 'none',
      textShadow: get('tsOn') ? '0 ' + get('tsY') + 'px ' + get('tsBlur') + 'px ' + rgba(get('tsColor')) : 'none',
      hiddenHere: !!hiddenHere, hiddenOp: hiddenHere ? '0.35' : '1'
    };

    const TABS = [['content', 'Treść', 'Treść i link bloku', ''], ['style', 'Styl', 'Wygląd bloku', ''], ['adv', 'Zaawansowane', 'Widoczność, pozycja, CSS', 'end']];
    return {
      theme: this.props.theme ?? 'light',
      devices: ['desktop', 'tablet', 'mobile'].map((d) => ({ on: dev === d ? 'true' : 'false', label: { desktop: 'Komputer', tablet: 'Tablet', mobile: 'Telefon' }[d], pick: () => this.setState({ device: d }), ...ico(d) })),
      devIco, devName: devName.toLowerCase(), devNote: dev !== 'desktop' && s.tab === 'style',
      tabs: TABS.map(([k, n, tip, pos]) => ({ name: n, tip, tipPos: pos, on: s.tab === k ? 'true' : 'false', mod: tabMod(k), pick: () => this.setState({ tab: k, pop: null }), ...ico(k) })),
      q: s.q, onQ: (e) => this.setState({ q: e.target.value }), noResults: !!q && sections.length === 0,
      sections, pv,
      allOpen, notAllOpen: !allOpen, allLabel: allOpen ? 'Zwiń wszystkie sekcje' : 'Rozwiń wszystkie sekcje',
      toggleAll: () => { const o = { ...this.state.open }; allKeys.forEach((k) => { o[k] = !allOpen; }); this.persistOpen(o); this.setState({ open: o }); }
    };
  }
}

  window.Buildr.register('style-panel', Component, {"theme": "light"});
})();
