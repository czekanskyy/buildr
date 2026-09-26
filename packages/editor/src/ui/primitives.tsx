import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useRef, useState } from 'react';
import { useT } from '../messages/index.tsx';
import { Icon, type IconName } from './icon.tsx';
import { usePortalContainer } from './portal.tsx';

const cx = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(' ');

// --- Button ------------------------------------------------------------------------------------

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'default' | 'primary' | 'ghost' | 'danger';
  readonly ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = 'default', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button {...rest} type={type} data-variant={variant} className={cx('bd-button', className)} />
  );
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'aria-label'> {
  /** What the button does: it has no text, so this is its name for everyone who cannot see the icon. */
  readonly label: string;
  readonly icon: IconName;
  /** Shown after the name in the tooltip only (a keyboard shortcut), not part of the accessible name. */
  readonly hint?: string | undefined;
}

/** A button with an icon and a required accessible name; the name is also its tooltip. */
export function IconButton({ label, icon, hint, className, ...rest }: IconButtonProps) {
  return (
    <Tooltip content={hint === undefined ? label : `${label} (${hint})`}>
      <Button {...rest} aria-label={label} className={cx('bd-icon-button', className)}>
        <Icon name={icon} />
      </Button>
    </Tooltip>
  );
}

// --- Input -------------------------------------------------------------------------------------

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly ref?: Ref<HTMLInputElement>;
}

export function Input({ className, ...rest }: InputProps) {
  return <input {...rest} className={cx('bd-input', className)} />;
}

// --- Select ------------------------------------------------------------------------------------

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  /** The accessible name of the control. */
  readonly label: string;
  readonly disabled?: boolean;
}

export function Select({ value, onValueChange, options, label, disabled }: SelectProps) {
  const portal = usePortalContainer();
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <SelectPrimitive.Trigger className="bd-select-trigger" aria-label={label}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <Icon name="chevron-down" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={portal}>
        <SelectPrimitive.Content className="bd-select-content" position="popper" sideOffset={4}>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="bd-select-item"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// --- Tabs --------------------------------------------------------------------------------------

export interface TabItem {
  readonly value: string;
  readonly label: string;
  readonly content: ReactNode;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  /** The accessible name of the tab list. */
  readonly label: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
}

export function Tabs({ items, label, value, defaultValue, onValueChange }: TabsProps) {
  const first = items[0]?.value;
  return (
    <TabsPrimitive.Root
      {...(value !== undefined ? { value } : { defaultValue: defaultValue ?? first ?? '' })}
      {...(onValueChange !== undefined ? { onValueChange } : {})}
    >
      <TabsPrimitive.List className="bd-tabs-list" aria-label={label}>
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item.value} value={item.value} className="bd-tab">
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content key={item.value} value={item.value}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

// --- Popover -----------------------------------------------------------------------------------

export interface PopoverProps {
  /** The element that opens it; it must accept a ref and props (a `Button`). */
  readonly trigger: ReactNode;
  readonly children: ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Extra class on the floating panel (a menu-like popover drops the default padding). */
  readonly contentClassName?: string;
  readonly align?: 'start' | 'center' | 'end';
  /** The accessible name of the panel. */
  readonly label?: string;
}

export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  contentClassName,
  align,
  label,
}: PopoverProps) {
  const portal = usePortalContainer();
  return (
    <PopoverPrimitive.Root
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange !== undefined ? { onOpenChange } : {})}
    >
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={portal}>
        <PopoverPrimitive.Content
          className={cx('bd-popover', contentClassName)}
          sideOffset={6}
          {...(align !== undefined ? { align } : {})}
          {...(label !== undefined ? { 'aria-label': label } : {})}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// --- Dialog ------------------------------------------------------------------------------------

export interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  /** The body: it scrolls when it is taller than the dialog; the header and footer stay put. */
  readonly children?: ReactNode;
  /** Actions, right-aligned under the body. */
  readonly footer?: ReactNode;
  /** Omits the close button, for a dialog that can only be left by choosing (a conflict). */
  readonly hideClose?: boolean;
}

