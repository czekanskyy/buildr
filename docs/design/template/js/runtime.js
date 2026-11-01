/*
 * Buildr template runtime – a small, dependency-free view layer for the static template.
 *
 * Each screen is a template (a <script type="text/x-template" data-component="name"> block in the
 * HTML) plus a component class (js/<name>.js) whose renderVals() returns the values the template
 * reads. The runtime:
 *   - parses the template once (own parser, so <sc-for> inside <select> survives),
 *   - renders {{dotted.lookup}} holes, <sc-for list as> loops and <sc-if value> branches,
 *   - patches the live DOM in place (inputs keep focus, sliders keep dragging),
 *   - wires on* attributes to native events (onClick, onChange, onKeyDown, onPointerDown…),
 *   - sets rich text through data-html="{{hole}}" as innerHTML (skipped while that element is being edited).
 *
 * It is a demo harness for mocked state, not a framework to ship: the production editor
 * re-implements these screens in packages/editor.
 */
(function () {
  'use strict';

  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const BOOL = { checked: 'checked', disabled: 'disabled', readonly: 'readOnly', autofocus: 'autofocus', hidden: 'hidden', selected: 'selected', multiple: 'multiple', required: 'required' };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });

  /* ---------- Parser: template string -> tree of { tag, attrs, kids } and text strings ---------- */
  function parse(src) {
    const root = { tag: '#root', attrs: [], kids: [] };
    const stack = [root];
    const re = /<!--[\s\S]*?-->|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
    const attrRe = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m;
    while ((m = re.exec(src))) {
      const top = stack[stack.length - 1];
      if (m[0].startsWith('<!--')) continue;
      if (m[1]) {
        const name = m[1].toLowerCase();
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tag.toLowerCase() === name) { stack.length = i; break; }
        }
      } else if (m[2]) {
        const attrs = [];
        let a;
        attrRe.lastIndex = 0;
        while ((a = attrRe.exec(m[3] || ''))) attrs.push([a[1], decode(a[2] ?? a[3] ?? a[4] ?? '')]);
        const el = { tag: m[2], attrs, kids: [] };
        top.kids.push(el);
        if (!m[4] && !VOID.has(m[2].toLowerCase())) stack.push(el);
      } else if (m[5]) {
        top.kids.push(decode(m[5]));
      }
    }
    return root;
  }

  /* ---------- Render: tree + values -> virtual nodes ---------- */
  const HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  const ONLY = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/;
  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    const parts = path.split('.');
    let v = scope;
    for (const p of parts) { if (v == null) return undefined; v = v[p]; }
    return v;
  }
  const str = (v) => (v == null || v === false ? '' : String(v));
  const interp = (s, scope) => s.replace(HOLE, (_, p) => str(lookup(p, scope)));

  function render(node, scope, out) {
    for (const k of node.kids) {
      if (typeof k === 'string') {
        const t = k.includes('{{') ? interp(k, scope) : k;
        if (t) out.push(t);
        continue;
      }
      const tag = k.tag.toLowerCase();
      if (tag === 'sc-for') {
        const listAttr = k.attrs.find((a) => a[0] === 'list');
        const asAttr = k.attrs.find((a) => a[0] === 'as');
        const m = listAttr && ONLY.exec(listAttr[1]);
        const list = m ? lookup(m[1], scope) : null;
        if (Array.isArray(list)) {
          const name = asAttr ? asAttr[1] : 'item';
          list.forEach((item, i) => render(k, Object.assign(Object.create(scope), { [name]: item, $index: i }), out));
        }
        continue;
      }
      if (tag === 'sc-if') {
        const v = k.attrs.find((a) => a[0] === 'value');
        const m = v && ONLY.exec(v[1]);
        if (m && lookup(m[1], scope)) render(k, scope, out);
        continue;
      }
      const vn = { tag: k.tag, attrs: {}, on: {}, ref: null, kids: [] };
      for (const [name, raw] of k.attrs) {
        const only = ONLY.exec(raw);
        const lname = name.toLowerCase();
        if (lname.startsWith('on') && only) {
          const fn = lookup(only[1], scope);
          if (typeof fn === 'function') vn.on[lname.slice(2)] = fn;
          continue;
        }
        if (lname === 'ref' && only) { vn.ref = lookup(only[1], scope); continue; }
        if (lname === 'data-html' && only) { vn.html = str(lookup(only[1], scope)); continue; }
        if (only) {
          const v = lookup(only[1], scope);
          if (BOOL[lname]) { if (v === true || v === 'true') vn.attrs[lname] = ''; continue; }
          if (v == null) continue;
          vn.attrs[name] = String(v);
        } else {
          vn.attrs[name] = raw.includes('{{') ? interp(raw, scope) : raw;
        }
      }
      render(k, scope, vn.kids);
      out.push(vn);
    }
    return out;
  }

  /* ---------- Patch: virtual nodes -> live DOM, in place ---------- */
  function eventType(vn, key) {
    if (key === 'change') {
      const tag = vn.tag.toLowerCase();
      const type = (vn.attrs.type || '').toLowerCase();
      if ((tag === 'input' && type !== 'checkbox' && type !== 'radio') || tag === 'textarea') return 'input';
    }
    return key;
  }
  function create(vn, svg) {
    if (typeof vn === 'string') return document.createTextNode(vn);
    const isSvg = svg || vn.tag.toLowerCase() === 'svg';
    const el = isSvg ? document.createElementNS(SVG_NS, vn.tag) : document.createElement(vn.tag);
    el.__a = {};
    el.__h = {};
    update(el, vn, isSvg, true);
    return el;
  }
  function update(el, vn, svg, fresh) {
    const prev = el.__a || {};
    for (const n in prev) if (!(n in vn.attrs)) el.removeAttribute(n);
    const tagName = vn.tag.toLowerCase();
    const liveValue = !svg && (tagName === 'input' || tagName === 'textarea' || tagName === 'select');
    for (const n in vn.attrs) {
      if (prev[n] !== vn.attrs[n]) {
        if (n === 'value' && liveValue) continue; // set as a property below, so typing is not overwritten
        el.setAttribute(n, vn.attrs[n]);
      }
    }
    el.__a = vn.attrs;
    const want = {};
    for (const k in vn.on) want[eventType(vn, k)] = vn.on[k];
    el.__h = el.__h || {};
    for (const t in want) {
      if (!el.__h[t]) el.addEventListener(t, (e) => { const h = el.__h[t]; if (h) h(e); });
      el.__h[t] = want[t];
    }
    for (const t in el.__h) if (!want[t]) el.__h[t] = null;
    const childSvg = svg && vn.tag.toLowerCase() !== 'foreignobject';
    if (vn.html !== undefined) {
      // Rich text: set as HTML, but never while the user is typing in it (keeps the caret).
      const editing = el.isContentEditable && el.contains(document.activeElement);
      if (!editing && el.__html !== vn.html) { el.innerHTML = vn.html; }
      el.__html = vn.html;
    } else {
      patchKids(el, vn.kids, childSvg);
    }
    if (!svg) {
      const tag = vn.tag.toLowerCase();
      if ('value' in vn.attrs && (tag === 'input' || tag === 'textarea' || tag === 'select')) {
        const focused = document.activeElement === el;
        const type = (el.type || '').toLowerCase();
        const typing = focused && tag !== 'select' && type !== 'range' && type !== 'checkbox';
        if (!typing && el.value !== vn.attrs.value) el.value = vn.attrs.value;
      }
      if (tag === 'input' && (el.type === 'checkbox' || el.type === 'radio')) el.checked = 'checked' in vn.attrs;
      if (fresh && 'autofocus' in vn.attrs) setTimeout(() => el.focus(), 0);
    }
    if (typeof vn.ref === 'function') vn.ref(el);
  }
  function patchKids(parent, kids, svg) {
    const old = parent.childNodes;
    let i = 0;
    for (; i < kids.length; i++) {
      const vn = kids[i];
      const cur = old[i];
      if (!cur) { parent.appendChild(create(vn, svg)); continue; }
      if (typeof vn === 'string') {
        if (cur.nodeType === 3) { if (cur.data !== vn) cur.data = vn; } else parent.replaceChild(create(vn, svg), cur);
        continue;
      }
      if (cur.nodeType === 1 && cur.__a && cur.tagName.toLowerCase() === vn.tag.toLowerCase()) update(cur, vn, svg || vn.tag.toLowerCase() === 'svg', false);
      else parent.replaceChild(create(vn, svg), cur);
    }
    while (parent.childNodes.length > kids.length) parent.removeChild(parent.lastChild);
  }

  /* ---------- Components ---------- */
  class Component {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(upd) {
      const patch = typeof upd === 'function' ? upd(this.state, this.props) : upd;
      if (!patch) return;
      this.state = Object.assign({}, this.state, patch);
      this.__schedule && this.__schedule();
    }
  }

  const registry = {};
  const mounted = {};
  function register(name, Cls, props) { registry[name] = { Cls, props: props || {} }; }

  function mount(host, name) {
    const reg = registry[name];
    const tplEl = document.querySelector('script[type="text/x-template"][data-component="' + name + '"]');
    if (!reg || !tplEl) { console.error('Buildr: missing component or template', name); return; }
    const tree = parse(tplEl.textContent);
    const inst = new reg.Cls(Object.assign({}, reg.props));
    let queued = false;
    let lastProps = inst.props;
    let lastState = inst.state;
    const paint = () => {
      queued = false;
      const vals = inst.renderVals();
      patchKids(host, render(tree, vals, []), false);
    };
    inst.__schedule = () => {
      if (queued) return;
      queued = true;
      Promise.resolve().then(() => {
        const pp = lastProps;
        const ps = lastState;
        paint();
        lastProps = inst.props;
        lastState = inst.state;
        if (inst.componentDidUpdate) inst.componentDidUpdate(pp, ps);
      });
    };
    paint();
    lastState = inst.state;
    if (inst.componentDidMount) inst.componentDidMount();
    mounted[name] = inst;
    return inst;
  }

  function setProps(name, patch) {
    const inst = mounted[name];
    if (!inst) return;
    inst.props = Object.assign({}, inst.props, patch);
    inst.__schedule();
  }

  function boot() {
    document.querySelectorAll('[data-mount]').forEach((host) => mount(host, host.getAttribute('data-mount')));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.Buildr = { Component, register, mount, setProps, mounted, parse, render };
})();
