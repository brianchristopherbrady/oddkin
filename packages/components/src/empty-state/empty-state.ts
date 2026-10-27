import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';

/**
 * Explains why a region is empty and offers the next useful step: first use, no results, nothing
 * left to do.
 *
 * @slot - The explanation.
 * @slot media - An illustration or icon, drawn on a circle.
 * @slot footer - The next step, such as a button.
 * @csspart base - The centred column.
 * @csspart media - The circle behind the media slot (hidden when empty).
 * @csspart label - The title.
 * @csspart footer - The footer region (hidden when empty).
 * @a11y Plain text in place; it adds no role. When it replaces results after a search, announce the outcome separately (for example with a live region the page owns).
 * @previewRole emptyState
 * @useFor Empty lists, tables, and searches with no results.
 * @notFor Errors (use odd-alert); loading (use odd-skeleton or odd-spinner).
 * @category Feedback
 * @customization 1 2 3
 */
export class OddkinEmptyState extends OddkinElement.with({
  label: prop.string({ default: '', description: 'The title.' }),
}) {
  /** @internal True while the media slot has content; read by the template. */
  readonly _hasMedia = signal(false);
  /** @internal True while the footer slot has content; read by the template. */
  readonly _hasFooter = signal(false);

  /** @internal Slot change handler used by the template. */
  readonly _onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const filled = slot
      .assignedNodes({ flatten: true })
      .some((node) => node.nodeType === Node.ELEMENT_NODE || !!node.textContent?.trim());
    if (slot.name === 'media') this._hasMedia.value = filled;
    else this._hasFooter.value = filled;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-empty-state': OddkinEmptyState;
  }
}
