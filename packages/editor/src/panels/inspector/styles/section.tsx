import { type ReactNode, useEffect, useId, useSyncExternalStore } from 'react';
import { interpolate, usePlural, useT } from '../../../messages/index.tsx';
import type { IconName } from '../../../ui/icon.tsx';
import { Icon } from '../../../ui/index.ts';
import { Highlight } from './property-label.tsx';
import { rememberedSections, setSectionOpen, subscribeSections } from './section-state.ts';
import { useSectionRegistry } from './sections-context.tsx';

const sectionIcons: Readonly<Record<string, IconName>> = {
  layout: 'layout-grid',
  size: 'stretch-vertical',
  spacing: 'box',
  typography: 'type',
  colors: 'droplet',
  background: 'image',
  border: 'braces',
  effects: 'sigma',
  shadow: 'copy',
  visibility: 'eye',
  motion: 'sparkles',
};

const deviceIcon = (layer: string): IconName =>
  layer === 'mobile' ? 'smartphone' : layer === 'tablet' ? 'tablet' : 'monitor-smartphone';

/**
 * One collapsible section of the Style tab: lead icon, title, a chip counting the values that
 * exist only at the breakpoint being edited, a dot while the section holds any value, and a chevron
 * on the right. Open/closed is a preference kept outside the document (see `section-state.ts`).
 */
export function StyleSection(props: {
  readonly name: string;
  readonly label: string;
  readonly defaultOpen: boolean;
  readonly searching: boolean;
  readonly modified: boolean;
  readonly override: boolean;
  /** How many values exist only at the breakpoint being edited (the chip shows above 0). */
  readonly overrideCount?: number;
  /** The breakpoint being edited, for the chip's name and icon. */
  readonly layer?: string;
  /** The search text, highlighted in the title. */
  readonly query?: string;
  /** "Reset section": the footer shows while this is given. */
  readonly onReset?: (() => void) | undefined;
  readonly resetDisabled?: boolean;
  readonly children: ReactNode;
}) {
  const t = useT();
  const plural = usePlural();
  const id = useId();
  const stored = useSyncExternalStore(subscribeSections, rememberedSections, rememberedSections);
  const open = stored[props.name] ?? props.defaultOpen;
  const expanded = props.searching || open;
  const registry = useSectionRegistry();
  useEffect(() => registry.report(props.name, open), [registry, props.name, open]);
  const count = props.overrideCount ?? (props.override ? 1 : 0);
  const layer = props.layer ?? '';
  const device =
    layer === 'tablet' || layer === 'mobile'
      ? t(`inspector.device.${layer}` as 'inspector.device.tablet')
      : layer;
  const chipLabel = interpolate(plural('inspector.overrides', count), { device });
  return (
    <section className="bd-sec" data-group={props.name} data-override={props.override}>
      <h4 className="bd-sec__title">
        <button
          type="button"
          className="bd-sec__head"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setSectionOpen(props.name, !open)}
        >
          <Icon name={sectionIcons[props.name] ?? 'braces'} className="lead" />
          <span>
            <Highlight text={props.label} query={props.query} />
          </span>
          {count > 0 ? (
            <span className="bd-ovr" role="img" aria-label={chipLabel}>
              <Icon name={deviceIcon(layer)} />
              {count}
            </span>
          ) : null}
          {props.modified ? (
            <span className="bd-mod-dot" role="img" aria-label={t('inspector.tab.changed')} />
          ) : null}
          <Icon name="chevron-right" className="chev" />
        </button>
      </h4>
      <div id={id} className={`bd-sec__body${expanded ? ' is-open' : ''}`}>
        <div className="bd-sec__inner" inert={!expanded}>
          <div className="bd-sec__content">
            {props.children}
            {props.onReset !== undefined ? (
              <div className="bd-sec__foot">
                <button
                  type="button"
                  className="bd-textbtn"
                  disabled={props.resetDisabled === true}
                  onClick={props.onReset}
                >
                  <Icon name="rotate-ccw" />
                  {t('inspector.resetSection')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