/** A modal: header (title, description, close icon button), scrollable body, right-aligned footer. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  hideClose,
}: DialogProps) {
  const t = useT();
  const portal = usePortalContainer();
  // The dialogs are controlled (opened from a toolbar button, a menu item or a shortcut), so Radix has
  // no trigger to return focus to: remember the element that had focus when the dialog opened.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={portal}>
        <DialogPrimitive.Overlay className="bd-dialog-overlay" />
        <DialogPrimitive.Content
          className="bd-dialog"
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            opener.current = active instanceof HTMLElement ? active : null;
          }}
          onCloseAutoFocus={(event) => {
            const target = opener.current;
            opener.current = null;
            if (target?.isConnected === true) {
              event.preventDefault();
              target.focus();
            }
          }}
          {...(description === undefined ? { 'aria-describedby': undefined } : {})}
        >
          <header className="bd-dialog-header">
            <div className="bd-dialog-heading">
              <DialogPrimitive.Title className="bd-dialog-title">{title}</DialogPrimitive.Title>
              {description !== undefined && (
                <DialogPrimitive.Description className="bd-dialog-description">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            {hideClose === true ? null : (
              <DialogPrimitive.Close asChild>
                {/* No tooltip here: the button takes the initial focus, and a tooltip opened by that focus would swallow the first Escape. */}
                <Button variant="ghost" className="bd-icon-button" aria-label={t('ui.close')}>
                  <Icon name="x" />
                </Button>
              </DialogPrimitive.Close>
            )}
          </header>
          {children !== undefined && <div className="bd-dialog-body">{children}</div>}
          {footer !== undefined && <footer className="bd-dialog-footer">{footer}</footer>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// --- Tooltip -----------------------------------------------------------------------------------

export interface TooltipProps {
  readonly content: string;
  readonly children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const portal = usePortalContainer();
  return (
    <TooltipPrimitive.Provider delayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={portal}>
          <TooltipPrimitive.Content className="bd-tooltip" sideOffset={6}>
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// --- Toggle ------------------------------------------------------------------------------------

export interface ToggleProps {
  readonly pressed: boolean;
  readonly onPressedChange: (pressed: boolean) => void;
  readonly children: ReactNode;
  /** Required when the toggle shows only an icon. */
  readonly label?: string;
  readonly disabled?: boolean;
}

export function Toggle({ pressed, onPressedChange, children, label, disabled }: ToggleProps) {
  return (
    <TogglePrimitive.Root
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="bd-toggle"
      {...(label !== undefined ? { 'aria-label': label } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      {children}
    </TogglePrimitive.Root>
  );
}

// --- ContextMenu -------------------------------------------------------------------------------

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
}

export interface ContextMenuProps {
  /** The area the menu opens on (right click, the menu key, Shift+F10). */
  readonly children: ReactNode;
  readonly items: readonly MenuItem[];
  readonly label: string;
}

export function ContextMenu({ children, items, label }: ContextMenuProps) {
  const portal = usePortalContainer();
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{children}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal container={portal}>
        <ContextMenuPrimitive.Content className="bd-menu bd-portal" aria-label={label}>
          {items.map((item) => (
            <ContextMenuPrimitive.Item
              key={item.id}
              className="bd-menu-item"
              disabled={item.disabled ?? false}
              data-danger={item.danger === true ? '' : undefined}
              onSelect={item.onSelect}
            >
              {item.label}
            </ContextMenuPrimitive.Item>
          ))}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
}

// --- SegmentedControl ----------------------------------------------------------------------------

export interface SegmentOption {
  readonly value: string;
  /** Text of the segment; with an `icon` and `iconOnly` it is only the accessible name and tooltip. */
  readonly label: string;
  readonly icon?: IconName;
  readonly iconOnly?: boolean;
}

export interface SegmentedControlProps {
  readonly options: readonly SegmentOption[];
  /** The pressed segment (`undefined`: none). */
  readonly value: string | undefined;
  /** Called with the segment that was pressed, also when it is the one already pressed. */
  readonly onValueChange: (value: string) => void;
  /** The accessible name of the group. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * A row of mutually exclusive toggle buttons (`aria-pressed`) for a short list of choices: value
 * modes, direction, alignment. Icon-only segments take their name and tooltip from `label`.
 */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  label,
  disabled,
  className,
}: SegmentedControlProps) {
  return (
    <fieldset aria-label={label} className={cx('bd-segmented', className)}>
      {options.map((option) => {
        const button = (
          <Button
            key={option.value}
            variant="ghost"
            className="bd-segment"
            aria-pressed={value === option.value}
            disabled={disabled === true}
            {...(option.iconOnly === true ? { 'aria-label': option.label } : {})}
            onClick={() => onValueChange(option.value)}
          >
            {option.icon !== undefined ? <Icon name={option.icon} /> : null}
            {option.iconOnly === true ? null : option.label}
          </Button>
        );
        return option.iconOnly === true ? (
          <Tooltip key={option.value} content={option.label}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </fieldset>
  );
}

// --- NumberUnitInput -----------------------------------------------------------------------------

const NUMBER_WITH_UNIT = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/;
/** What is typed on the way to a number: digits, a sign, a lone dot ("1.", "-", ".5"). */
const NUMBER_DRAFT = /^-?(?:\d+\.?\d*|\.\d*)?$/;

/** Adds `delta` to a `12px` / `0.5` / `1.5rem` text; `undefined` when the text is not that. */
export function stepNumberText(
  text: string,
  delta: number,
  defaultUnit: string,
): string | undefined {
  const typed = text.trim();
  const match = typed === '' ? null : NUMBER_WITH_UNIT.exec(typed);
  if (typed !== '' && match === null) return undefined;
  const unit = match?.[2] || defaultUnit;
  const next = Math.round((Number(match?.[1] ?? 0) + delta) * 1e4) / 1e4;
  return `${next === 0 ? 0 : next}${unit}`;
}

export interface NumberUnitInputProps {
  readonly id?: string;
  /** What is stored: `12px`, `0.5`, a token or a keyword. */
  readonly value: string;
  readonly onValueChange: (text: string) => void;
  /** The units the grammar allows; empty for a bare number. Nothing else is offered. */
  readonly units: readonly string[];
  /** Accessible name of the unit menu. */
  readonly unitLabel: string;
  /** How much an arrow key adds (Shift: x10, Alt: /10). */
  readonly step?: number;
  /** The grammar takes a bare number as well as a length: the menu then also offers "no unit". */
  readonly bareNumber?: boolean;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
  readonly describedBy?: string | undefined;
  /** The accessible name, when no `<label>` points at the field. */
  readonly ariaLabel?: string | undefined;
  readonly list?: string | undefined;
  readonly placeholder?: string | undefined;
  /** A narrow field for a row of several (the sides of a box). */
  readonly compact?: boolean;
  /** The unit shown while nothing is typed: a row's shared unit. */
  readonly unit?: string | undefined;
  /** Leaves the unit menu out: the unit is chosen elsewhere (`unit`). */
  readonly hideUnitMenu?: boolean;
  readonly onBlur?: () => void;
  readonly onFocus?: () => void;
}

/** The label of the "no unit" entry of the menu. */
const NO_UNIT = '—';

/**
 * A field for a number with a unit chosen from a menu: the field holds only the number, the menu
 * the unit, so nobody has to type `px`. Typing digits keeps the unit shown; typing a keyword or a
 * token (`auto`, `$space.4`) switches to text and disables the menu until the field is emptied;
 * typing a whole length (`1.5rem`) still works. ArrowUp/ArrowDown step the number (Shift x10, Alt
 * /10). It only produces text; the caller checks it against the grammar before anything is stored,
 * so it cannot make a value the grammar refuses representable.
 */
export function NumberUnitInput({
  id,
  value,
  onValueChange,
  units,
  unitLabel,
  step = 1,
  bareNumber,
  disabled,
  invalid,
  describedBy,
  ariaLabel,
  list,
  placeholder,
  compact,
  unit: sharedUnit,
  hideUnitMenu,
  onBlur,
  onFocus,
}: NumberUnitInputProps) {
  const typed = value.trim();
  const match = typed === '' ? null : NUMBER_WITH_UNIT.exec(typed);
  const isText = typed !== '' && match === null;
  const defaultUnit = bareNumber === true ? '' : (units[0] ?? '');
  const [pending, setPending] = useState<string | undefined>(undefined);
  // The unit shown: the one in the value, else the one picked while the field was empty.
  const unit = match !== null ? (match[2] ?? '') : (pending ?? sharedUnit ?? defaultUnit);
  const options = [
    ...(bareNumber === true ? [''] : []),
    ...units,
    ...(unit !== '' && !units.includes(unit) ? [unit] : []),
  ];
  const shown = match !== null ? match[1] : isText ? value : '';

  const pickUnit = (next: string) => {
    setPending(next);
    if (match !== null) onValueChange(`${match[1]}${next}`);
  };

  const change = (text: string) => {
    if (units.length > 0 && text !== '' && NUMBER_DRAFT.test(text)) {
      onValueChange(`${text}${text === '-' ? '' : unit}`);
    } else {
      onValueChange(text);
    }
  };

  return (
    <div
      className={cx('bd-number-unit', compact === true && 'bd-number-unit-compact')}
      data-invalid={invalid === true ? '' : undefined}
    >
      <Input
        {...(id !== undefined ? { id } : {})}
        value={shown}
        disabled={disabled === true}
        list={list}
        placeholder={placeholder}
        inputMode={isText ? 'text' : 'decimal'}
        aria-invalid={invalid === true}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => change(event.target.value)}
        {...(onBlur !== undefined ? { onBlur } : {})}
        {...(onFocus !== undefined ? { onFocus } : {})}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          const size = event.shiftKey ? step * 10 : event.altKey ? step / 10 : step;
          const next = stepNumberText(typed, event.key === 'ArrowUp' ? size : -size, unit);
          if (next === undefined) return;
          event.preventDefault();
          onValueChange(next);
        }}
      />
      {units.length > 0 && hideUnitMenu !== true ? (
        <select
          className="bd-unit-select"
          aria-label={unitLabel}
          value={unit}
          disabled={disabled === true || isText}
          onChange={(event) => pickUnit(event.target.value)}
        >
          {options.map((entry) => (
            <option key={entry} value={entry}>
              {entry === '' ? NO_UNIT : entry}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

// --- ColorSwatch ---------------------------------------------------------------------------------

/** Colour notations a theme token may hold; anything else is not painted (no raw CSS from data). */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch|oklab|lab|lch)a?\([0-9a-z%.,\s/+-]*\))$/i;

export interface ColorSwatchProps {
  /** A colour value from the theme; an unknown notation or `undefined` shows an empty swatch. */
  readonly color: string | undefined;
  readonly className?: string;
}

/** A small decorative square filled with a colour. */
export function ColorSwatch({ color, className }: ColorSwatchProps) {
  const safe = color !== undefined && SAFE_COLOR.test(color.trim());
  return (
    <span
      aria-hidden="true"
      className={cx('bd-swatch', className)}
      data-empty={safe ? undefined : ''}
      {...(safe ? { style: { backgroundColor: color.trim() } } : {})}
    />
  );
}

// --- ColorInput ----------------------------------------------------------------------------------

/** `#abc` and `#aabbcc` as the `#rrggbb` a colour input takes; `undefined` for any other notation. */
export function hexOf(color: string | undefined): string | undefined {
  const text = color?.trim().toLowerCase() ?? '';
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short === null) return undefined;
  return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
}

export interface ColorInputProps {
  /** The colour being edited, as the theme or the author wrote it; only the swatch paints it. */
  readonly color: string | undefined;
  /** Accessible name of the picker. */
  readonly label: string;
  readonly disabled?: boolean;
  /** Called with a `#rrggbb` colour the browser's own picker chose. */
  readonly onColorChange: (hex: string) => void;
}

/**
 * The colour swatch as a button that opens the browser's colour picker. The native input sits
 * invisibly over the swatch, so it keeps the platform's keyboard and screen-reader behaviour; what
 * it returns is a hex colour, which the caller still checks against the grammar.
 */
export function ColorInput({ color, label, disabled, onColorChange }: ColorInputProps) {
  return (
    <span className="bd-color-input">
      <ColorSwatch color={color} />
      <input
        type="color"
        className="bd-color-native"
        aria-label={label}
        value={hexOf(color) ?? '#000000'}
        disabled={disabled === true}
        onChange={(event) => onColorChange(event.target.value)}
      />
    </span>
  );
}
