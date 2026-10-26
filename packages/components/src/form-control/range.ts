/**
 * Numbers on a step grid, as HTML number and range inputs count them, and the input that moves
 * them: the valid floating-point number syntax; the `stepUp()`/`stepDown()` algorithm, the same in
 * every engine (the engines differ at the edges: stepping down from an empty field, a maximum off
 * the grid); a range input's snap to the nearest value; the APG keys of sliders and spinbuttons;
 * and a pointer drag along an area. Used by odd-input's number field and odd-slider.
 */
import type { Scope } from '@oddkin/core/scope';

// HTML's valid floating-point number: no leading `+`, no trailing `.`, no spaces.
const FLOAT = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;

/** The number a valid floating-point number string holds; `undefined` for anything else. */
export function parseNumber(text: string | null | undefined): number | undefined {
  if (!text || !FLOAT.test(text)) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

/** A field's bounds and step grid; no `step` is `step="any"`. */
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
// The grid indexes of the lowest and highest values within the bounds (infinite when unbounded).
const endIndexes = (range: NumberRange, step: number): [number, number] => [
  range.min === undefined ? -Infinity : Math.ceil((range.min - range.base) / step - 1e-9),
  range.max === undefined ? Infinity : Math.floor((range.max - range.base) / step + 1e-9),
];

/** The lowest and highest values the grid allows within the bounds. */
export function rangeEnds(range: NumberRange): {
  low: number | undefined;
  high: number | undefined;
} {
  const { min, max, step } = range;
  if (step === undefined) return { low: min, high: max };
  const [low, high] = endIndexes(range, step);
  return {
    low: min === undefined ? undefined : onGrid(range, step, low),
    high: max === undefined ? undefined : onGrid(range, step, high),
  };
}

/** The grid value nearest to `value` within the bounds, as a range input sanitizes its value. */
export function snapNumber(value: number, range: NumberRange & { readonly step: number }): number {
  const { step } = range;
  const [low, high] = endIndexes(range, step);
  return onGrid(
    range,
    step,
    Math.min(Math.max(Math.round((value - range.base) / step), low), high),
  );
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
    const target = aligned ? Math.round(k) + n : n > 0 ? Math.ceil(k) : Math.floor(k);
    const [low, high] = endIndexes(range, step);
    next = onGrid(range, step, Math.min(Math.max(target, low), high));
  }
  if (value !== undefined && (n > 0 ? next < value : next > value)) return value;
  return next;
}

/** The keys of a range: how many steps Page Up and Page Down move, and the horizontal arrows. */
export interface RangeKeys {
  readonly page: number;
  /** Right and Left step too, swapped in right-to-left text (`rtl`). */
  readonly horizontal?: boolean;
  readonly rtl?: boolean;
}

/**
 * The value a key moves `value` to, as the WAI-ARIA slider and spinbutton patterns key them: Up
 * and Down one step, Page Up and Page Down `page` steps, Home and End the lowest and highest
 * values on the grid, Right and Left one step when `horizontal`. `undefined` when the key does not
 * move a range value (another key, or Home and End without that bound).
 */
export function keyValue(
  key: string,
  value: number | undefined,
  range: NumberRange,
  keys: RangeKeys,
): number | undefined {
  const forward = keys.rtl ? -1 : 1;
  const steps: Record<string, number> = {
    ArrowUp: 1,
    ArrowDown: -1,
    PageUp: keys.page,
    PageDown: -keys.page,
    ...(keys.horizontal ? { ArrowRight: forward, ArrowLeft: -forward } : {}),
  };
  if (key in steps) return stepNumber(value, steps[key]!, range);
  if (key === 'Home') return rangeEnds(range).low;
  if (key === 'End') return rangeEnds(range).high;
  return undefined;
}

/** What a pointer drag reports. */
export interface PointerDrag {
  /** Pixels at each edge that the thumb's centre stops short of (half the thumb). */
  readonly inset: number;
  /** The pointer's position in the area, 0 to 1: `x` from the start edge (mirrored right to left), `y` from the top. */
  readonly move: (x: number, y: number) => void;
  /** The pointer was released or cancelled. */
  readonly end?: () => void;
}

/**
 * Follows the pointer that `event` pressed on `area` until it is released or cancelled: reports
 * its position for the press and every move, capturing the pointer and listening on the document
 * in a child of `scope`, so the drag continues outside the area and ends with the scope.
 */
export function pointerDrag(
  scope: Scope,
  area: HTMLElement,
  event: PointerEvent,
  drag: PointerDrag,
): void {
  const at = (e: PointerEvent) => {
    const rect = area.getBoundingClientRect();
    const fraction = (offset: number, size: number) => {
      const usable = size - 2 * drag.inset;
      return usable > 0 ? Math.min(Math.max((offset - drag.inset) / usable, 0), 1) : 0;
    };
    const x = fraction(e.clientX - rect.left, rect.width);
    drag.move(
      getComputedStyle(area).direction === 'rtl' ? 1 - x : x,
      fraction(e.clientY - rect.top, rect.height),
    );
  };
  at(event);
  try {
    area.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic or already released pointers cannot be captured; the document still sees them.
  }
  const child = scope.child({ name: 'pointer drag' });
  const ours = (e: PointerEvent) => e.pointerId === event.pointerId;
  const doc = area.ownerDocument;
  child.listen(doc, 'pointermove', (e: PointerEvent) => ours(e) && at(e));
  const end = (e: PointerEvent) => {
    if (!ours(e)) return;
    child.dispose();
    drag.end?.();
  };
  child.listen(doc, 'pointerup', end);
  child.listen(doc, 'pointercancel', end);
}
