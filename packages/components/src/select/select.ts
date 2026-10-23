import { event, prop, type ElementEvents } from '@oddkin/core/element';
import type { Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { CollectionSource, readOptions, type OptionRecord } from '../collection/collection.js';
import { OddkinFormControl, type FormControlOptions } from '../form-control/form-control.js';

export type { OptionRecord } from '../collection/collection.js';

/** Native `input` events cross the shadow boundary once; declared here for metadata and sync. */
export const selectInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Re-dispatched at the host when the user commits a change (native `change` is not composed). */
export const selectChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * A compact choice of one option in a form: a styled native `<select>`, so the engine's own picker,
 * keyboard, and assistive-technology support come with it. Options come from `<option>` and
 * `<optgroup>` children, written as for a native select (`selected` marks the default), or from
 * `options`. Where `appearance: base-select` is supported, the open picker is drawn as Oddkin's
 * raised listbox surface with option rows; elsewhere the engine draws it.
 *
 * @csspart field - Wrapper of label, description, control, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The native `<select>`.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssprop --odd-field-height - Minimum height (never below the target-size token). Shared by every form control and the field recipe.
 * @cssprop --odd-field-radius - Corner radius. Shared by every form control and the field recipe.
 * @cssprop --odd-field-border-color - Border colour. Shared by every form control and the field recipe.
 * @cssprop --odd-field-background - Background colour. Shared by every form control and the field recipe.
 * @cssstate user-invalid - The field shows its error: `error` is set, or nothing is chosen while `required` after the user left the select or a validity check failed. Matches `aria-invalid` on the inner select; style it with `odd-select:state(user-invalid)`.
 * @a11y `label` names the native select inside the shadow root; a `<label for>` outside it cannot. Description and error are announced through `aria-describedby`; `aria-invalid` is set for `error`, or for a missing choice after the user leaves the select or a validity check fails. The placeholder is a disabled first option, never a substitute for the label.
 * @keyboard Native select behavior: Space, Enter, or Alt+Down opens the picker; Up and Down move; typing jumps to a matching option; Escape closes the picker.
 * @previewRole select
 * @useFor One choice from a short, known list in a form: a role, a region, a sort order.
 * @notFor Several choices, or a list that should stay visible (use odd-listbox); a long list to search (use odd-combobox); actions (use odd-menu).
 * @limitation Option descriptions are each option's tooltip (`title`); the closed select shows the label only.
 * @limitation Under a strict `style-src` Content Security Policy, WebKit reports a `style-src-attr` violation for each native `<select>` from its own rendering; nothing visible is blocked. Allow for it where violations are collected.
 * @category Forms
 */
export class OddkinSelect extends OddkinFormControl.with({
  label: prop.string({ default: '', description: 'Visible label; names the select.' }),
  options: prop.object<readonly OptionRecord[]>({
    description: 'The choices; when set, `<option>` children are ignored.',
  }),
  value: prop.string({
    default: '',
    description: 'Value of the chosen option; the `value` attribute sets the default.',
  }),
  placeholder: prop.string({
    default: '',
    description:
      'Shown, and submitted as an empty value, until an option is chosen; with `required`, it blocks submission. Never a substitute for a label.',
  }),
  required: prop.boolean({ reflect: true, description: 'An option must be chosen to submit.' }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override events = { input: selectInputEvent, change: selectChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinSelect>;

  readonly #source = new CollectionSource<OptionRecord>({
    host: this,
    name: 'options',
    property: () => this.options,
    read: readOptions,
  });
  // The declared default holds until the user or a script chooses.
  #chosen = false;
  #applied: unknown;

  /** @internal The options in use. */
  readonly _options: Readable<readonly OptionRecord[]> = this.#source.records;

  protected override _formOptions(): FormControlOptions {
    return {
      value: () => this.value,
      control: () => this.shadowRoot?.querySelector('select'),
      watch: () => [this.required, this.placeholder, this._options.value],
      onReset: () => {
        this.#chosen = false;
        this.#applyDeclared();
      },
      onRestore: (state) => {
        if (typeof state === 'string') this.value = state;
      },
    };
  }

  // The `value` attribute, else the last `<option selected>`, else (without a placeholder) the
  // first usable option, as a native select shows.
  #applyDeclared(): void {
    if (this.#chosen) return;
    const first = this.placeholder
      ? ''
      : (this._options.peek().find((option) => !option.disabled)?.value ?? '');
    this.#applied = this.value =
      this.getAttribute('value') ?? this.#source.selected.peek().at(-1) ?? first;
  }

  /** @internal Template handler: the user chose an option. */
  readonly _onInput = (event: Event): void => {
    this.value = (event.target as HTMLSelectElement).value;
  };
  /** @internal Template handler: the user committed a change. */
  readonly _onChange = (): void => {
    this.emit(selectChangeEvent);
  };

  protected override connected(scope: Scope): void {
    super.connected(scope);
    scope.use(this.#source);
    // A value set as a property before connecting is the author's, not a default.
    if (this.value && !this.hasAttribute('value')) this.#chosen = true;
    scope.effect(() => {
      void this._options.value;
      void this.placeholder;
      this.#applyDeclared();
    });
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    // A value the user, a script, or a restore set, unlike the declared default, stays.
    if (changes.has('value') && this.value !== this.#applied) this.#chosen = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-select': OddkinSelect;
  }
}
