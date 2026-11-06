import type { ComponentProps } from 'react';
import { useT } from '../../../messages/index.tsx';
import { Icon, NumberUnitInput as Input } from '../../../ui/index.ts';
export function NumberUnitInput(props: ComponentProps<typeof Input>) {
  const t = useT();
  const step = (direction: number) => {
    const match = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/.exec(props.value);
    const value = Number(match?.[1] ?? 0) + direction * (props.step ?? 1);
    props.onValueChange(
      `${Number(value.toFixed(4))}${match?.[2] ?? (props.bareNumber ? '' : (props.units[0] ?? ''))}`,
    );
  };
  return (
    <span className="bd-style-number">
      <Input {...props} />
      <span className="bd-style-steps">
        <button
          type="button"
          disabled={props.disabled}
          aria-label={`${props.ariaLabel ?? props.unitLabel}: ${t('style.step.up')}`}
          onClick={() => step(1)}
        >
          <Icon name="chevron-up" />
        </button>
        <button
          type="button"
          disabled={props.disabled}
          aria-label={`${props.ariaLabel ?? props.unitLabel}: ${t('style.step.down')}`}
          onClick={() => step(-1)}
        >
          <Icon name="chevron-down" />
        </button>
      </span>
    </span>
  );
}
