/**
 * `compose()` — assembles an element class, an external template, styles, and dependencies
 * into an immutable definition that `define(definition)` registers.
 * Contract: docs/architecture/core-contracts.md §1.1; recomposition: multi-product.md §5.
 */
import { DEV } from '../internal/dev.js';
import { OddkinError } from '../diagnostics/index.js';
import type { StyleInput } from '../styles/index.js';
import type { OddkinElement } from './element.js';

/** A template for `E`: runs in the same tracked render context as `render()`. */
export type ElementTemplate<E> = (host: E) => unknown;

/** Inputs to `compose()`. Spreading an existing definition is supported. */
export interface ElementDefinitionInit<E extends OddkinElement> {
  /** Custom element name the definition registers. */
  readonly name: string;
  /** Element class. Each registered name needs its own constructor; extend to reuse behavior. */
  readonly element: new () => E;
  /** Replaces the class's `render()` for this definition. */
  readonly template?: ElementTemplate<E> | undefined;
  /** Complete, ordered styles for this definition; replaces the class's `static styles`. */
  readonly styles?: StyleInput | undefined;
  /** Named component roles → definitions registered before this one. */
  readonly dependencies?: Readonly<Record<string, ElementDefinition<any>>> | undefined;
  /** Copied by a spread; identifies the definition being recomposed. Set by `compose()`. */
  readonly source?: ElementDefinition<any> | undefined;
  /** Copied by a spread; replaced by `compose()`. */
  readonly extends?: ElementDefinition<any> | undefined;
}

/** An immutable element definition produced by `compose()`. */
export interface ElementDefinition<E extends OddkinElement = OddkinElement> {
  readonly name: string;
  readonly element: new () => E;
  readonly template?: ElementTemplate<E> | undefined;
  readonly styles?: StyleInput | undefined;
  readonly dependencies?: Readonly<Record<string, ElementDefinition<any>>> | undefined;
  /** This definition. A spread carries it into a recomposition, which records it as `extends`. */
  readonly source: ElementDefinition<E>;
  /** The definition this one was recomposed from, if any. */
  readonly extends?: ElementDefinition<any> | undefined;
}

const definitions = new WeakSet<object>();

/** True for objects created by `compose()`. */
export function isElementDefinition(value: unknown): value is ElementDefinition<any> {
  return typeof value === 'object' && value !== null && definitions.has(value);
}

/**
 * Create an immutable element definition. Recompose an existing one by spreading it:
 * `compose({ ...cardDefinition, name: 'studio-card', element: StudioCard, styles })`.
 * The source definition and classes are never mutated; registration state is not copied.
 */
export function compose<E extends OddkinElement>(
  init: ElementDefinitionInit<E>,
): ElementDefinition<E> {
  if (typeof init.element !== 'function') {
    throw new OddkinError(
      'definition.element.invalid',
      DEV ? `compose({ name: "${init.name}" }) needs an element class.` : '',
    );
  }
  if (init.template !== undefined && typeof init.template !== 'function') {
    throw new OddkinError(
      'definition.template.invalid',
      DEV ? `compose({ name: "${init.name}" }): template must be a function of the host.` : '',
    );
  }
  for (const [role, dependency] of Object.entries(init.dependencies ?? {})) {
    if (!isElementDefinition(dependency)) {
      throw new OddkinError(
        'definition.dependency.invalid',
        DEV
          ? `compose({ name: "${init.name}" }): dependency "${role}" is not a definition created by compose().`
          : '',
      );
    }
  }
  const base = init.source && isElementDefinition(init.source) ? init.source : undefined;
  const definition: { -readonly [K in keyof ElementDefinition<E>]: ElementDefinition<E>[K] } = {
    name: init.name,
    element: init.element,
    template: init.template,
    styles: init.styles,
    dependencies: init.dependencies ? Object.freeze({ ...init.dependencies }) : undefined,
    source: undefined as unknown as ElementDefinition<E>,
    extends: base,
  };
  definition.source = definition;
  definitions.add(definition);
  return Object.freeze(definition);
}
