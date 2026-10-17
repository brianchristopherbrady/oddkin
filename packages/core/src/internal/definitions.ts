/**
 * Constructor → registered definition. Kept outside the class so definitions never mutate
 * the classes they reference, and so the element base class can look up its configuration
 * without importing `compose()`.
 */
import type { StyleInput } from '../styles/index.js';

/** Runtime view of a definition used by the element base class. */
export interface BoundDefinition {
  readonly template?: ((host: never) => unknown) | undefined;
  readonly styles?: StyleInput | undefined;
}

const bound = new WeakMap<object, BoundDefinition>();

/** The definition registered for exactly this constructor (never inherited). */
export function definitionFor(ctor: object): BoundDefinition | undefined {
  return bound.get(ctor);
}

export function bindDefinition(ctor: object, definition: BoundDefinition): void {
  bound.set(ctor, definition);
}

export function unbindDefinition(ctor: object, definition: BoundDefinition): void {
  if (bound.get(ctor) === definition) bound.delete(ctor);
}
