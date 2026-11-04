import { useT } from '../messages/index.tsx';

/** The Buildr mark: two overlapping blocks. Decorative, the name is beside it. */
export function BrandMark({ size = 22 }: { readonly size?: number }) {
  return (
    <svg
      className="bd-brand-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="bd-brand-back" x="2" y="11" width="13" height="11" rx="3" />
      <rect className="bd-brand-front" x="9" y="2" width="13" height="13" rx="3" />
    </svg>
  );
}

/** The product identity: the mark and the name. */
export function Brand() {
  const t = useT();
  return (
    <span className="bd-brand">
      <BrandMark />
      <span className="bd-brand-name">{t('toolbar.brand')}</span>
    </span>
  );
}
