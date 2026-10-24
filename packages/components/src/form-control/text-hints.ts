import { signal } from '@oddkin/core/reactive';
import type { Controller, Scope } from '@oddkin/core/scope';

const HINTS = ['inputmode', 'enterkeyhint', 'autocapitalize', 'autocorrect', 'spellcheck'] as const;

/** A global attribute that tunes text entry (virtual keyboard, capitals, correction, spelling). */
export type TextHint = (typeof HINTS)[number];

/**
 * The text-entry hints written on a host as on any HTML element (`inputmode`, `enterkeyhint`,
 * `autocapitalize`, `autocorrect`, `spellcheck`), followed while connected, for the element's
 * inner text field: `get(name, fallback)` gives the host's value, else the element's default.
 * Connect it in `connected(scope)`, so hints present at upgrade are in the first render.
 */
export class TextHints implements Controller {
  readonly #host: Element;
  readonly #values = signal<Readonly<Partial<Record<TextHint, string>>>>({});

  constructor(host: Element) {
    this.#host = host;
  }

  get(name: TextHint, fallback: string | null = null): string | null {
    return this.#values.value[name] ?? fallback;
  }

  connect(scope: Scope): void {
    const read = () => {
      const values: Partial<Record<TextHint, string>> = {};
      for (const name of HINTS) {
        const value = this.#host.getAttribute(name);
        if (value !== null) values[name] = value;
      }
      this.#values.value = values;
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(this.#host, { attributes: true, attributeFilter: [...HINTS] });
    scope.add(() => observer.disconnect(), 'text hints');
  }
}
