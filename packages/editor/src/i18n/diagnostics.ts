import type { BuilderDocument, RegistryManifest } from '@next-buildr/core';
import { interpolate, type MessageKey, type Translate } from '../messages/index.tsx';
import type { IssueItem } from '../panels/issues/collect.ts';
import { localeName } from './locale-name.ts';

type Params = Readonly<Record<string, string | number>>;
interface Match {
  /** The catalog key (`diagnostic.<id>`) of the message. */
  readonly id: string;
  readonly params?: Params;
}

const count = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * The core checks report English prose and, for the accessibility rules, no parameters; each
 * message is recognised by the rule that raised it and its fixed wording, with the values pulled
 * out of the wording. A finding that is not recognised keeps the check's own message.
 */
const A11Y: Readonly<Record<string, readonly ((message: string) => Match | undefined)[]>> = {
  'image-alt': [exact('This image has no alternative text.', 'image-alt')],
  'heading-order': [
    (message) => {
      const found = /^Heading level jumps from (\d) to (\d)\.$/.exec(message);
      return found
        ? { id: 'heading-jump', params: { from: found[1] ?? '', to: found[2] ?? '' } }
        : undefined;
    },
    exact('The page layout already renders the H1; use a lower level.', 'heading-layout-h1'),
    exact('The page has no H1 heading.', 'heading-no-h1'),
    exact('The page has more than one H1 heading.', 'heading-many-h1'),
  ],
  'empty-heading': [exact('This heading is empty.', 'empty-heading')],
  'button-name': [exact('This button has no accessible name.', 'button-name')],
  'link-name': [exact('This link has no accessible name.', 'link-name')],
  'link-href': [exact('This link does not point anywhere.', 'link-href')],
  'new-tab-link': [exact('This link opens in a new tab.', 'new-tab-link')],
  'form-label': [exact('This form field has no label.', 'form-label')],
  'form-submit': [exact('This form has no submit button.', 'form-submit')],
  'nested-interactive': [
    (message) => {
      const found = /^An interactive element cannot be inside another one \((.*)\)\.$/.exec(
        message,
      );
      return found ? { id: 'nested-interactive', params: { type: found[1] ?? '' } } : undefined;
    },
  ],
  'duplicate-anchor': [
    (message) => {
      const found = /^The anchor "(.*)" is used more than once\.$/.exec(message);
      return found ? { id: 'duplicate-anchor', params: { anchor: found[1] ?? '' } } : undefined;
    },
  ],
  'list-structure': [exact('A list can only contain list items.', 'list-structure')],
  'landmark-unique': [
    exact('A page can have only one main landmark.', 'landmark-main'),
    exact('There are several navigation landmarks; give each a name.', 'landmark-nav'),
  ],
  'accordion-structure': [exact('This accordion item has no summary.', 'accordion-structure')],
  'missing-translation': [
    (message) => {
      const found = /^"(.*)" is not translated to (.*)\.$/.exec(message);
      return found
        ? { id: 'missing-translation', params: { label: found[1] ?? '', language: found[2] ?? '' } }
        : undefined;
    },
  ],
};

function exact(english: string, id: string): (message: string) => Match | undefined {
  return (message) => (message === english ? { id } : undefined);
}

/** The fixed help sentences of the rules, by their English wording. */
const HELP: Readonly<Record<string, string>> = {
  'Describe the image, or mark it as decorative if it adds no information.': 'image-alt.help',
  'Do not skip levels; the size of a heading is a style, not its level.': 'heading-jump.help',
  'Give it a label, or an accessible name if it only shows an icon.': 'name.help',
  'Set a destination, or use a button if it triggers an action.': 'link-href.help',
  'A visually hidden notice and rel="noopener noreferrer" are added automatically.':
    'new-tab-link.help',
  'Every field needs a label; hide it visually if the design has none.': 'form-label.help',
  'Move it out, or remove one of them.': 'nested-interactive.help',
  'Set an accessible name so assistive technology can tell them apart.': 'landmark-nav.help',
  'The default-language text is shown until it is translated.': 'missing-translation.fallback',
  'Nothing is shown in this language until it is translated.': 'missing-translation.empty',
};

