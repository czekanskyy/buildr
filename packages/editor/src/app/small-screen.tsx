import { useEffect, useState } from 'react';
import { useT } from '../messages/index.tsx';
import { BrandMark } from '../toolbar/brand.tsx';
import { Icon } from '../ui/index.ts';

/**
 * Whether the window is narrower than `minWidth` CSS pixels, kept current as it is resized or
 * rotated. `0` (or less) never is; without `matchMedia` (a test, a server) the window is taken as wide enough.
 */
export function useViewportTooNarrow(minWidth: number): boolean {
  const query = `(max-width: ${Math.max(minWidth, 1) - 1}px)`;
  const read = () =>
    minWidth > 0 && typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    if (minWidth <= 0 || typeof window.matchMedia !== 'function') {
      setNarrow(false);
      return;
    }
    const list = window.matchMedia(query);
    const update = () => setNarrow(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query, minWidth]);
  return narrow;
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
