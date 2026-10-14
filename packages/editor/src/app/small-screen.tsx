import { useCallback, useSyncExternalStore } from 'react';
import { useT } from '../messages/index.tsx';
import { BrandMark } from '../toolbar/brand.tsx';
import { Icon } from '../ui/index.ts';

const unknownViewport = (): undefined => undefined;

/**
 * Whether the window is narrower than `minWidth` CSS pixels, kept current as it is resized or
 * rotated. `0` (or less) never is; without `matchMedia` (a test) the window is taken as wide enough.
 *
 * `undefined` means "not known yet": the server has no window, and a hydrating client must render
 * what the server rendered, so both start unknown and the client resolves it right after hydration
 * (a plain client render resolves it at once). Callers render a neutral state meanwhile.
 */
export function useViewportTooNarrow(minWidth: number): boolean | undefined {
  const query = `(max-width: ${Math.max(minWidth, 1) - 1}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (minWidth <= 0 || typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query, minWidth],
  );
  const getSnapshot = useCallback(
    () =>
      minWidth > 0 && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false,
    [query, minWidth],
  );
  return useSyncExternalStore<boolean | undefined>(subscribe, getSnapshot, unknownViewport);
}

/** Shown instead of the editor in a window too small to edit in (docs/editor.md#small-screens). */
export function SmallScreenNotice() {
  const t = useT();
  return (
    <main className="bd-small-screen" role="alert" aria-labelledby="bd-small-screen-title">
      <div className="bd-small-screen-card">
        <BrandMark size={32} />
        <span className="bd-small-screen-icon">
          <Icon name="monitor" size="md" />
        </span>
        <h1 id="bd-small-screen-title" className="bd-small-screen-title">
          {t('app.smallScreen.title')}
        </h1>
        <p className="bd-small-screen-body">{t('app.smallScreen.body')}</p>
        <p className="bd-small-screen-hint">{t('app.smallScreen.hint')}</p>
      </div>
    </main>
  );
}
