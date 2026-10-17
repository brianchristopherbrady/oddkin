import { MoteElement, event, prop } from '@mote/core';

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
  static override events = { dismiss };

  /** Close the panel as if the user dismissed it. */
  close(): void {
    this.emit(dismiss, { reason: 'button' });
    this.setState('closed', true);
  }

  /** @internal Used by the template. */
  readonly onDismissClick = (): void => this.close();
}
