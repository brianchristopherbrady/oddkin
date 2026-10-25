import { LiveAnnouncer } from '@oddkin/core/controllers/announce';
import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';
import type { Release, Scope } from '@oddkin/core/scope';

export const COPY_BUTTON_STRINGS = {
  copy: 'Copy',
  copied: 'Copied to clipboard.',
  failed: 'Could not copy. Select the text.',
};

/** How long the Copied state shows before the button returns to its resting look. */
export const COPIED_DURATION = 2000;

/** `odd-copy`: the text that was written to the clipboard. */
export interface CopyDetail {
  readonly value: string;
}

/** The text was written to the clipboard. */
export const copyEvent = event<CopyDetail>('odd-copy', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description: 'The text was written to the clipboard; `detail.value` is the text.',
});

/**
 * A button that copies text to the clipboard: `value`, or the form value or text of the element
 * named by `from`. It says the outcome in words, "Copied to clipboard." for two seconds or "Could
 * not copy. Select the text." (announced as well), and when the browser refuses (no permission, an
 * insecure page, no Clipboard API) it selects the text so the user can copy it by hand.
 *
 * @csspart base - The row of the button and the status.
 * @csspart button - The native button (the small secondary `odd-button` look).
 * @csspart status - The outcome in words.
 * @csspart fallback - The read-only field holding `value` after a failure, selected for a manual copy.
 * @a11y A native button named by its text ("Copy"); the outcome is announced politely (assertively when it fails) and also shown. After a failure without `from`, focus moves to the selected fallback field, so Ctrl+C or Cmd+C copies.
 * @keyboard Tab reaches the button; Enter or Space copies.
 * @previewRole copyButton
 * @useFor Copying an identifier, a code snippet, a link, or a key that people paste elsewhere.
 * @notFor Copying rich content or files; a share action (use the page's share flow).
 * @category Actions
 */
export class OddkinCopyButton extends OddkinElement.with({
  value: prop.string({ default: '', description: 'The text to copy; wins over `from`.' }),
  from: prop.string({
    default: '',
    description:
      'The id of the element whose text is copied (an input or textarea: its value), in the same document or shadow root.',
  }),
  label: prop.string({
    default: '',
    description: 'The button text; default `strings.copy` ("Copy").',
  }),
  disabled: prop.boolean({ reflect: true, description: 'Disables the button.' }),
  strings: prop.object<Partial<typeof COPY_BUTTON_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'odd-copy': copyEvent };
  declare readonly _events?: ElementEvents<typeof OddkinCopyButton>;

  /** @internal The outcome of the last copy. */
  readonly _status = signal<'idle' | 'copied' | 'failed'>('idle');
  /** @internal The text shown in the fallback field after a failure without `from`. */
  readonly _fallback = signal('');

  readonly #announcer = new LiveAnnouncer({
    regions: () => {
      const root = this.shadowRoot;
      const polite = root?.querySelector<HTMLElement>('.polite');
      const assertive = root?.querySelector<HTMLElement>('.assertive');
      return polite && assertive ? { polite, assertive } : null;
    },
  });
  #scope: Scope | undefined;
  #timer: Release | undefined;
  #count = 0;

  /** @internal The button text. */
  get _label(): string {
    return this.label || this.#strings.copy;
  }

  /** @internal The outcome in words, or empty while idle. */
  get _message(): string {
    const status = this._status.value;
    return status === 'idle' ? '' : this.#strings[status];
  }

  get #strings() {
    return strings(COPY_BUTTON_STRINGS, this.strings);
  }

  /** @internal Click on the button. */
  readonly _onClick = (): void => {
    void this.copy();
  };

  protected override mounted(scope: Scope): void {
    this.#scope = scope;
    scope.use(this.#announcer);
    scope.add(() => {
      this.#scope = undefined;
      this.#timer = undefined;
    }, 'copy button');
  }

  /** Copies the text; resolves `true` when the clipboard took it. Ignored while disabled or empty. */
  async copy(): Promise<boolean> {
    const text = this.#text();
    if (this.disabled || !text) return false;
    try {
      // Without the Clipboard API (an insecure page) this throws too.
      await navigator.clipboard.writeText(text);
    } catch {
      this.#settle('failed');
      this.#selectForManualCopy(text);
      return false;
    }
    this.#settle('copied');
    this.emit(copyEvent, { value: text });
    return true;
  }

  /** The element named by `from`, in this element's document or shadow root. */
  #source(): Element | null {
    if (!this.from) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.getElementById?.(this.from) ?? null;
  }

  #text(): string {
    if (this.value) return this.value;
    const source = this.#source();
    if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement)
      return source.value;
    return source?.textContent?.trim() ?? '';
  }

  #settle(status: 'copied' | 'failed'): void {
    this.#timer?.();
    this.#timer = undefined;
    this._fallback.value = '';
    this._status.value = status;
    this.#announcer.announce({
      text: this.#strings[status],
      key: `${status}:${++this.#count}`,
      priority: status === 'failed' ? 'assertive' : 'polite',
    });
    if (status === 'copied')
      this.#timer = this.#scope?.timeout(() => {
        this.#timer = undefined;
        this._status.value = 'idle';
      }, COPIED_DURATION);
  }

  /** Selects the source's text, or shows `text` in a selected read-only field. */
  #selectForManualCopy(text: string): void {
    const source = this.value ? null : this.#source();
    if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement) {
      source.select();
      return;
    }
    if (source) {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
    this._fallback.value = text;
    void this.updateComplete.then(() => {
      const field = this.shadowRoot?.querySelector<HTMLInputElement>('.fallback');
      // Selecting the text also focuses the field, in every engine.
      field?.select();
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-copy-button': OddkinCopyButton;
  }
  interface GlobalEventHandlersEventMap {
    'odd-copy': CustomEvent<CopyDetail>;
  }
}
