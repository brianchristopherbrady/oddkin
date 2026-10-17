// Minimal production counter: Mote code + registration, nothing else.
import { MoteElement, define, html, signal } from '@mote/core';

class XCounter extends MoteElement {
  readonly count = signal(0);
  readonly increment = () => {
    this.count.value++;
  };
  protected override render() {
    return html`<button type="button" @click=${this.increment}>Count: ${this.count}</button>`;
  }
}

define('x-counter', XCounter);
