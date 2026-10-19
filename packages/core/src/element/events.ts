/**
 * Typed event definitions. Every definition states bubbles/composed/cancelable
 * explicitly and appears in component metadata.
 */

declare const DETAIL: unique symbol;

export interface EventDefinitionInit {
  readonly bubbles: boolean;
  readonly composed: boolean;
  readonly cancelable: boolean;
  /** Property this event reports user changes to (e.g. `value` for `input`), for tooling. */
  readonly syncs?: string;
  /**
   * For tooling: `user` events report user interaction and are never emitted by property writes;
   * `notification` events report a state change from any source. Omitted means unknown.
   */
  readonly intent?: 'user' | 'notification';
  readonly description?: string;
}

export interface EventDefinition<D = void> extends EventDefinitionInit {
  readonly type: string;
  /** Type-only brand carrying the detail type. */
  readonly [DETAIL]?: D;
}

export type EventDetail<E> = E extends EventDefinition<infer D> ? D : never;

/** Define an event once; dispatch it with `this.emit(definition, detail)`. */
export function event<D = void>(type: string, init: EventDefinitionInit): EventDefinition<D> {
  return Object.freeze({ type, ...init });
}

/** Dispatch a defined event from `target`. Returns false if a listener cancelled it. */
export function emit<D>(
  target: EventTarget,
  definition: EventDefinition<D>,
  ...detail: D extends void ? [] : [D]
): boolean {
  return target.dispatchEvent(
    new CustomEvent(definition.type, {
      detail: detail[0],
      bubbles: definition.bubbles,
      composed: definition.composed,
      cancelable: definition.cancelable,
    }),
  );
}
