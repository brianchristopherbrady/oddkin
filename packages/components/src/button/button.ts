import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

/**
 * A button for actions. Renders a native `<button>` in its shadow root, so keyboard
 * activation, focus, and accessible naming come from the platform.
 *
 * In a form it submits or resets through a temporary native button (see the limitations).
 * Where native submit-button semantics matter, style a native `<button class="odd-button">`
 * with `@oddkin/components/css/button.css`, which looks the same.
 *
 * @slot - The label. Its text is the button's accessible name.
 * @slot start - Content before the label, such as an icon.
 * @slot end - Content after the label.
 * @csspart control - The native button.
 * @csspart spinner - The loading indicator.
 * @cssprop --odd-button-radius - Corner radius.
 * @cssprop --odd-button-background - Background colour.
 * @cssprop --odd-button-color - Text colour.
 * @cssprop --odd-button-border-color - Border colour.
 * @cssprop --odd-button-height - Minimum height (never below the target-size token).
 * @cssprop --odd-button-padding-inline - Inline padding.
 * @a11y The slotted text names the button. Icon-only buttons must set `label`.
 * @a11y `loading` keeps the button focusable and sets `aria-disabled`; announce progress separately if it matters.
 * @keyboard Enter and Space activate the button (native behavior).
 * @previewRole primaryAction
 * @previewRole secondaryAction
 * @useFor Triggering an action, or submitting or resetting the form it belongs to (its ancestor form or the one named by `form`).
 * @notFor Navigation to another page; use a link.
 * @limitation In a form, submission and reset go through a temporary native button appended to the form during the click. `SubmitEvent.submitter` is that button (with `name`, `value`, and the `form*` overrides), not this element, and it is removed after dispatch, so build `new FormData(form, event.submitter)` synchronously in the `submit` listener. Mutation observers on the form see it added and removed. `form.requestSubmit(button)` rejects this element with a `TypeError`; call `button.click()` instead.
 * @limitation Implicit submission: Enter in a text field never uses this element as the default button. The default button is the form's first native submit button; without one, Enter submits with no submitter, and only when the form has a single text field, so this element's `name`, `value`, and overrides are not sent. Use a native submit button where Enter must submit through it.
 * @limitation `formAction`, `formMethod`, `formEnctype`, and `formTarget` return the attribute text: unlike a native button they neither resolve URLs nor report the form's values. The temporary button receives them unchanged, so missing and invalid values behave as on a native button.
 * @category Actions
 */
export class OddkinButton extends OddkinElement.with({
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
  formAction: prop.string({
    attribute: 'formaction',
    reflect: true,
    description: "URL this button submits to instead of the form's `action`.",
  }),
  formMethod: prop.string({
    attribute: 'formmethod',
    reflect: true,
    description: "Method (`get`, `post`, `dialog`) this button submits with instead of the form's.",
  }),
  formEnctype: prop.string({
    attribute: 'formenctype',
    reflect: true,
    description: "Encoding this button submits with instead of the form's `enctype`.",
  }),
  formTarget: prop.string({
    attribute: 'formtarget',
    reflect: true,
    description: "Navigable this button submits to instead of the form's `target`.",
  }),
  formNoValidate: prop.boolean({
    attribute: 'formnovalidate',
    reflect: true,
    description: 'Submits without constraint validation.',
  }),
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
    // A temporary native button carries name, value, and the submission overrides, runs
    // constraint validation, and is the submitter the browser reports; it is removed right after.
    const proxy = document.createElement('button');
    proxy.type = this.type;
    if (this.name) proxy.name = this.name;
    if (this.value) proxy.value = this.value;
    if (this.type === 'submit') {
      const overrides = {
        formaction: this.formAction,
        formmethod: this.formMethod,
        formenctype: this.formEnctype,
        formtarget: this.formTarget,
      };
      for (const [attribute, value] of Object.entries(overrides))
        if (value !== undefined) proxy.setAttribute(attribute, value);
      proxy.formNoValidate = this.formNoValidate;
    }
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
    'odd-button': OddkinButton;
  }
}
