import { MoteElement, css, event, html, prop } from '@mote/core';
import { token } from '@mote/tokens/refs';

/** Fired when the user dismisses the panel. */
export const dismiss = event<{ reason: 'button' | 'escape' }>('acme-dismiss', {
  bubbles: true,
  composed: true,
  cancelable: true,
});

/**
 * A surface with a heading and actions.
 *
 * @slot - Panel content.
 * @slot heading - The panel heading.
 * @csspart body - The content area.
 * @cssprop --acme-panel-gap - Space between regions.
 * @a11y Uses a labelled region; provide a heading.
 * @keyboard Escape dismisses the panel when `dismissible` is set.
 * @category Containers
 */
export class AcmePanel extends MoteElement.with({
  dismissible: prop.boolean({ reflect: true, description: 'Shows a dismiss button.' }),
  tone: prop.enum(['neutral', 'info'], { default: 'neutral', reflect: true }),
}) {
  static override styles = css`
    :host {
      display: block;
      padding: ${token('layout.inset')};
      gap: var(--acme-panel-gap, 1rem);
      color: var(--mote-color-text-primary);
    }
  `;
  static override events = { dismiss };

  /** Close the panel as if the user dismissed it. */
  close(): void {
    this.emit(dismiss, { reason: 'button' });
    this.setState('closed', true);
  }

  protected override render() {
    return html`<section part="frame">
      <header><slot name="heading"></slot></header>
      <div part="body"><slot></slot></div>
      ${this.dismissible ? html`<button part="dismiss" @click=${() => this.close()}>×</button>` : null}
    </section>`;
  }
}
