import type { EffectiveStyles } from '@next-buildr/core';
import type { ReactNode } from 'react';
import { interpolate, type MessageKey, useT } from '../../../messages/index.tsx';
import { useEditor } from '../../../store/index.ts';
import { Button } from '../../../ui/index.ts';
import { layerFor } from './model.ts';
import { optionLabel } from './option-label.ts';

/** The cubic-bezier of each easing the compiler knows (compile-motion.ts), for the curve preview. */
const CURVES: Readonly<Record<string, readonly [number, number, number, number]>> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  linear: [0, 0, 1, 1],
  snappy: [0.2, 0.8, 0.2, 1],
  bounce: [0.34, 1.56, 0.64, 1],
};

/** The ready entrance effects: what they write is only the effect and its direction. */
const PRESETS: readonly {
  readonly id: string;
  readonly label: MessageKey;
  readonly entrance: string;
  readonly direction?: string;
}[] = [
  { id: 'none', label: 'styleField.motion.preset.none', entrance: 'none' },
  { id: 'fade', label: 'styleField.motion.preset.fade', entrance: 'fade' },
  { id: 'slideUp', label: 'styleField.motion.preset.slideUp', entrance: 'slide', direction: 'up' },
  {
    id: 'slideLeft',
    label: 'styleField.motion.preset.slideLeft',
    entrance: 'slide',
    direction: 'left',
  },
  { id: 'zoom', label: 'styleField.motion.preset.zoom', entrance: 'zoom' },
];

const X = (x: number) => (4 + 56 * x).toFixed(1);
const Y = (y: number) => (60 - 56 * y).toFixed(1);

/** A small plot of the easing (time across, progress up); decorative, the name is the caption. */
function Curve({ easing }: { readonly easing: string }) {
  const t = useT();
  const bezier = CURVES[easing] ?? CURVES['ease-out'] ?? [0, 0, 0.58, 1];
  const [a, b, c, d] = bezier;
  return (
    <figure className="bd-motion-curve">
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path className="bd-motion-curve__grid" d="M4 60 H60 M4 60 V4" />
        <path
          className="bd-motion-curve__handles"
          d={`M4 60 L${X(a)} ${Y(b)} M60 4 L${X(c)} ${Y(d)}`}
        />
        <path className="bd-motion-curve__line" d={`M4 60 C${X(a)} ${Y(b)} ${X(c)} ${Y(d)} 60 4`} />
      </svg>
      <figcaption>
        {interpolate(t('styleField.motion.curve'), { name: optionLabel(easing, t) })}
      </figcaption>
    </figure>
  );
}

/**
 * The rows of the Animations section (ADR-027): ready entrance effects, then the entrance, hover and
 * scroll controls, each shown only when it has something to adjust. Every control is the regular
 * style row (`row(name)`), so reset, breakpoint override and validation work as everywhere else.
 */
export function MotionRows(props: {
  readonly nodeId: string;
  readonly effective: EffectiveStyles;
  readonly layer: string;
  readonly disabled: boolean;
  readonly onError: (message: string) => void;
  readonly row: (name: string) => ReactNode;
  readonly has: (name: string) => boolean;
}) {
  const t = useT();
  const store = useEditor();
  const { effective, layer, row, has } = props;
  const value = (name: string) => {
    const entry = effective[`motion.${name}`];
    return entry === undefined ? undefined : String(entry.value);
  };
  const entrance = value('entrance') ?? 'none';
  const direction = value('entranceDirection') ?? 'up';
  const easing = value('entranceEasing') ?? 'ease-out';
  const hover = value('hover') ?? 'none';
  const here = (name: string) => effective[`motion.${name}`]?.source === layer;
  const base = layer === 'base';

  const choose = (preset: (typeof PRESETS)[number]) => {
    const target = layerFor(layer);
    const set = (property: string, text: string) => ({
      type: 'node.setStyle' as const,
      payload: { id: props.nodeId, layer: target, group: 'motion', property, value: text },
    });
    const unset = (property: string) => ({
      type: 'node.unsetStyle' as const,
      payload: { id: props.nodeId, layer: target, group: 'motion', property },
    });
    const commands =
      preset.entrance === 'none'
        ? base
          ? ['entrance', 'entranceDirection'].filter(here).map(unset)
          : [set('entrance', 'none')]
        : [
            set('entrance', preset.entrance),
            ...(preset.direction !== undefined ? [set('entranceDirection', preset.direction)] : []),
          ];
    if (commands.length === 0) return;
    const result = store.dispatchBatch(commands, { label: t(preset.label) });
    props.onError(result.ok ? '' : (result.error?.message ?? ''));
  };
  const active = (preset: (typeof PRESETS)[number]) =>
    preset.entrance === entrance && (preset.entrance !== 'slide' || preset.direction === direction);

  const sub = (key: MessageKey) => (
    <span key={key} className="bd-flabel bd-style-sub">
      {t(key)}
    </span>
  );
  const rows: ReactNode[] = [];
  if (has('entrance')) {
    rows.push(sub('styleField.motion.entrance'));
    rows.push(
      <fieldset
        key="presets"
        className="bd-segmented bd-motion-presets"
        aria-label={t('styleField.motion.presets')}
      >
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="ghost"
            className="bd-segment"
            aria-pressed={active(preset)}
            disabled={props.disabled}
            onClick={() => choose(preset)}
          >
            {t(preset.label)}
          </Button>
        ))}
      </fieldset>,
    );
    rows.push(<div key="entrance">{row('entrance')}</div>);
    if (entrance !== 'none') {
      if (entrance === 'slide' && has('entranceDirection')) {
        rows.push(<div key="direction">{row('entranceDirection')}</div>);
      }
      for (const name of ['entranceDuration', 'entranceDelay', 'entranceEasing']) {
        if (has(name)) rows.push(<div key={name}>{row(name)}</div>);
      }
      if (has('entranceEasing')) rows.push(<Curve key="curve" easing={easing} />);
    }
  }
  if (has('hover')) {
    rows.push(sub('styleField.motion.hover'));
    rows.push(<div key="hover">{row('hover')}</div>);
    if (hover !== 'none' && has('hoverDuration')) {
      rows.push(<div key="hoverDuration">{row('hoverDuration')}</div>);
    }
  }
  if (has('scrollReveal') || has('scrollParallax')) {
    rows.push(sub('styleField.motion.scroll'));
    if (has('scrollReveal')) rows.push(<div key="scrollReveal">{row('scrollReveal')}</div>);
    if (has('scrollParallax')) rows.push(<div key="scrollParallax">{row('scrollParallax')}</div>);
    rows.push(
      <p key="scrollHint" className="bd-hint">
        {t('styleField.motion.scrollHint')}
      </p>,
    );
  }
  rows.push(
    <p key="reduced" className="bd-hint">
      {t('styleField.motion.reduced')}
    </p>,
  );
  return <>{rows}</>;
}
