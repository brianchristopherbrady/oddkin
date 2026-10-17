import { MoteElement, event, prop, signal, type Readable, type Scope } from '@mote/core';

/** Fired after the count changes through user interaction. */
export const countChange = event<{ count: number }>('count-change', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'count',
});

/**
 * A counter with local state. The count text binds the signal directly, so clicks update
 * one text node without re-running the template.
 */
export class DemoCounter extends MoteElement.with({
  step: prop.number({ default: 1, description: 'Amount added per click.' }),
  label: prop.string({ default: 'Count', description: 'Visible label before the value.' }),
}) {
  static override events = { countChange };

  readonly #count = signal(0);

  /** @internal Read-only view of the count for the template's direct binding. */
  readonly _count: Readable<number> = this.#count;

  get count(): number {
    return this.#count.value;
  }

  /** @internal Click handler used by the template. */
  readonly _increment = (): void => {
    this.#count.value += this.step;
    this.setState('positive', this.#count.value > 0);
    this.emit(countChange, { count: this.#count.value });
  };

  protected override connected(scope: Scope): void {
    scope.listen(this, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.#count.value = 0;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-counter': DemoCounter;
  }
}
