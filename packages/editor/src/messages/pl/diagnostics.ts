export const diagnostics = {
  'diagnostic.image-alt': 'Ten obraz nie ma tekstu alternatywnego.',
  'diagnostic.image-alt.help':
    'Opisz obraz albo oznacz go jako dekoracyjny, jeśli nie niesie informacji.',
  'diagnostic.heading-jump': 'Poziom nagłówka przeskakuje z {from} na {to}.',
  'diagnostic.heading-jump.help':
    'Nie pomijaj poziomów; wielkość nagłówka to kwestia stylu, a nie poziomu.',
  'diagnostic.heading-layout-h1': 'Układ strony już wyświetla nagłówek H1; użyj niższego poziomu.',
  'diagnostic.heading-no-h1': 'Strona nie ma nagłówka H1.',
  'diagnostic.heading-many-h1': 'Strona ma więcej niż jeden nagłówek H1.',
  'diagnostic.empty-heading': 'Ten nagłówek jest pusty.',
  'diagnostic.button-name': 'Ten przycisk nie ma nazwy dostępnej.',
  'diagnostic.link-name': 'Ten link nie ma nazwy dostępnej.',
  'diagnostic.name.help': 'Nadaj mu etykietę albo nazwę dostępną, jeśli pokazuje tylko ikonę.',
  'diagnostic.link-href': 'Ten link nie prowadzi nigdzie.',
  'diagnostic.link-href.help': 'Ustaw adres docelowy albo użyj przycisku, jeśli uruchamia akcję.',
  'diagnostic.new-tab-link': 'Ten link otwiera się w nowej karcie.',
  'diagnostic.new-tab-link.help':
    'Wizualnie ukryta informacja i rel="noopener noreferrer" są dodawane automatycznie.',
  'diagnostic.form-label': 'To pole formularza nie ma etykiety.',
  'diagnostic.form-label.help':
    'Każde pole potrzebuje etykiety; ukryj ją wizualnie, jeśli projekt jej nie ma.',
  'diagnostic.form-submit': 'Ten formularz nie ma przycisku wysyłania.',
  'diagnostic.nested-interactive':
    'Element interaktywny nie może znajdować się wewnątrz innego ({type}).',
  'diagnostic.nested-interactive.help': 'Wyjmij go na zewnątrz albo usuń jeden z nich.',
  'diagnostic.duplicate-anchor': 'Kotwica „{anchor}” jest użyta więcej niż raz.',
  'diagnostic.list-structure': 'Lista może zawierać tylko elementy listy.',
  'diagnostic.landmark-main': 'Strona może mieć tylko jeden obszar treści głównej.',
  'diagnostic.landmark-nav': 'Jest kilka obszarów nawigacji; nadaj każdemu nazwę.',
  'diagnostic.landmark-nav.help':
    'Ustaw nazwę dostępną, aby technologie asystujące mogły je odróżnić.',
  'diagnostic.accordion-structure': 'Ten element akordeonu nie ma podsumowania.',
  'diagnostic.missing-translation': 'Pole „{label}” nie jest przetłumaczone na język: {language}.',
  'diagnostic.missing-translation.fallback':
    'Do czasu tłumaczenia widoczny jest tekst w języku domyślnym.',
  'diagnostic.missing-translation.empty':
    'W tym języku nic nie jest widoczne, dopóki tekst nie zostanie przetłumaczony.',
  'diagnostic.unknown-component': '„{type}” nie jest zarejestrowanym komponentem.',
  'diagnostic.missing-component-version': 'Dokument nie zapisuje wersji komponentu „{type}”.',
  'diagnostic.component-version-ahead':
    'Komponent „{type}” ma w dokumencie wersję {recorded}, a ta aplikacja zna tylko wersję {known}.',
  'diagnostic.component-outdated':
    'Komponent „{type}” ma w dokumencie wersję {recorded}; aktualna wersja to {known}.',
  'diagnostic.unknown-slot': 'Komponent {type} nie ma miejsca „{slot}”.',
  'diagnostic.slot-min': 'Miejsce „{slot}”: minimalna liczba elementów to {min}.',
  'diagnostic.slot-max': 'Miejsce „{slot}”: maksymalna liczba elementów to {max}.',
} as const;
