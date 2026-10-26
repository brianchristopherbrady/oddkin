/**
 * Numbers on a step grid, as HTML number fields count them: the valid floating-point number
 * syntax and the `stepUp()`/`stepDown()` algorithm, the same in every engine (the engines differ
 * at the edges: stepping down from an empty field, a maximum off the grid).
 */

// HTML's valid floating-point number: no leading `+`, no trailing `.`, no spaces.
const FLOAT = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;

/** The number a valid floating-point number string holds; `undefined` for anything else. */
export function parseNumber(text: string | null | undefined): number | undefined {
  if (!text || !FLOAT.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

/** A number field's bounds and step grid; no `step` is `step="any"`. */
export interface NumberRange {
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly step: number | undefined;
  /** Where the grid starts: `min`, else the default value, else 0. */
  readonly base: number;
}

// Rounds away binary noise (0.1 + 0.2) at the precision of the base and the step.
const places = (value: number): number => {
  const [mantissa = '', exponent = '0'] = String(value).split('e');
  return Math.max(0, (mantissa.split('.')[1] ?? '').length - Number(exponent));
};
const onGrid = (range: NumberRange, step: number, k: number): number =>
  Number(
    (range.base + k * step).toFixed(Math.min(100, Math.max(places(range.base), places(step)))),
  );

/** The lowest and highest values the grid allows within the bounds. */
export function rangeEnds(range: NumberRange): {
  low: number | undefined;
  high: number | undefined;
} {
  const { min, max, step } = range;
  if (step === undefined) return { low: min, high: max };
  const low = min === undefined ? undefined : Math.ceil((min - range.base) / step - 1e-9);
  const high = max === undefined ? undefined : Math.floor((max - range.base) / step + 1e-9);
  return {
    low: low === undefined ? undefined : onGrid(range, step, low),
    high: high === undefined ? undefined : onGrid(range, step, high),
  };
}

/**
 * `value` (`undefined` when empty) moved `n` steps (negative: down), as `stepUp(n)` does: a value
 * off the grid moves to the nearest grid value in that direction, the result is kept within the
 * bounds, and a step that would move the other way leaves the value. An empty field counts from
 * 0 and always takes the result. With `step="any"` it moves by `n` (as the engines' arrow keys).
 * Bounds that cross leave the value.
 */
export function stepNumber(
  value: number | undefined,
  n: number,
  range: NumberRange,
): number | undefined {
  const { min, max, step } = range;
  if (min !== undefined && max !== undefined && max < min) return value;
  const from = value ?? 0;
  let next: number;
  if (step === undefined) {
    next = Math.min(Math.max(from + n, min ?? -Infinity), max ?? Infinity);
  } else {
    const k = (from - range.base) / step;
    const aligned = Math.abs(k - Math.round(k)) < 1e-9;
    let target = aligned ? Math.round(k) + n : n > 0 ? Math.ceil(k) : Math.floor(k);
    const { low, high } = rangeEnds(range);
    // Both ends are on the grid, `low` at `base` (crossed bounds returned above).
    const lowK = low === undefined ? -Infinity : Math.round((low - range.base) / step);
    const highK = high === undefined ? Infinity : Math.round((high - range.base) / step);
    target = Math.min(Math.max(target, lowK), highK);
    next = onGrid(range, step, target);
  }
  if (value !== undefined && (n > 0 ? next < value : next > value)) return value;
  return next;
}
