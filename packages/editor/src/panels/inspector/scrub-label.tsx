import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { useT } from '../../messages/index.tsx';
import { useEditor } from '../../store/index.ts';
import { stepNumberText } from '../../ui/primitives.tsx';

/** Clamp and quantize to the field's step, preserving its unit and rejecting non-finite input. */
function scrubValue(text: string, delta: number, step: number, min?: number, max?: number) {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/.exec(text);
  if (match === null || !Number.isFinite(step) || step <= 0) return undefined;
  const start = Number(match[1]);
  const raw = start + delta;
  if (!Number.isFinite(raw)) return undefined;
  const lower = min !== undefined && Number.isFinite(min) ? min : -Infinity;
  const upper = max !== undefined && Number.isFinite(max) ? max : Infinity;
  const origin = Number.isFinite(lower) ? lower : 0;
  const quantized = origin + Math.round((raw - origin) / step) * step;
  const next = Math.min(upper, Math.max(lower, Number(quantized.toPrecision(12))));
  return Number.isFinite(next) ? `${Object.is(next, -0) ? 0 : next}${match[2]}` : undefined;
}

/** Pointer scrubbing supplements keyboard controls and records the entire gesture as one undo step. */
export function ScrubLabel(props: {
  readonly htmlFor: string;
  readonly children: ReactNode;
  readonly value: string;
  readonly step?: number;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly unit?: string;
  readonly disabled: boolean;
  readonly onValueChange: (value: string) => void;
}) {
  const t = useT();
  const store = useEditor();
  const drag = useRef<{ x: number; value: string; last: string } | null>(null);
  const finish = useCallback(() => {
    if (drag.current === null) return;
    drag.current = null;
    store.history.commit();
    // Only history metadata changes here; document writes always go through the caller's commands.
    store.setState({
      inTransaction: store.history.inTransaction,
      canUndo: store.history.canUndo,
      canRedo: store.history.canRedo,
      cursorId: store.history.cursorId,
      undoLabel: store.history.past.at(-1)?.label,
      redoLabel: store.history.future.at(-1)?.label,
    });
  }, [store]);
  useEffect(() => finish, [finish]);
  return (
    <label
      htmlFor={props.htmlFor}
      className="bd-field-label bd-scrub-label"
      title={props.disabled ? undefined : t('inspector.scrub')}
      data-disabled={props.disabled}
      onPointerDown={(event) => {
        if (
          props.disabled ||
          store.getState().readOnly ||
          event.button !== 0 ||
          drag.current !== null
        )
          return;
        const value = stepNumberText(props.value, 0, props.unit ?? '');
        if (
          value === undefined ||
          scrubValue(value, 0, props.step ?? 1, props.min, props.max) === undefined
        )
          return;
        if (!store.history.begin(t('inspector.scrub')).ok) return;
        drag.current = { x: event.clientX, value, last: value };
        store.setState({ inTransaction: true, canUndo: false, canRedo: false });
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start === null || props.disabled) return;
        const delta = Math.trunc((event.clientX - start.x) / 3);
        const step = props.step ?? 1;
        const next = scrubValue(
          start.value,
          delta * step * (event.shiftKey ? 10 : event.altKey ? 0.1 : 1),
          step,
          props.min,
          props.max,
        );
        if (next !== undefined && next !== start.last) {
          start.last = next;
          props.onValueChange(next);
        }
      }}
      onPointerUp={(event) => {
        finish();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      {props.children}
    </label>
  );
}
