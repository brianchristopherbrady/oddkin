/**
 * `@mote/core/helpers/ref` — get the element a binding sits on.
 * `ref=${inputRef}` (or any binding name); the attribute itself is never written.
 */
import { signal, type Signal } from '../reactive/index.js';
import {
  ATTRIBUTE_DIRECTIVE,
  type AttributeDirective,
  type DirectiveHandler,
} from '../template/directive.js';

type Target = { readonly set: (element: Element | undefined) => void };

interface RefDirective extends AttributeDirective {
  readonly target: Target;
}

const handler: DirectiveHandler<RefDirective, { target: Target; element: Element }> = {
  name: 'ref',
  parts: ['attribute', 'property'],
  apply(directive, element, _binding, previous) {
    if (previous && previous.target === directive.target && previous.element === element) {
      return { state: previous, changed: false };
    }
    previous?.target.set(undefined);
    directive.target.set(element);
    return { state: { target: directive.target, element }, changed: false };
  },
  clear(_element, state) {
    state.target.set(undefined);
  },
};

/** A reference to a rendered element. `value` is reactive: effects reading it re-run when it is set. */
export interface Ref<T extends Element = Element> extends AttributeDirective {
  readonly value: T | undefined;
}

class ElementRef<T extends Element> implements Ref<T>, RefDirective {
  readonly [ATTRIBUTE_DIRECTIVE] = handler;
  readonly #element: Signal<T | undefined> = signal<T | undefined>(undefined);
  readonly target: Target = { set: (element) => (this.#element.value = element as T | undefined) };

  get value(): T | undefined {
    return this.#element.value;
  }
}

/** Create a ref; bind it with `ref=${myRef}`. Cleared when the bound element's template is removed. */
export function createRef<T extends Element = Element>(): Ref<T> {
  return new ElementRef<T>();
}

/** Callback ref: called with the element when bound and with `undefined` when released. */
export function ref<T extends Element = Element>(
  callback: (element: T | undefined) => void,
): AttributeDirective {
  const directive: RefDirective = {
    [ATTRIBUTE_DIRECTIVE]: handler,
    target: { set: callback as (element: Element | undefined) => void },
  };
  return directive;
}
