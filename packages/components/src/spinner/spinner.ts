import { OddkinElement, prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';

export const SPINNER_STRINGS = { loading: 'Loading' };

/**
 * An indeterminate busy indicator with a status label. It never shows a percentage; when the
 * amount of work is known, use `odd-progress`.
 *
 * @slot - Visible status text ("Saving changes…"), which then names the indicator.
 * @csspart base - The indicator and its text.
 * @csspart indicator - The turning ring.
 * @cssprop --odd-spinner-color - Colour of the moving arc.
 * @a11y A progress bar without a value, named by the slotted text, or by `label` (default "Loading") shown to assistive technology only. Announce completion separately if it matters.
 * @previewRole busyIndicator
 * @useFor Waiting of unknown length: loading a region, saving.
 * @notFor Known progress (use odd-progress); content-shaped placeholders (use odd-skeleton).
 * @category Feedback
 */
export class OddkinSpinner extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'Accessible name when there is no visible text; default "Loading".',
  }),
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Ring size: 16, 20, or 24 px.',
  }),
  strings: prop.object<Partial<typeof SPINNER_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal True while the default slot has text; read by the template. */
  readonly _hasText = signal(false);

  /** @internal Slot change handler used by the template. */
  readonly _onSlotChange = (event: Event): void => {
    this._hasText.value = (event.target as HTMLSlotElement)
      .assignedNodes()
      .some((node) => !!node.textContent?.trim());
  };

  /** @internal The built-in text with overrides applied. */
  get _strings(): typeof SPINNER_STRINGS {
    return strings(SPINNER_STRINGS, this.strings);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-spinner': OddkinSpinner;
  }
}
