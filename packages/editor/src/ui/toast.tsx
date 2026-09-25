import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useT } from '../messages/index.tsx';
import { Icon, type IconName } from './icon.tsx';
import { Button, IconButton } from './primitives.tsx';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  readonly message: string;
  /** Secondary text shown after the message, in a muted colour. */
  readonly detail?: string | undefined;
  readonly variant?: ToastVariant | undefined;
  /**
   * Showing a toast with the id of a visible one replaces it (and restarts its timer), so a
   * repeated notice does not pile up.
   */
  readonly id?: string | undefined;
  /** Milliseconds until it goes away; `null` keeps it until dismissed. Default: `TOAST_MS`. */
  readonly duration?: number | null | undefined;
  /** One optional action, rendered as a button (the toast stays until it is dismissed or the timer ends). */
  readonly action?: { readonly label: string; readonly onSelect: () => void } | undefined;
}

export interface ToastApi {
  /** Shows a toast; returns its id. */
  readonly show: (options: ToastOptions) => string;
  readonly dismiss: (id: string) => void;
}

/** How long a toast stays on screen by default. */
export const TOAST_MS = 6000;

interface Entry extends ToastOptions {
  readonly id: string;
  readonly variant: ToastVariant;
  /** Bumped by every `show`, so a replaced toast restarts its timer. */
  readonly serial: number;
}

const ICONS: Readonly<Record<ToastVariant, IconName>> = {
  success: 'circle-check',
  info: 'info',
  warning: 'triangle-alert',
  error: 'circle-alert',
};

const ToastContext = createContext<ToastApi | undefined>(undefined);

/** Shows short, non-blocking messages in the one toast region. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === undefined) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

/**
 * Mount once, above everything that reports. It renders the single toast region of the editor: a
 * polite `role="status"` list for success, info and warning, and a `role="alert"` list for errors
 * (both always mounted, so screen readers announce what is added). It is the only place in the
 * editor that positions a message with `position: fixed`.
 */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);
  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const serial = counter.current;
    const id = options.id ?? `toast-${serial}`;
    const entry: Entry = { ...options, id, variant: options.variant ?? 'info', serial };
    setEntries((current) => [...current.filter((other) => other.id !== id), entry]);
    return id;
  }, []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  const list = (errors: boolean) =>
    entries
      .filter((entry) => (entry.variant === 'error') === errors)
      .map((entry) => <ToastItem key={entry.id} entry={entry} onDismiss={dismiss} />);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="bd-toast-region">
        <div className="bd-toast-list" role="status" aria-live="polite">
          {list(false)}
        </div>
        <div className="bd-toast-list" role="alert">
          {list(true)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  entry,
  onDismiss,
}: {
  readonly entry: Entry;
  readonly onDismiss: (id: string) => void;
}) {
  const t = useT();
  const { id, serial, variant, action } = entry;
  const duration = entry.duration === undefined ? TOAST_MS : entry.duration;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  // A replacement (a new serial) starts the countdown again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: serial is the restart trigger
  useEffect(() => {
    remaining.current = duration;
  }, [serial, duration]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: serial is the restart trigger
  useEffect(() => {
    if (paused || remaining.current === null) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      if (remaining.current !== null) {
        remaining.current = Math.max(0, remaining.current - (Date.now() - started));
      }
    };
  }, [paused, id, serial, onDismiss]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover and focus only pause the timer
    <div
      className="bd-toast"
      data-variant={variant}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <Icon name={ICONS[variant]} className="bd-toast-icon" />
      <span className="bd-toast-text">
        {entry.message}
        {entry.detail !== undefined && <span className="bd-toast-detail"> {entry.detail}</span>}
      </span>
      {action !== undefined && (
        <Button className="bd-toast-action" onClick={action.onSelect}>
          {action.label}
        </Button>
      )}
      <IconButton
        label={t('toast.dismiss')}
        icon="x"
        className="bd-toast-close"
        onClick={() => onDismiss(id)}
      />
    </div>
  );
}
