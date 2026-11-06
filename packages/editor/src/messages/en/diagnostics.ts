/** What the checks report, by code (`i18n/diagnostics.ts`); the English text is the checks' own. */
export const diagnostics = {
  'diagnostic.image-alt': 'This image has no alternative text.',
  'diagnostic.image-alt.help':
    'Describe the image, or mark it as decorative if it adds no information.',
  'diagnostic.heading-jump': 'Heading level jumps from {from} to {to}.',
  'diagnostic.heading-jump.help':
    'Do not skip levels; the size of a heading is a style, not its level.',
  'diagnostic.heading-layout-h1': 'The page layout already renders the H1; use a lower level.',
  'diagnostic.heading-no-h1': 'The page has no H1 heading.',
  'diagnostic.heading-many-h1': 'The page has more than one H1 heading.',
  'diagnostic.empty-heading': 'This heading is empty.',
  'diagnostic.button-name': 'This button has no accessible name.',
  'diagnostic.link-name': 'This link has no accessible name.',
  'diagnostic.name.help': 'Give it a label, or an accessible name if it only shows an icon.',
  'diagnostic.link-href': 'This link does not point anywhere.',
  'diagnostic.link-href.help': 'Set a destination, or use a button if it triggers an action.',
  'diagnostic.new-tab-link': 'This link opens in a new tab.',
  'diagnostic.new-tab-link.help':
    'A visually hidden notice and rel="noopener noreferrer" are added automatically.',
  'diagnostic.form-label': 'This form field has no label.',
  'diagnostic.form-label.help':
    'Every field needs a label; hide it visually if the design has none.',
  'diagnostic.form-submit': 'This form has no submit button.',
  'diagnostic.nested-interactive': 'An interactive element cannot be inside another one ({type}).',
  'diagnostic.nested-interactive.help': 'Move it out, or remove one of them.',
  'diagnostic.duplicate-anchor': 'The anchor "{anchor}" is used more than once.',
  'diagnostic.list-structure': 'A list can only contain list items.',
  'diagnostic.landmark-main': 'A page can have only one main landmark.',
  'diagnostic.landmark-nav': 'There are several navigation landmarks; give each a name.',
  'diagnostic.landmark-nav.help':
    'Set an accessible name so assistive technology can tell them apart.',
  'diagnostic.accordion-structure': 'This accordion item has no summary.',
  'diagnostic.missing-translation': '"{label}" is not translated to {language}.',
  'diagnostic.missing-translation.fallback':
    'The default-language text is shown until it is translated.',
  'diagnostic.missing-translation.empty':
    'Nothing is shown in this language until it is translated.',
  'diagnostic.unknown-component': '"{type}" is not a registered component.',
  'diagnostic.missing-component-version': 'The document does not record a version for "{type}".',
  'diagnostic.component-version-ahead':
    '"{type}" is version {recorded} in the document but this application only knows version {known}.',
  'diagnostic.component-outdated':
    '"{type}" is version {recorded} in the document; the current version is {known}.',
  'diagnostic.unknown-slot': '{type} has no "{slot}" slot.',
  'diagnostic.slot-min': '"{slot}" needs at least {min} item(s).',
  'diagnostic.slot-max': '"{slot}" takes at most {max} item(s).',
} as const;
