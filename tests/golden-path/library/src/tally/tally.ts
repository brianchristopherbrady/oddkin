import { OddkinElement, event, prop } from '@oddkin/core';

/** Fired after a press changes the count. */
export const countChange = event<{ count: number }>('count-change', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'count',
});

/**
 * A tally: a button that adds `step` to `count` on each press and reports the new count.
 *
 * @summary Counts presses.
 */
export class AcmeTally extends OddkinElement.with({
  count: prop.number({ default: 0, description: 'The current count.' }),
  step: prop.number({ default: 1, description: 'Amount added per press.' }),
  label: prop.string({ default: 'Count', description: 'Visible label before the count.' }),
}) {
  static override events = { countChange };

  /** @internal Press handler used by the template. */
  readonly _increment = (): void => {
    this.count += this.step;
    this.emit(countChange, { count: this.count });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'acme-tally': AcmeTally;
  }
}
