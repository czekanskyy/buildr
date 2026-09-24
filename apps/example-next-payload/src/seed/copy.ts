/**
 * The words of the seeded pages. The default language is Polish, so `pl` becomes the stored value
 * and English rides along as `l10n.en`. Keys are the English placeholder texts of the templates;
 * `en` replaces the placeholder when the page says something more specific.
 */
export interface Copy {
  readonly pl: string;
  readonly en?: string;
}

export const COPY: Readonly<Record<string, Copy>> = {
  // hero
  'A headline that says what you do': {
    pl: 'Strony, które budujesz sam, bez czekania na programistę',
    en: 'Pages you build yourself, without waiting for a developer',
  },
  'One or two sentences that tell a visitor why it matters and what to do next.': {
    pl: 'Buildr to wizualny edytor stron zapisany w Twoim CMS. Układasz sekcje, tłumaczysz treść i publikujesz jednym kliknięciem.',
    en: 'Buildr is a visual page editor that lives inside your CMS. Arrange sections, translate the content and publish in one click.',
  },
  'Get started': { pl: 'Zacznij teraz' },
  'Learn more': { pl: 'Dowiedz się więcej' },
  // feature grid
  'Everything you need': { pl: 'Wszystko, czego potrzebujesz' },
  'A short introduction to the features below.': {
    pl: 'Krótko o tym, co dostajesz od pierwszego dnia.',
    en: 'A short look at what you get from day one.',
  },
  'Fast by default': { pl: 'Szybkie od początku' },
  'Say what makes it quick, in a sentence or two.': {
    pl: 'Strony renderują się na serwerze i nie wysyłają do przeglądarki niepotrzebnego JavaScriptu.',
    en: 'Pages render on the server and ship no unnecessary JavaScript to the browser.',
  },
  'Safe to rely on': { pl: 'Bezpieczne' },
  'Say why people can trust it, in a sentence or two.': {
    pl: 'Każda zmiana przechodzi walidację, a konflikt zapisu nigdy nie nadpisuje cudzej pracy.',
    en: 'Every change is validated, and a conflicting save never overwrites anyone else’s work.',
  },
  'Easy to arrange': { pl: 'Łatwe w układaniu' },
  'Say how it fits into what they already do.': {
    pl: 'Przeciągnij sekcję, zmień kolejność, zobacz efekt na telefonie i na komputerze.',
    en: 'Drag a section, reorder it, and see the result on a phone and on a desktop.',
  },
  'Made with care': { pl: 'Dopracowane' },
  'Say what sets the details apart.': {
    pl: 'Dostępność jest sprawdzana przy każdej publikacji, nie dopiero po wdrożeniu.',
    en: 'Accessibility is checked on every publish, not after the launch.',
  },
  'Ready for everyone': { pl: 'Dla każdego języka', en: 'Ready for every language' },
  'Say who can use it and where.': {
    pl: 'Treść trzyma tłumaczenia obok oryginału, a każdy język ma własny adres.',
    en: 'Content keeps its translations next to the original, and every language gets its own address.',
  },
  'Built to last': { pl: 'Zbudowane na lata' },
  'Say what keeps it useful over time.': {
    pl: 'Dokument ma wersje i migracje, więc stare strony działają po każdej aktualizacji.',
    en: 'Documents are versioned and migrated, so old pages keep working after every update.',
  },
  // cta
  'Ready to get started?': { pl: 'Chcesz zacząć?' },
  'Tell people what happens when they click, in one short sentence.': {
    pl: 'Napisz do nas, a pokażemy Buildr na Twojej stronie.',
    en: 'Write to us and we will show you Buildr on your own site.',
  },
  'Get in touch': { pl: 'Skontaktuj się' },
  // testimonial
  '“A sentence from a customer that says what changed for them.”': {
    pl: '„Wreszcie sami zmieniamy stronę, a programiści zajmują się tym, co naprawdę trudne.”',
    en: '“At last we change the site ourselves, and the developers get on with the hard parts.”',
  },
  'Customer name': { pl: 'Anna Kowalska', en: 'Anna Kowalska' },
  'Role, Company': { pl: 'Dyrektor marketingu, Nowa Fala', en: 'Head of Marketing, Nowa Fala' },
  // pricing
  'Simple pricing': { pl: 'Prosty cennik' },
  'Pick the plan that fits. Change it any time.': {
    pl: 'Wybierz plan, który pasuje. Możesz go zmienić w każdej chwili.',
  },
  Starter: { pl: 'Start' },
  $0: { pl: '0 zł', en: '$0' },
  'per month': { pl: 'miesięcznie' },
  'One feature': { pl: 'Jedna strona', en: 'One site' },
  'Another feature': { pl: 'Podstawowe szablony', en: 'Basic templates' },
  'A third feature': { pl: 'Wsparcie społeczności', en: 'Community support' },
  Included: { pl: 'W cenie' },
  'Choose Starter': { pl: 'Wybierz Start' },
  'Most popular': { pl: 'Najczęściej wybierany' },
  Team: { pl: 'Zespół' },
  $29: { pl: '119 zł', en: '$29' },
  'Everything in Starter': { pl: 'Wszystko z planu Start' },
  'A team feature': { pl: 'Praca zespołowa', en: 'Team collaboration' },
  'Priority support': { pl: 'Priorytetowe wsparcie' },
  'Choose Team': { pl: 'Wybierz Zespół' },
  Company: { pl: 'Firma' },
  $99: { pl: '399 zł', en: '$99' },
  'Everything in Team': { pl: 'Wszystko z planu Zespół' },
  'A company feature': { pl: 'Własne komponenty', en: 'Custom components' },
  'A dedicated contact': { pl: 'Opiekun konta' },
  'Choose Company': { pl: 'Wybierz Firmę' },
  // faq
  'Frequently asked questions': { pl: 'Najczęstsze pytania' },
  'A short, direct answer.': {
    pl: 'Buildr działa wewnątrz Twojego CMS, więc dane zostają u Ciebie.',
    en: 'Buildr runs inside your CMS, so your data stays with you.',
  },
  'What is this?': { pl: 'Czym jest Buildr?', en: 'What is Buildr?' },
  'How much does it cost?': { pl: 'Ile to kosztuje?' },
  'Can I change my mind?': { pl: 'Czy mogę zrezygnować?' },
  'Who do I ask for help?': { pl: 'Kogo pytać o pomoc?' },
  // contact
  'Tell us a little about what you need and we will reply within two working days.': {
    pl: 'Napisz kilka słów o tym, czego potrzebujesz, a odpowiemy w ciągu dwóch dni roboczych.',
  },
  Name: { pl: 'Imię i nazwisko' },
  Email: { pl: 'Adres e-mail' },
  Message: { pl: 'Wiadomość' },
  'Send me a copy': { pl: 'Wyślij mi kopię' },
  'Send message': { pl: 'Wyślij wiadomość' },
  'Contact us': { pl: 'Formularz kontaktowy', en: 'Contact form' },
  // listing, post, product
  Blog: { pl: 'Blog' },
  'No posts yet.': { pl: 'Nie ma jeszcze wpisów.' },
  'About the author': { pl: 'O autorze' },
  'Buy now': { pl: 'Kup teraz' },
  Details: { pl: 'Szczegóły' },
};
