// Minimal production counter: Oddkin code + registration, nothing else.
import { OddkinElement, define, html, signal } from '@oddkin/core';

class XCounter extends OddkinElement {
  readonly count = signal(0);
  readonly increment = () => {
    this.count.value++;
  };
  protected override render() {
    return html`<button type="button" @click=${this.increment}>Count: ${this.count}</button>`;
  }
}

define('x-counter', XCounter);
