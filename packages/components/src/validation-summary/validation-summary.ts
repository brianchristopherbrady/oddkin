import { OddkinElement, prop } from '@oddkin/core/element';
import { format, langOf, plural, strings } from '@oddkin/core/i18n';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { firstFocusable } from '../overlay/dialog.js';
import { composedContains, deepActiveElement } from '../overlay/overlay.js';

export const VALIDATION_SUMMARY_STRINGS = {
  title: 'Please fix {count} fields',
  titleOne: 'Please fix {count} field',
  entry: '{label} — {message}',
};

/** One invalid control as the summary lists it. */
export interface ValidationEntry {
  readonly control: HTMLElement;
  readonly label: string;
  readonly message: string;
}

type Control = HTMLElement & {
  readonly willValidate?: boolean;
  readonly validity?: ValidityState;
  readonly validationMessage?: string;
  readonly form?: HTMLFormElement | null;
  readonly labels?: NodeListOf<HTMLLabelElement> | null;
  readonly label?: unknown;
  readonly type?: string;
  readonly name?: string;
};

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/** The control's visible name: its `label`, its `<label>`s, its ARIA name, its text, or its name. */
function labelOf(control: Control): string {
  if (typeof control.label === 'string' && clean(control.label)) return clean(control.label);
  if (control instanceof HTMLInputElement && control.type === 'radio') {
    const legend = control.closest('fieldset')?.querySelector(':scope > legend');
    if (legend) return clean(legend.textContent);
  }
  if (control.labels?.length)
    return clean([...control.labels].map((label) => label.textContent).join(' '));
  const root = control.getRootNode() as Document | ShadowRoot;
  const labelledBy = clean(
    (control.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .map((id) => (id ? root.getElementById(id)?.textContent : ''))
      .join(' '),
  );
  if (labelledBy) return labelledBy;
  const aria = clean(control.getAttribute('aria-label'));
  if (aria) return aria;
  const text = control.localName.includes('-') ? clean(control.textContent) : '';
  return text || clean(control.getAttribute('name'));
}

const invalid = (control: Control) => !!control.willValidate && control.validity?.valid === false;

/**
 * Lists a form's problems after a submission that validation blocked: a heading with the count,
 * then each invalid control's label and message as a link that moves focus to the control. It
 * takes focus when it appears, shrinks as fields are fixed, and hides once the form is valid.
 * Entered values are never cleared.
 *
 * @csspart base - The surface; takes focus when the summary appears.
 * @csspart marker - The danger glyph.
 * @csspart label - The heading.
 * @csspart list - The list of problems.
 * @csspart link - A problem: the control's label and message, linking to the control.
 * @a11y A `role="group"` named by its heading. After a blocked submission it receives focus (`tabindex="-1"`), so the heading and the problems are read first; each link moves focus to its control. The browser's own validation bubbles are not shown while the summary reports the problems.
 * @keyboard Tab moves through the links; Enter on a link moves focus to that control.
 * @previewRole validationSummary
 * @useFor Forms with several fields, where a failed submission should say what to fix in one place.
 * @notFor One field's error (use the field's `error`); a failed save after a valid submission (use odd-alert).
 * @limitation It reports submissions the user starts inside the form (a click on a submit button there, or Enter in a field). `form.requestSubmit()` and `form.checkValidity()` called by a script, and a submit button outside the form (its `form` attribute), leave it hidden. A form with `novalidate` is never blocked, so the summary never shows.
 * @limitation The form is found when the summary connects or its `form` attribute changes: the ancestor form, or the form with that ID in the same document or shadow root.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinValidationSummary extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'The heading; default `strings.title`, "Please fix {count} fields".',
  }),
  form: prop.string({
    default: '',
    description: 'ID of the form it reports on; default: the ancestor form.',
  }),
  strings: prop.object<Partial<typeof VALIDATION_SUMMARY_STRINGS>>({
    description: 'Localized string overrides: `title`, `titleOne` (one problem), `entry`.',
  }),
}) {
  /** @internal The problems shown, in form order (empty while hidden). */
  readonly _entries = signal<readonly ValidationEntry[]>([]);
  // A submission the user started is running; `#reported` once its problems were read.
  #attempt = false;
  #reported = false;
  #focusPending = false;
  #refreshQueued = false;

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof VALIDATION_SUMMARY_STRINGS> = computed(() =>
    strings(VALIDATION_SUMMARY_STRINGS, this.strings),
  );

  /** @internal The heading: `label`, or the count in the page language. */
  readonly _heading: Readable<string> = computed(() => {
    if (this.label) return this.label;
    const s = this._strings.value;
    return plural(this._entries.value.length, { one: s.titleOne, other: s.title }, langOf(this));
  });

  /** @internal What a link says. */
  _text(entry: ValidationEntry): string {
    if (!entry.label) return entry.message;
    return format(this._strings.value.entry, { label: entry.label, message: entry.message });
  }

  /** @internal Link handler: focus the control (or its first focusable part) instead of navigating. */
  _focus(event: Event, control: HTMLElement): void {
    event.preventDefault();
    control.focus();
    if (!composedContains(control, deepActiveElement())) firstFocusable(control)?.focus();
  }

  #formElement(): HTMLFormElement | null {
    const id = this.form;
    if (!id) return this.closest('form');
    const root = this.getRootNode() as Document | ShadowRoot;
    const form = root.getElementById?.(id);
    return form instanceof HTMLFormElement ? form : null;
  }

  #read(form: HTMLFormElement): ValidationEntry[] {
    const radios = new Set<string>();
    const entries: ValidationEntry[] = [];
    for (const element of form.elements) {
      const control = element as Control;
      if (!invalid(control)) continue;
      if (control instanceof HTMLInputElement && control.type === 'radio' && control.name) {
        if (radios.has(control.name)) continue;
        radios.add(control.name);
      }
      entries.push({
        control,
        label: labelOf(control),
        message: clean(control.validationMessage),
      });
    }
    return entries;
  }

  #refresh(): void {
    const kept = this._entries.value.filter((entry) => invalid(entry.control as Control));
    this._entries.value = kept.map((entry) => ({
      control: entry.control,
      label: labelOf(entry.control as Control),
      message: clean((entry.control as Control).validationMessage),
    }));
  }

  protected override connected(scope: Scope): void {
    scope.effect((run) => {
      const form = this.#formElement();
      if (!form) return;
      // A submission the user starts: activation of a submit button or Enter in a field. The
      // browser validates in the same task, so the flag ends with it.
      const start = () => {
        this.#attempt = true;
        run.timeout(() => (this.#attempt = this.#reported = false), 0);
      };
      run.listen(
        form,
        'click',
        (event: Event) => {
          const submitter = event
            .composedPath()
            .some(
              (node) =>
                (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) &&
                (node.type === 'submit' || node.type === 'image'),
            );
          if (submitter) start();
        },
        true,
      );
      run.listen(
        form,
        'keydown',
        (event: KeyboardEvent) => {
          if (event.key === 'Enter') start();
        },
        true,
      );
      run.listen(
        form,
        'invalid',
        (event: Event) => {
          if (!this.#attempt) return;
          // The summary reports the problems, so the browser's bubble and focus move stay away.
          event.preventDefault();
          if (this.#reported) return;
          this.#reported = this.#focusPending = true;
          this._entries.value = this.#read(form);
        },
        true,
      );
      const queueRefresh = () => {
        if (this.#refreshQueued || !this._entries.value.length) return;
        this.#refreshQueued = true;
        // After the controls' own validity updates for this edit.
        run.timeout(() => {
          this.#refreshQueued = false;
          this.#refresh();
        }, 0);
      };
      run.listen(form, 'input', queueRefresh);
      run.listen(form, 'change', queueRefresh);
      const clear = () => (this._entries.value = []);
      run.listen(form, 'reset', clear);
      run.listen(form, 'submit', clear);
    });
  }

  protected override mounted(scope: Scope): void {
    scope.effect(
      () => {
        if (!this._entries.value.length || !this.#focusPending) return;
        this.#focusPending = false;
        untracked(() => this.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')?.focus());
      },
      { phase: 'post', name: '<odd-validation-summary> focus' },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-validation-summary': OddkinValidationSummary;
  }
}
