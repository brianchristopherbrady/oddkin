/**
 * Candidate 2 — a child directive: `children.child(key, role, definition, init)` creates the
 * role's element from its definition and returns it for a child position.
 *
 * Core child parts have no directive protocol and no per-part state, so the element's identity
 * cannot come from the part. It comes from an explicit cache keyed by the repeat key and role,
 * which the composite prunes to the live keys on each render.
 */
import type { ElementDefinition, OddkinElement } from '@oddkin/core/element';

type Writable<E> = { -readonly [K in keyof E]?: E[K] };

export interface ChildInit<E extends OddkinElement> {
  /** Properties, typed against the element; written when they differ from the last write. */
  readonly props?: Writable<Pick<E, Exclude<keyof E, keyof HTMLElement>>>;
  readonly attrs?: Readonly<Record<string, string | boolean | null>>;
  /** One listener per type for the element's life, calling the latest handler. */
  readonly on?: Readonly<Record<string, (event: Event) => void>>;
  /** Default-slot text. */
  readonly text?: string;
}

interface Entry {
  readonly element: HTMLElement;
  readonly props: Map<string, unknown>;
  readonly handlers: Map<string, (event: Event) => void>;
}

export class Children {
  readonly #rows = new Map<unknown, Map<string, Entry>>();

  child<E extends OddkinElement>(
    key: unknown,
    role: string,
    definition: ElementDefinition<E>,
    init: ChildInit<E> = {},
  ): E {
    let row = this.#rows.get(key);
    if (!row) this.#rows.set(key, (row = new Map()));
    let entry = row.get(role);
    if (!entry || entry.element.localName !== definition.name) {
      entry = {
        element: document.createElement(definition.name),
        props: new Map(),
        handlers: new Map(),
      };
      row.set(role, entry);
    }
    const { element, props, handlers } = entry;
    for (const [name, value] of Object.entries(init.attrs ?? {})) {
      if (value === false || value === null) element.removeAttribute(name);
      else element.setAttribute(name, value === true ? '' : value);
    }
    for (const [name, value] of Object.entries(init.props ?? {})) {
      if (props.has(name) && Object.is(props.get(name), value)) continue;
      (element as unknown as Record<string, unknown>)[name] = value;
      props.set(name, value);
    }
    for (const [type, handler] of Object.entries(init.on ?? {})) {
      if (!handlers.has(type)) element.addEventListener(type, (e) => handlers.get(type)?.(e));
      handlers.set(type, handler);
    }
    if (init.text !== undefined && element.textContent !== init.text)
      element.textContent = init.text;
    return element as unknown as E;
  }

  /** Forget rows whose keys are gone; their elements leave with their rows. */
  retain(keys: Iterable<unknown>): void {
    const live = new Set(keys);
    for (const key of this.#rows.keys()) if (!live.has(key)) this.#rows.delete(key);
  }

  get size(): number {
    return this.#rows.size;
  }
}
