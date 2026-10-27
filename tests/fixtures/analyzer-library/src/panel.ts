import { OddkinElement, css, event, html, prop } from '@oddkin/core';
import { token } from '@oddkin/tokens/refs';

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
export class AcmePanel extends OddkinElement.with({
  dismissible: prop.boolean({ reflect: true, description: 'Shows a dismiss button.' }),
  tone: prop.enum(['neutral', 'info'], { default: 'neutral', reflect: true }),
}) {
  static override styles = css`
    :host {
      display: block;
      padding: ${token('layout.inset')};
      gap: var(--acme-panel-gap, 1rem);
      color: var(--odd-color-text-primary);
      margin-block-end: var(--_panel-trailing, 0);
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
