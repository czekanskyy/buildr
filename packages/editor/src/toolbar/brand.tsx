import { useT } from '../messages/index.tsx';

/** The Buildr mark: a rounded tile holding three stacked blocks. Decorative, the name is beside it. */
export function BrandMark({ size = 24 }: { readonly size?: number }) {
  return (
    <svg
      className="bd-brand-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="bd-brand-tile" width="24" height="24" rx="6" />
      <rect className="bd-brand-block" x="5" y="5" width="6" height="6" rx="1.5" />
      <rect className="bd-brand-block" x="13" y="5" width="6" height="6" rx="1.5" />
      <rect className="bd-brand-block" x="5" y="13" width="14" height="6" rx="1.5" />
    </svg>
  );
}

/** The product identity in the top left corner: the mark and the name. */
export function Brand() {
  const t = useT();
  return (
    <span className="bd-brand">
      <BrandMark />
      <span className="bd-brand-name">{t('toolbar.brand')}</span>
    </span>
  );
}
