/**
 * Structural helpers. They are plain functions: with a plain condition they evaluate
 * inside the caller's tracking (render); with a readable they return a computed value
 * so the binding updates without rerunning render.
 */
import { computed, isReadable, type Readable } from '../reactive/index.js';
import { createRepeat, type RepeatDirective } from './repeat.js';

type MaybeReadable<T> = T | Readable<T>;

/**
 * Render `yes()` when `condition` is truthy, otherwise `no?.()`. The inactive branch's
 * DOM and bindings are disposed when the branch switches.
 */
export function when<Y, N = null>(
  condition: MaybeReadable<unknown>,
  yes: () => Y,
  no?: () => N,
): Y | N | null | Readable<Y | N | null> {
  if (isReadable(condition)) return computed(() => (condition.value ? yes() : no ? no() : null));
  return condition ? yes() : no ? no() : null;
}

/** Exhaustive branch on a string or number union. TypeScript requires every case. */
export function match<V extends string | number, C extends { readonly [K in V]: () => unknown }>(
  value: MaybeReadable<V>,
  cases: C,
): ReturnType<C[V]> | Readable<ReturnType<C[V]>> {
  if (isReadable(value)) return computed(() => cases[value.value]() as ReturnType<C[V]>);
  return cases[value]() as ReturnType<C[V]>;
}
/**
 * Keyed list. DOM and nested state for each key are reused across reorders; removed
 * keys release their bindings. Keys must be unique and stable.
 */
export function repeat<T>(
  items: MaybeReadable<Iterable<T>>,
  key: (item: T, index: number) => unknown,
  template: (item: T, index: number) => unknown,
): RepeatDirective<T> | Readable<RepeatDirective<T>> {
  if (isReadable(items)) return computed(() => createRepeat(items.value, key, template));
  return createRepeat(items, key, template);
}
