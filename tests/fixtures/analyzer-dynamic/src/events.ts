import { OddkinElement, event } from '@oddkin/core';

const intent = (globalThis as { intent?: 'user' }).intent ?? 'user';

/** Its intent is computed, so it is recorded as unknown. */
export const computedIntent = event('dyn-computed', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: intent,
});

/** Emitted below without being declared, so the published contract would omit it. */
export const undeclared = event('dyn-undeclared', {
  bubbles: true,
  composed: true,
  cancelable: false,
});

export class EventsElement extends OddkinElement {
  static override events = { computedIntent };

  ping(): void {
    this.emit(computedIntent);
    this.emit(undeclared);
  }
}

customElements.define('dyn-events', EventsElement);
