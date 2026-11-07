import { FocusRecovery } from '@oddkin/core/controllers/focus';
import { signal } from '@oddkin/core/reactive';

/**
 * What the elements that ask the host to decide share. A request guard: the view asks once
 * per record key (an id with its revision), and a second click asks nothing until the host's
 * record moves to another key or says the request is over. Focus recovery: while connected,
 * focus on a control that disappears moves to `fallback()`, so keyboard users keep their place.
 */
export class DecisionController extends FocusRecovery {
  readonly #requested = signal<{ readonly key: string; readonly choice: string } | undefined>(
    undefined,
  );

  constructor(host: Element, fallback: () => HTMLElement | null | undefined) {
    super({ root: () => host.shadowRoot, fallback });
  }

  /** Whether this view asked about `key` and the host has not settled it (reactive). */
  asked(key: string): boolean {
    return this.#requested.value?.key === key;
  }

  /** What this view asked for `key`, such as `approve` (reactive). */
  choice(key: string): string | undefined {
    const requested = this.#requested.value;
    return requested?.key === key ? requested.choice : undefined;
  }

  /** Records a request; false, asking nothing, when one for `key` is already pending. */
  request(key: string, choice = ''): boolean {
    if (this.#requested.peek()?.key === key) return false;
    this.#requested.value = { key, choice };
    return true;
  }

  /** Releases the guard when the record is no longer `key`, or when `over` says the host answered. */
  settle(key: string | undefined, over = false): void {
    const requested = this.#requested.peek();
    if (requested && (requested.key !== key || over)) this.#requested.value = undefined;
  }
}
