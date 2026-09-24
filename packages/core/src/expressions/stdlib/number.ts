import { StdlibArgError, type StdlibFunction } from './types.ts';

const MAX_DIGITS = 20;

/** Rounds half away from zero to `digits` decimals without the `1.005 → 1` binary-float trap. */
function roundTo(value: number, digits: number): number {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const shifted = Number(`${abs}e${digits}`);
  if (!Number.isFinite(shifted)) return value;
  const rounded = Number(`${Math.round(shifted)}e-${digits}`);
  return Number.isFinite(rounded) ? sign * rounded : value;
}

export const numberFunctions: readonly StdlibFunction[] = [
  {
    name: 'round',
    params: [{ type: 'number' }, { type: 'number', optional: true }],
    doc: 'round(n, digits?) — n rounded half away from zero to `digits` decimals (default 0)',
    run: ([n, digits]) => {
      const places = digits === undefined ? 0 : (digits as number);
      if (!Number.isInteger(places) || places < 0 || places > MAX_DIGITS) {
        throw new StdlibArgError(`digits must be an integer from 0 to ${MAX_DIGITS}`);
      }
      return roundTo(n as number, places);
    },
  },
  {
    name: 'floor',
    params: [{ type: 'number' }],
    doc: 'floor(n) — the largest integer not above n',
    run: ([n]) => Math.floor(n as number),
  },
  {
    name: 'ceil',
    params: [{ type: 'number' }],
    doc: 'ceil(n) — the smallest integer not below n',
    run: ([n]) => Math.ceil(n as number),
  },
  {
    name: 'abs',
    params: [{ type: 'number' }],
    doc: 'abs(n) — the absolute value',
    run: ([n]) => Math.abs(n as number),
  },
  {
    name: 'min',
    params: [{ type: 'number' }],
    rest: { type: 'number' },
    doc: 'min(...) — the smallest argument',
    run: (args) => Math.min(...(args as readonly number[])),
  },
  {
    name: 'max',
    params: [{ type: 'number' }],
    rest: { type: 'number' },
    doc: 'max(...) — the largest argument',
    run: (args) => Math.max(...(args as readonly number[])),
  },
  {
    name: 'clamp',
    params: [{ type: 'number' }, { type: 'number' }, { type: 'number' }],
    doc: 'clamp(n, lo, hi) — n limited to the range lo..hi',
    run: ([n, lo, hi]) => {
      if ((lo as number) > (hi as number)) throw new StdlibArgError('lo must not exceed hi');
      return Math.min(Math.max(n as number, lo as number), hi as number);
    },
  },
];
