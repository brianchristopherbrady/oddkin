import { MoteElement, css, event, html, prop, signal, type Scope } from '@mote/core';

/** Fired after the count changes through user interaction. */
export const countChange = event<{ count: number }>('count-change', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'count',
});

/**
 * A counter with local state. The count text binds the signal directly, so clicks update
 * one text node without re-running `render()`.
 */
export class DemoCounter extends MoteElement.with({
  step: prop.number({ default: 1, description: 'Amount added per click.' }),
  label: prop.string({ default: 'Count', description: 'Visible label before the value.' }),
}) {
  static override styles = css`
    :host {
      display: inline-flex;
      font: inherit;
    }
    button {
      font: inherit;
      padding: 0.5rem 1rem;
      border: 2px solid currentColor;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 3px solid var(--demo-focus, #c2410c);
      outline-offset: 2px;
    }
    :host(:state(positive)) button {
      background: var(--demo-ink, #1e3a5f);
      color: var(--demo-paper, #fbf7ef);
    }
  `;
  static override events = { countChange };

  readonly #count = signal(0);

  get count(): number {
    return this.#count.value;
  }

  readonly #increment = (): void => {
    this.#count.value += this.step;
    this.setState('positive', this.#count.value > 0);
    this.emit(countChange, { count: this.#count.value });
  };

  protected override connected(scope: Scope): void {
    scope.listen(this, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.#count.value = 0;
    });
  }

  protected override render() {
    return html`<button type="button" @click=${this.#increment}>
      ${this.label}: <output>${this.#count}</output>
    </button>`;
  }
}
