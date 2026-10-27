import { RovingFocus, type RovingFocusOptions } from '@oddkin/core/controllers/focus';
import { OddkinElement, prop } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';

const NOT_TEXT = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'reset',
  'submit',
]);
/** Text entry and sliders keep their own arrow keys, Home, and End (caret and value). */
const keepsKeys = (target: EventTarget | undefined) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && !NOT_TEXT.has(target.type)) ||
  (target instanceof HTMLElement && target.isContentEditable);

/** A child that takes part in the roving focus: a control, a link, or a focus-delegating host. */
const isItem = (el: Element): el is HTMLElement =>
  el instanceof HTMLElement &&
  (el.matches('button, input, select, textarea, a[href], [tabindex], [contenteditable]') ||
    !!el.shadowRoot?.delegatesFocus);

/**
 * A named group of controls with one Tab stop (APG toolbar): arrow keys move focus among the
 * slotted controls, which stay the author's own elements. An `<hr>` child is drawn as a separator.
 *
 * @slot - Controls (buttons, odd-button, inputs, links), text, and `<hr>` separators.
 * @csspart base - The surface.
 * @cssprop --odd-toolbar-radius - Corner radius of the surface.
 * @cssprop --odd-toolbar-background - Background of the surface.
 * @a11y The host is a `toolbar` named by `label`, with `aria-orientation`. Only one control is in the Tab order; disabled and hidden controls are skipped. Text fields and sliders keep their own arrow keys. Give an `<hr>` separator `aria-orientation="vertical"` in a horizontal toolbar.
 * @keyboard Tab reaches the last focused control. Left and Right (Up and Down when vertical; mirrored right to left) move between controls, wrapping; Home and End go to the first and last. In a text field or a slider, these keys move the caret or change the value.
 * @previewRole toolbar
 * @useFor Several related actions or formatting controls used together, such as above a table or an editor.
 * @notFor A single action or two (place buttons directly); navigation (use links or odd-side-nav); a menu of commands (use odd-menu).
 * @category Actions
 * @customization 1 2 3
 */
export class OddkinToolbar extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the toolbar.' }),
  orientation: prop.enum(['horizontal', 'vertical'], {
    default: 'horizontal',
    reflect: true,
    description: 'Controls in a row or a column; sets the arrow keys that move between them.',
  }),
}) {
  /** Set while a key press comes from a text field or slider, so the roving focus leaves it alone. */
  #typing = false;
  readonly #roving = new RovingFocus(this.#focusOptions());

  /** @internal The slotted controls that take part in the roving focus. */
  get _items(): HTMLElement[] {
    return [...this.children].filter(isItem);
  }

  /** @internal Controls added or removed: one of them keeps the Tab stop. */
  readonly _onSlotChange = (): void => this.#roving.sync();

  #focusOptions(): RovingFocusOptions {
    const host = this;
    return {
      target: () => this.shadowRoot?.querySelector('[part~="base"]'),
      items: () => (this.#typing ? [] : this._items),
      get orientation() {
        return host.orientation;
      },
    };
  }

  protected override mounted(scope: Scope): void {
    const base = this.shadowRoot!.querySelector('[part~="base"]')!;
    // Registered around the roving focus's own listener, so it sees the flag for this key press.
    scope.listen(base, 'keydown', (event: KeyboardEvent) => {
      this.#typing = keepsKeys(event.composedPath()[0]);
    });
    scope.use(this.#roving);
    scope.listen(base, 'keydown', () => (this.#typing = false));
    scope.effect(() => {
      this.internals.role = 'toolbar';
      this.internals.ariaLabel = this.label || null;
      this.internals.ariaOrientation = this.orientation;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-toolbar': OddkinToolbar;
  }
}