export interface IssueLocalizerInput {
  readonly t: Translate;
  /** The interface language. */
  readonly uiLocale: string;
  readonly doc: BuilderDocument;
  /** The manifest with its labels in the interface language. */
  readonly manifest?: RegistryManifest | undefined;
  /** The manifest in the application's own words (what a check's message quotes). */
  readonly source?: RegistryManifest | undefined;
  /** The names of the content languages the locale config gave, used when the runtime knows none. */
  readonly intl?: Readonly<Record<string, string>> | undefined;
}

/**
 * The finding with its message (and help) in the interface language, found by its code with the
 * check's own message as the fallback and the values filled in. Only the text changes: the code,
 * the node and the fix stay as the check reported them.
 */
export function localizeIssue(item: IssueItem, input: IssueLocalizerInput): IssueItem {
  const { t, doc } = input;
  const has = (id: string) => `diagnostic.${id}` as MessageKey;
  const typeLabel = (type: string) => input.manifest?.components[type]?.label ?? type;
  const nodeType = item.nodeId === undefined ? undefined : doc.nodes[item.nodeId]?.type;

  let match: Match | undefined;
  if (item.source === 'a11y') {
    for (const rule of A11Y[item.code] ?? []) {
      match = rule(item.message);
      if (match !== undefined) break;
    }
    if (match?.id === 'nested-interactive' && match.params !== undefined) {
      match = { id: match.id, params: { type: typeLabel(String(match.params['type'])) } };
    }
    if (match?.id === 'missing-translation' && match.params !== undefined) {
      const english = String(match.params['label']);
      const meta = nodeType === undefined ? undefined : input.source?.components[nodeType];
      const prop = Object.entries(meta?.props ?? {}).find(
        ([name, def]) => (def.label ?? name) === english,
      )?.[0];
      const label =
        (nodeType === undefined || prop === undefined
          ? undefined
          : input.manifest?.components[nodeType]?.props[prop]?.label) ?? english;
      const code = item.locale ?? String(match.params['language']);
      match = {
        id: match.id,
        params: { label, language: localeName(code, input.uiLocale, input.intl?.[code]) },
      };
    }
  } else if (item.source === 'validation') {
    match = fromValidation(item, typeLabel(nodeType ?? ''), nodeType);
  }

  const helpId = item.help === undefined ? undefined : HELP[item.help];
  const message =
    match === undefined ? item.message : interpolate(t(has(match.id)), match.params ?? {});
  const help = helpId === undefined || item.help === undefined ? item.help : t(has(helpId));
  return { ...item, message, ...(help === undefined ? {} : { help }) };
}

/** The structural findings of the document check carry their values in `details`, which this reads off the message's source. */
function fromValidation(
  item: IssueItem,
  label: string,
  nodeType: string | undefined,
): Match | undefined {
  const details = item.details ?? {};
  const type = text(details['type']) ?? nodeType ?? '';
  switch (item.code) {
    case 'validation.unknown-component':
      return { id: 'unknown-component', params: { type } };
    case 'validation.missing-component-version':
      return { id: 'missing-component-version', params: { type } };
    case 'validation.component-version-ahead':
    case 'validation.component-outdated': {
      const recorded = count(details['recorded']);
      const known = count(details['known']);
      if (recorded === undefined || known === undefined) return undefined;
      return { id: item.code.slice('validation.'.length), params: { type, recorded, known } };
    }
    case 'validation.unknown-slot': {
      const slot = text(details['slot']);
      return slot === undefined ? undefined : { id: 'unknown-slot', params: { type: label, slot } };
    }
    case 'validation.slot-min': {
      const slot = text(details['slot']);
      const min = count(details['min']);
      return slot === undefined || min === undefined
        ? undefined
        : { id: 'slot-min', params: { slot, min } };
    }
    case 'validation.slot-max': {
      const slot = text(details['slot']);
      const max = count(details['max']);
      return slot === undefined || max === undefined
        ? undefined
        : { id: 'slot-max', params: { slot, max } };
    }
    default:
      return undefined;
  }
}
