import { ResizeController } from '@oddkin/core/controllers/observe';
import { prop, type ElementEvents } from '@oddkin/core/element';
import { format, formatNumber, langOf, strings } from '@oddkin/core/i18n';
import { computed, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { OddkinTextControl, changeEvent, inputEvent } from '../form-control/text-control.js';

export { changeEvent, inputEvent };

export const TEXTAREA_STRINGS = { count: '{count} / {max} characters' };

/**
 * A labelled multi-line text field that participates in forms like a native textarea, with a
 * character count while `maxlength` is set.
 *
 * @csspart field - Wrapper of label, description, control, error, and count.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The native `<textarea>`.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @csspart count - The character count under the field ("12 / 200 characters") while `maxlength` is set and no error shows; referenced by `aria-describedby`, not announced while typing.
 * @cssprop --odd-field-height - Minimum height (never below the target-size token). Shared by every form control and the field recipe.
 * @cssprop --odd-field-radius - Corner radius. Shared by every form control and the field recipe.
 * @cssprop --odd-field-border-color - Border colour. Shared by every form control and the field recipe.
 * @cssprop --odd-field-background - Background colour. Shared by every form control and the field recipe.
 * @cssprop --odd-textarea-max-height - Tallest a `resize="auto"` field grows before it scrolls (default 40vh).
 * @cssstate user-invalid - The field shows its error: `error` is set, or the value is invalid after the user left the field or a validity check failed. Matches `aria-invalid` on the inner control; style it with `odd-textarea:state(user-invalid)`.
 * @a11y `label` names the native textarea inside the shadow root; a `<label for>` outside it cannot. Description, error, and count are announced through `aria-describedby`; `aria-invalid` is set for `error`, or for an invalid value after the user leaves the field or a validity check fails; reset clears it.
 * @keyboard Native textarea behavior: Enter inserts a line break; Tab moves focus.
 * @previewRole textArea
 * @useFor Multi-line text in forms: descriptions, comments, messages.
 * @notFor A single line (use odd-input); rich text.
 * @limitation `resize="auto"` grows with `field-sizing: content` where the engine has it; elsewhere the element measures the field as its value or width changes. iOS and Firefox for Android draw no resize handle.
 * @limitation Validation bubbles anchor to the inner textarea. `formStateRestoreCallback` restores the value; autofill depends on the inner textarea's `autocomplete`.
 * @category Forms
 */
export class OddkinTextarea extends OddkinTextControl.with({
  rows: prop.number({
    default: 4,
    description: 'Visible lines; the least the field shows while `resize` is `auto`.',
  }),
  resize: prop.enum(['vertical', 'none', 'auto'], {
    default: 'vertical',
    reflect: true,
    description:
      'How the field changes height: the user drags it (`vertical`), never (`none`), or it follows its content (`auto`).',
  }),
  strings: prop.object<Partial<typeof TEXTAREA_STRINGS>>({
    description: 'Localized string overrides; `count` takes `{count}` and `{max}`.',
  }),
}) {
  declare readonly _events?: ElementEvents<typeof OddkinTextarea>;

  /** @internal The engine sizes a field to its content; otherwise `resize="auto"` measures it. */
  static _fieldSizing = typeof CSS !== 'undefined' && CSS.supports('field-sizing', 'content');

  /** @internal The count text, bound directly so typing does not re-render the field. */
  readonly _count: Readable<string> = computed(() => {
    const locale = langOf(this);
    return format(strings(TEXTAREA_STRINGS, this.strings).count, {
      count: formatNumber(this.value.length, locale),
      max: formatNumber(this.maxLength ?? 0, locale),
    });
  });

  /** @internal The count shows under a length limit, unless the error takes its place. */
  get _countShown(): boolean {
    return this.maxLength !== undefined && !this.error;
  }

  override get _describedBy(): string | null {
    return [super._describedBy, this._countShown && 'count'].filter(Boolean).join(' ') || null;
  }

  // As a native textarea, the value's line breaks are line feeds.
  protected override _sanitize(text: string): string {
    return text.replace(/\r\n?/g, '\n');
  }

  protected override mounted(scope: Scope): void {
    super.mounted(scope);
    const area = this.shadowRoot!.querySelector('textarea')!;
    let inline = 0;
    const measure = () => {
      area.style.blockSize = 'auto';
      const style = getComputedStyle(area);
      const borders =
        parseFloat(style.borderBlockStartWidth) + parseFloat(style.borderBlockEndWidth);
      area.style.blockSize = `${area.scrollHeight + borders}px`;
    };
    const measured = () => this.resize === 'auto' && !OddkinTextarea._fieldSizing;
    scope.effect(() => {
      area.style.setProperty('--_rows', String(this.rows));
      void this._currentValue.value;
      if (measured()) measure();
      else area.style.removeProperty('block-size');
    });
    // A narrower field wraps more lines.
    const resize = new ResizeController(
      ([entry]) => {
        const size = entry!.borderBoxSize[0]!.inlineSize;
        if (size !== inline && measured()) measure();
        inline = size;
      },
      { targets: () => [area] },
    );
    scope.use(resize);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-textarea': OddkinTextarea;
  }
}
