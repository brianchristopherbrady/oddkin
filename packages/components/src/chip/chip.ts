import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { format, strings } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

export const CHIP_STRINGS = { remove: 'Remove {label}' };

/** The user asked to remove the chip; the application removes it (or its value). */
export const chipRemoveEvent = event<Record<string, never>>('odd-chip-remove', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'The remove button was activated; the application removes the chip or its value.',
});

/**
 * A compact token for a value, filter, or tag, with an explicit remove button when `removable`.
 * The chip itself is not focusable; only its remove button is.
 *
 * @slot - The label.
 * @csspart base - The chip.
 * @csspart remove - The remove button.
 * @cssprop --odd-chip-radius - Corner radius.
 * @a11y The remove button is named "Remove {label}" from the chip's text (`strings.remove`). Backspace or Delete on it also removes. Move focus to a sensible place after removing the chip.
 * @keyboard Tab reaches the remove button; Enter, Space, Backspace, or Delete removes.
 * @previewRole chip
 * @useFor Selected values, applied filters, and tags that can be removed.
 * @notFor Actions (use a button); status (use a badge).
 * @category Display
 * @customization 1 2 3
 */
export class OddkinChip extends OddkinElement.with({
  removable: prop.boolean({ reflect: true, description: 'Shows a remove button.' }),
  selected: prop.boolean({ reflect: true, description: 'Selection look, as for a chosen value.' }),
  disabled: prop.boolean({ reflect: true, description: 'Dims the chip and disables its button.' }),
  strings: prop.object<Partial<typeof CHIP_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'odd-chip-remove': chipRemoveEvent };
  declare readonly _events?: ElementEvents<typeof OddkinChip>;

  /** @internal The chip's text, kept current for the remove button's name. */
  readonly _text = signal('');

  /** @internal The remove button's name, from the chip's text. */
  get _removeLabel(): string {
    return format(strings(CHIP_STRINGS, this.strings).remove, { label: this._text.value });
  }

  /** @internal Activation of the remove button (a disabled button cannot be activated). */
  readonly _onRemove = (): void => {
    this.emit(chipRemoveEvent, {});
  };
  /** @internal Backspace and Delete on the remove button remove too. */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    event.preventDefault();
    this._onRemove();
  };

  protected override mounted(scope: Scope): void {
    const read = () => {
      this._text.value = this.textContent?.trim() ?? '';
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(this, { characterData: true, childList: true, subtree: true });
    scope.add(() => observer.disconnect(), 'chip text');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-chip': OddkinChip;
  }
  interface GlobalEventHandlersEventMap {
    'odd-chip-remove': CustomEvent<Record<string, never>>;
  }
}
