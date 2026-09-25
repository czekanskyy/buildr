import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useT } from '../messages/index.tsx';
import { Icon, type IconName } from './icon.tsx';

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
      <SelectPrimitive.Portal>
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
}

export function Popover({ trigger, children, open, onOpenChange }: PopoverProps) {
  return (
    <PopoverPrimitive.Root
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange !== undefined ? { onOpenChange } : {})}
    >
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="bd-popover" sideOffset={6}>
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
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bd-dialog-overlay" />
        <DialogPrimitive.Content
          className="bd-dialog"
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
  return (
    <TooltipPrimitive.Provider delayDuration={400}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
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
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>{children}</ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
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
