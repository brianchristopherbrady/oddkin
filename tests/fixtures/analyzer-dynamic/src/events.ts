import { OddkinElement, event } from '@oddkin/core';

const intent = (globalThis as { intent?: 'user' }).intent ?? 'user';

/** Its intent is computed, so it is recorded as unknown. */
export const computedIntent = event('dyn-computed', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: intent,
});

export class EventsElement extends OddkinElement {
  static override events = { computedIntent };
}

customElements.define('dyn-events', EventsElement);
