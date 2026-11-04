import { createContext, type ReactNode, useState } from 'react';
import { useT } from '../../../messages/index.tsx';

/** Where the bars of the two boxes (key colour, label, unit, link) are drawn, above the diagram. */
export interface BoxBars {
  readonly margin: HTMLElement | null;
  readonly padding: HTMLElement | null;
}

/** Present inside a `BoxModel`; the ring editors portal their header into the matching slot. */
export const BoxBarsContext = createContext<BoxBars | undefined>(undefined);

/**
 * The frame of the margin-and-padding editor: a bar for each box (key colour, name, unit, link
 * toggle), then the nested boxes with the value inputs, then the hint. It owns no value; the ring
 * editors it wraps write through the same commands as any other style field.
 */
export function BoxModel({ children }: { readonly children: ReactNode }) {
  const t = useT();
  const [margin, setMargin] = useState<HTMLElement | null>(null);
  const [padding, setPadding] = useState<HTMLElement | null>(null);
  return (
    <BoxBarsContext.Provider value={{ margin, padding }}>
      <fieldset className="bd-boxmodel" aria-label={t('styleField.spacing.title')}>
        <div className="bd-boxbar" data-kind="margin" ref={setMargin} />
        <div className="bd-boxbar" data-kind="padding" ref={setPadding} />
        {children}
        <p className="bd-hint">{t('styleField.spacing.hint')}</p>
      </fieldset>
    </BoxBarsContext.Provider>
  );
}
