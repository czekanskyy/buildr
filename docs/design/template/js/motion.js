/* Motion tokens and live demos.
 * Mocked state only: values live in this component's state and reset on reload. */
(function () {
  'use strict';
  const DCLogic = window.Buildr.Component;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { rm: false, on: { sel: true, acc: true, panel: true, menu: true, dlg: true, toast: true, insert: false, drop: true, dev: false } };
  }
  replay(k) {
    const onAfter = k !== 'insert' && k !== 'dev';
    if (k === 'dev') { this.setState((s) => ({ on: { ...s.on, dev: !s.on.dev } })); return; }
    if (k === 'insert') { this.setState((s) => ({ on: { ...s.on, insert: true } })); setTimeout(() => this.setState((s) => ({ on: { ...s.on, insert: false } })), 60); return; }
    this.setState((s) => ({ on: { ...s.on, [k]: false } }));
    setTimeout(() => this.setState((s) => ({ on: { ...s.on, [k]: onAfter } })), k === 'acc' || k === 'panel' ? 500 : 260);
  }
  renderVals() {
    const s = this.state, on = s.on;
    const DEMOS = [
      ['sel', 'Zaznaczenie bloku', 'base · 200 ms', 'standard', 'Kolor obrysu, bez zmiany rozmiaru', 'Obrys od razu', 'm-blk', 50],
      ['acc', 'Sekcja ustawień', 'base · 200 ms', 'standard', 'Wysokość treści i obrót strzałki', 'Rozwija się od razu', 'bd-sec__body', 50],
      ['panel', 'Zwijanie panelu', 'slow · 320 ms', 'standard', 'Szerokość kolumny, kanwa się dopasowuje', 'Zmiana od razu', 'side', 80],
      ['menu', 'Menu i podpowiedzi', 'fast · 120 ms', 'enter / exit', 'Krycie i 4 px w pionie, od strony przycisku', 'Tylko krycie', 'm-pop', 30],
      ['dlg', 'Okno dialogowe', 'slow · 320 ms (tło 200 ms)', 'enter', 'Tło się przyciemnia, okno podjeżdża 8 px', 'Pojawia się od razu', 'm-scrim', 80],
      ['toast', 'Powiadomienie', 'slow · 320 ms', 'enter', 'Wjeżdża 12 px z dołu', 'Pojawia się od razu', 'm-toast', 80],
      ['insert', 'Nowy blok', '4 × slow · 1280 ms', 'standard', 'Tło akcentu gaśnie, pokazuje, gdzie trafił blok', 'Krótki obrys zamiast wygaszania', 'm-new', 100],
      ['drop', 'Miejsce upuszczenia', 'fast · 120 ms', 'enter', 'Linia rośnie od środka', 'Linia od razu', 'ln', 30],
      ['dev', 'Zmiana urządzenia', 'slow · 320 ms', 'standard', 'Szerokość ramki strony (kliknij, aby przełączyć)', 'Zmiana od razu', 'm-dev', 80]
    ];
    const isKeys = ['sel', 'acc', 'panel', 'menu', 'dlg', 'toast', 'insert', 'drop', 'dev'];
    const demos = DEMOS.map(([k, title, dur, ease, what, rm, cls, w]) => {
      let c = cls;
      if (k === 'acc') c += on.acc ? ' is-open' : '';
      else if (k === 'panel') c += on.panel ? '' : ' off';
      else if (k === 'insert') c += on.insert ? ' fresh' : '';
      else c += on[k] ? ' on' : '';
      const is = {}; isKeys.forEach((x) => { is[x] = x === k; });
      return { title, dur, ease, what, rm, cls: c, w: (s.rm ? 0 : w) + '%', is, play: () => this.replay(k) };
    });
    return {
      theme: this.props.theme ?? 'light',
      rmStr: s.rm ? 'true' : 'false', toggleRm: () => this.setState({ rm: !s.rm }),
      rmCls: 'bd-rm' + (s.rm ? ' is-on' : ''), rmText: s.rm ? 'ruch ograniczony' : 'pełny ruch',
      gridCls: 'bd-motion' + (s.rm ? ' m-rm' : ''),
      playAll: () => isKeys.forEach((k) => this.replay(k)),
      demos,
      tokens: [
        { title: 'Czas', rows: [{ name: 'fast', use: 'Najechanie, menu, linia upuszczenia', val: '120 ms' }, { name: 'base', use: 'Zaznaczenie, sekcje, przełączniki', val: '200 ms' }, { name: 'slow', use: 'Panele, okna, powiadomienia', val: '320 ms' }] },
        { title: 'Krzywe', rows: [{ name: 'standard', use: 'Zmiana w miejscu', val: '0.2, 0, 0, 1' }, { name: 'enter', use: 'Coś się pojawia', val: '0, 0, 0.2, 1' }, { name: 'exit', use: 'Coś znika', val: '0.4, 0, 1, 1' }] },
        { title: 'Odległości', rows: [{ name: 'Menu', use: 'przesunięcie przy wejściu', val: '4 px' }, { name: 'Okno', use: 'przesunięcie + skala', val: '8 px · 0.98' }, { name: 'Powiadomienie', use: 'z dołu', val: '12 px' }] },
        { title: 'Zasady', rows: [{ name: 'Wyjście szybsze niż wejście', use: 'menu znika w fast, okno w base', val: '' }, { name: 'Bez ruchu przy pisaniu', use: 'pola i liczby zmieniają się od razu', val: '' }, { name: 'Kanwa nie skacze', use: 'żadnych animacji układu strony', val: '' }] }
      ]
    };
  }
}

  window.Buildr.register('motion', Component, {"theme": "light"});
})();
