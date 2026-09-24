/** A key press as the editor sees it, from the DOM or forwarded by the canvas (`key:down`). */
export interface KeyInput {
  readonly key: string;
  readonly mods: {
    readonly shift: boolean;
    readonly alt: boolean;
    readonly ctrl: boolean;
    readonly meta: boolean;
  };
}

/** Which key is the "primary" one: Cmd on a Mac, Ctrl elsewhere. */
export type Platform = 'mac' | 'other';

export function detectPlatform(
  navigatorLike:
    | { readonly platform?: string; readonly userAgent?: string }
    | undefined = typeof navigator === 'undefined' ? undefined : navigator,
): Platform {
  const text = `${navigatorLike?.platform ?? ''} ${navigatorLike?.userAgent ?? ''}`;
  return /mac|iphone|ipad/i.test(text) ? 'mac' : 'other';
}

const KEY_ALIASES: Readonly<Record<string, string>> = {
  ' ': 'space',
  esc: 'escape',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
};

const MODIFIER_ORDER = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const;

/**
 * The canonical text of a combination: modifiers in a fixed order (`mod` is Cmd on a Mac and Ctrl
 * elsewhere), then the key, all lower case — `mod+shift+z`, `alt+arrowup`, `delete`. Two spellings
 * of one combination give the same text, so a lookup is a plain string comparison.
 */
export function normalizeCombo(spec: string): string {
  const parts = spec
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  // "shift++" style specs are not supported; a "+" key is written "plus".
  const key = parts.pop() ?? '';
  const mods = MODIFIER_ORDER.filter((mod) => parts.includes(mod));
  return [...mods, KEY_ALIASES[key] ?? key].join('+');
}

/** The canonical combination of a key press on `platform`. */
export function comboOf(input: KeyInput, platform: Platform): string {
  const primary = platform === 'mac' ? input.mods.meta : input.mods.ctrl;
  const other = platform === 'mac' ? input.mods.ctrl : input.mods.meta;
  const parts: string[] = [];
  if (primary) parts.push('mod');
  if (other) parts.push(platform === 'mac' ? 'ctrl' : 'meta');
  if (input.mods.alt) parts.push('alt');
  if (input.mods.shift) parts.push('shift');
  const key = input.key.toLowerCase();
  parts.push(KEY_ALIASES[key] ?? key);
  return parts.join('+');
}

const SYMBOLS_MAC: Readonly<Record<string, string>> = {
  mod: '⌘',
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  meta: '⌘',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  delete: '⌫',
  backspace: '⌫',
  escape: 'Esc',
};

const WORDS: Readonly<Record<string, string>> = {
  mod: 'Ctrl',
  ctrl: 'Ctrl',
  meta: 'Meta',
  alt: 'Alt',
  shift: 'Shift',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  delete: 'Del',
  backspace: 'Backspace',
  escape: 'Esc',
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** How a combination is shown to the author on `platform` (`⌘⇧Z`, `Ctrl+Shift+Z`). */
export function displayCombo(combo: string, platform: Platform): string {
  const parts = combo.split('+');
  if (platform === 'mac') {
    return parts.map((part) => SYMBOLS_MAC[part] ?? part.toUpperCase()).join('');
  }
  return parts.map((part) => WORDS[part] ?? capital(part)).join('+');
}

/** The keyboard belongs to text here: a field, a select or an editable region. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as {
    readonly tagName?: string;
    readonly isContentEditable?: boolean;
    readonly closest?: (selector: string) => unknown;
  } | null;
  if (element === null || typeof element.tagName !== 'string') return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (element as { type?: string }).type ?? 'text';
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
  }
  if (tag === 'textarea' || tag === 'select') return true;
  if (element.isContentEditable === true) return true;
  return element.closest?.('[contenteditable="true"], [role="textbox"]') != null;
}
