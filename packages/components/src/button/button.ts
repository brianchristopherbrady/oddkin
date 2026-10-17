import { MoteElement, prop } from '@mote/core/element';
import { signal } from '@mote/core/reactive';
import type { Scope } from '@mote/core/scope';

/**
 * A button for actions. Renders a native `<button>` in its shadow root, so keyboard
 * activation, focus, and accessible naming come from the platform.
 *
 * @slot - The label. Its text is the button's accessible name.
 * @slot start - Content before the label, such as an icon.
 * @slot end - Content after the label.
 * @csspart control - The native button.
 * @csspart spinner - The loading indicator.
 * @cssprop --mote-button-radius - Corner radius.
 * @cssprop --mote-button-background - Background colour.
 * @cssprop --mote-button-color - Text colour.
 * @cssprop --mote-button-border-color - Border colour.
 * @cssprop --mote-button-height - Minimum height (never below the target-size token).
 * @cssprop --mote-button-padding-inline - Inline padding.
 * @a11y The slotted text names the button. Icon-only buttons must set `label`.
 * @a11y `loading` keeps the button focusable and sets `aria-disabled`; announce progress separately if it matters.
 * @keyboard Enter and Space activate the button (native behavior).
 * @previewRole primaryAction
 * @previewRole secondaryAction
 * @useFor Triggering an action, or submitting or resetting the form that contains it.
 * @notFor Navigation to another page; use a link.
 * @limitation In a form, submission goes through a temporary native submit button, so `SubmitEvent.submitter` is that button (carrying `name` and `value`), not this element, and it is removed after dispatch: build `new FormData(form, event.submitter)` synchronously in the `submit` listener. Implicit submission with Enter in a text field does not use this element as the form's default button.
 * @category Actions
 */
export class MoteButton extends MoteElement.with({
  appearance: prop.enum(['primary', 'secondary', 'ghost'], {
    default: 'secondary',
    reflect: true,
    description: 'Visual emphasis.',
  }),
  size: prop.enum(['sm', 'md', 'lg'], { default: 'md', reflect: true, description: 'Size.' }),
  type: prop.enum(['button', 'submit', 'reset'], {
    default: 'button',
    description: 'Form behavior, as on a native button.',
  }),
  disabled: prop.boolean({ reflect: true, description: 'Prevents interaction and focus.' }),
  loading: prop.boolean({
    reflect: true,
    description: 'Shows a spinner and ignores activation; the button stays focusable.',
  }),
  fullWidth: prop.boolean({
    attribute: 'full-width',
    reflect: true,
    description: 'Fills the inline size of its container.',
  }),
  name: prop.string({ default: '', description: 'Name submitted with the form.' }),
  value: prop.string({ default: '', description: 'Value submitted with the form.' }),
  label: prop.string({
    default: '',
    description: 'Accessible name when the content has no text (icon-only buttons).',
  }),
}) {
  static formAssociated = true;
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };

  /** @internal Disabled by an ancestor `<fieldset disabled>`; read by the template. */
  readonly _formDisabled = signal(false);

  /** The form this button belongs to, if any. */
  get form(): HTMLFormElement | null {
    return this.internals.form;
  }

  protected override connected(scope: Scope): void {
    // Capture at the host: runs before listeners the page added to this element.
    scope.listen(
      this,
      'click',
      (event: MouseEvent) => {
        if (this.#ignoresActivation()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        if (this.type === 'button' || !this.internals.form) return;
        // Like a native button's activation behavior, act after dispatch unless prevented.
        scope.timeout(() => {
          if (!event.defaultPrevented && this.isConnected) this.#activate();
        }, 0);
      },
      { capture: true },
    );
  }

  /** Activation is ignored while `disabled`, `loading`, or inside a disabled fieldset. */
  #ignoresActivation(): boolean {
    return this.disabled || this.loading || this._formDisabled.value;
  }

  /** Native callback: an ancestor fieldset's disabled state changed. */
  formDisabledCallback(disabled: boolean): void {
    this._formDisabled.value = disabled;
  }

  #activate(): void {
    const form = this.internals.form;
    if (!form) return;
    // A temporary native button carries name/value, runs constraint validation, and is the
    // submitter the browser reports; it is removed immediately afterwards.
    const proxy = document.createElement('button');
    proxy.type = this.type;
    if (this.name) proxy.name = this.name;
    if (this.value) proxy.value = this.value;
    proxy.hidden = true;
    form.append(proxy);
    try {
      proxy.click();
    } finally {
      proxy.remove();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mote-button': MoteButton;
  }
}
