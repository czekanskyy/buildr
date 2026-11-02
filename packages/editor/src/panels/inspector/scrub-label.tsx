import { type ReactNode, useRef } from 'react';
import { useT } from '../../messages/index.tsx';
import { stepNumberText } from '../../ui/primitives.tsx';

/** Pointer scrubbing supplements the input's keyboard controls; callers still validate each value. */
export function ScrubLabel(props: {
  readonly htmlFor: string;
  readonly children: ReactNode;
  readonly value: string;
  readonly step?: number;
  readonly unit?: string;
  readonly disabled: boolean;
  readonly onValueChange: (value: string) => void;
}) {
  const t = useT();
  const drag = useRef<{ x: number; value: string } | null>(null);
  return (
    <label
      htmlFor={props.htmlFor}
      className="bd-field-label bd-scrub-label"
      title={props.disabled ? undefined : t('inspector.scrub')}
      data-disabled={props.disabled}
      onPointerDown={(event) => {
        if (props.disabled || event.button !== 0) return;
        if (stepNumberText(props.value, 0, props.unit ?? '') === undefined) return;
        drag.current = { x: event.clientX, value: props.value };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start === null || props.disabled) return;
        const delta = Math.trunc((event.clientX - start.x) / 3);
        const step = (props.step ?? 1) * (event.shiftKey ? 10 : event.altKey ? 0.1 : 1);
        const next = stepNumberText(start.value, delta * step, props.unit ?? '');
        if (next !== undefined && next !== props.value) props.onValueChange(next);
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
    >
      {props.children}
    </label>
  );
}
