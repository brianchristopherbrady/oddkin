import { OddkinElement, event, type ElementEvents } from '@oddkin/core';

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

/** Typed listeners are keyed by `static events` keys, so a key other than the name is reported. */
export class KeyedElement extends OddkinElement {
  static override events = { pinged: undeclared };
  declare readonly _events?: ElementEvents<typeof KeyedElement>;
}

customElements.define('dyn-keyed', KeyedElement);
