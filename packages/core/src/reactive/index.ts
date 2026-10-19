/**
 * `@oddkin/core/reactive` — Oddkin's single reactive graph. DOM-free.
 * Contract: docs/architecture/core-contracts.md §5; ADR 0002.
 */
export {
  READABLE,
  batch,
  computed,
  effect,
  flush,
  fromExternal,
  isReadable,
  settled,
  signal,
  toExternal,
  untracked,
} from './graph.js';
export type {
  EffectCleanup,
  EffectFn,
  EffectOptions,
  EffectPhase,
  ExternalSource,
  ReactiveOptions,
  Readable,
  Signal,
} from './graph.js';
