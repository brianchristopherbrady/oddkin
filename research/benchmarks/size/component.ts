// A typical component: typed properties, reflection, an event, styles, and a structural helper.
import { MoteElement, css, define, event, html, prop, when } from '@mote/core';

const toggled = event<{ open: boolean }>('x-toggle', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'open',
});

class XDisclosure extends MoteElement.with({
  label: prop.string({ default: 'Details' }),
  open: prop.boolean({ reflect: true }),
}) {
  static override styles = css`
    :host {
      display: block;
    }
    button {
      font: inherit;
    }
  `;
  static override events = { toggled };
  readonly #toggle = () => {
    this.open = !this.open;
    this.emit(toggled, { open: this.open });
  };
  protected override render() {
    return html`<button type="button" aria-expanded=${String(this.open)} @click=${this.#toggle}>
        ${this.label}
      </button>
      ${when(this.open, () => html`<div part="panel"><slot></slot></div>`)}`;
  }
}

define('x-disclosure', XDisclosure);
