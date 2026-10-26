import { OddkinElement, prop } from '@oddkin/core/element';

/**
 * The status marker of a timeline event or a step (Figma's Event marker and Step status): a circle
 * with the built-in glyph for `status`, or its own content (a step number) while idle. Decorative:
 * hidden from assistive technology, so the list and the words beside it carry the meaning. The
 * `.odd-timeline` and `.odd-stepper` recipes size and colour it; alone it has its own look.
 *
 * @slot - Content while idle: a step number. Empty: a dot.
 * @csspart base - The circle.
 * @cssprop --odd-status-marker-size - The circle's size (default `control.height.sm`).
 * @a11y Hidden from assistive technology: say the status in words beside it ("Complete", "Needs attention").
 * @previewRole statusMarker
 * @useFor Timeline events and steps, inside the `.odd-timeline` and `.odd-stepper` recipes.
 * @notFor Status on its own (use a badge, which carries words); a progress value (use a progress bar).
 * @category Display
 */
export class OddkinStatusMarker extends OddkinElement.with({
  status: prop.enum(['idle', 'pending', 'complete', 'failed'], {
    default: 'idle',
    reflect: true,
    description:
      'Idle: the content or a dot. Pending: a busy ring. Complete: a check. Failed: a warning glyph.',
  }),
}) {
  protected override connected(): void {
    this.internals.ariaHidden = 'true';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-status-marker': OddkinStatusMarker;
  }
}
