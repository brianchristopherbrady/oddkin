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

/** `odd-announce`: a status message for the announcer of the surface around its sender. */
export interface AnnounceDetail {
  readonly text: string;
  readonly priority: 'polite' | 'assertive';
  /** Identical keys are announced once per surface. */
  readonly key: string;
}

/** The outcome, for the announcer of the surface around the button (as `@oddkin/ai` routes it). */
const announceEvent = event<AnnounceDetail>('odd-announce', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'notification',
  description:
    'The outcome for the surrounding announcer, which cancels it; else the button says it.',
});

/** Keys stay unique across buttons, since one surface announcer hears them all. */
let copies = 0;

/**
 * A button that copies text to the clipboard: `value`, or the form value or text of the element
 * named by `from`. A copy is confirmed by "Copied to clipboard." in a small popover beside the
 * button for two seconds, so nothing on the page moves. When the browser refuses (no permission, an
 * insecure page, no Clipboard API) it says "Could not copy. Select the text." beside the button and
 * selects the text so the user can copy it by hand. Both outcomes are announced.
 *
 * @csspart base - The row of the button and the status.
 * @csspart button - The native button (the small secondary `odd-button` look).
 * @csspart status - The failure in words.
 * @csspart confirmation - The popover that confirms a copy, in the top layer above the button (below it when there is no room); it takes no focus and goes after two seconds or on scroll.
 * @csspart fallback - The read-only field holding `value` after a failure (a text area when it has line breaks), selected for a manual copy.
 * @a11y A native button named by its text ("Copy"); the outcome is announced politely (assertively when it fails): by the surrounding surface's announcer when one takes the `odd-announce` event (an `@oddkin/ai` conversation, `createAnnouncer`), otherwise by the button's own live regions. The confirmation popover is hidden from assistive technology, which hears the announcement instead. After a failure without `from`, focus moves to the selected fallback field, so Ctrl+C or Cmd+C copies.
 * @keyboard Tab reaches the button; Enter or Space copies.
 * @previewRole copyButton
 * @useFor Copying an identifier, a code snippet, a link, or a key that people paste elsewhere.
 * @notFor Copying rich content or files; a share action (use the page's share flow).
 * @category Actions
 * @customization 1 2 3
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
  static override events = { 'odd-copy': copyEvent, 'odd-announce': announceEvent };
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
  #release: Release | undefined;

  /** @internal The button text. */
  get _label(): string {
    return this.label || this.#strings.copy;
  }

  /** @internal The words for the confirmation and for a failure. */
  get _strings(): typeof COPY_BUTTON_STRINGS {
    return this.#strings;
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
      this.#release = undefined;
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
    const outcome = {
      text: this.#strings[status],
      key: `copy-${status}:${++copies}`,
      priority: status === 'failed' ? 'assertive' : 'polite',
    } as const;
    // One announcer per surface: the surrounding one cancels the event; otherwise say it here.
    if (this.emit(announceEvent, outcome)) this.#announcer.announce(outcome);
    this.#release?.();
    this.#release = undefined;
    if (status === 'copied') {
      void this.updateComplete.then(() => this.#confirm());
      this.#timer = this.#scope?.timeout(() => {
        this.#timer = undefined;
        this._status.value = 'idle';
        this.#dismiss();
      }, COPIED_DURATION);
    } else this.#dismiss();
  }

  /**
   * Shows the confirmation above the button, or below it when there is no room above. While it
   * shows, it follows the button when a box around it changes size (a parent that narrows, text
   * above that grows); a scroll dismisses it.
   */
  #confirm(): void {
    const popup = this.shadowRoot?.querySelector<HTMLElement>('.confirmation');
    const button = this.shadowRoot?.querySelector('button');
    if (!popup || !button || !this.isConnected || this._status.value !== 'copied') return;
    if (!popup.matches(':popover-open')) popup.showPopover();
    const place = () => {
      const anchor = button.getBoundingClientRect();
      const { width, height } = popup.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(popup).rowGap) || 0;
      const above = anchor.top - gap - height;
      const room = document.documentElement.clientWidth - width;
      popup.style.top = `${above >= 0 ? above : anchor.bottom + gap}px`;
      popup.style.left = `${Math.max(0, Math.min(anchor.left + (anchor.width - width) / 2, room))}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    for (let el: Element | null = button; el;) {
      observer.observe(el);
      el =
        el.assignedSlot ?? el.parentElement ?? (el.parentNode as ShadowRoot | null)?.host ?? null;
    }
    // Scroll events stay in their tree: listen in every tree between the button and the page.
    // The observer belongs to the scope too, so removing the button mid-confirmation ends it.
    const releases: Release[] = [
      this.#scope!.add(() => observer.disconnect(), 'copy confirmation'),
    ];
    for (let node: Node = this; ; node = (node as ShadowRoot).host) {
      node = node.getRootNode();
      releases.push(this.#scope!.listen(node, 'scroll', () => this.#dismiss(), { capture: true }));
      if (!(node instanceof ShadowRoot)) break;
    }
    this.#release = () => releases.forEach((release) => release());
  }

  #dismiss(): void {
    this.#release?.();
    this.#release = undefined;
    const popup = this.shadowRoot?.querySelector<HTMLElement>('.confirmation');
    if (popup?.matches(':popover-open')) popup.hidePopover();
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
      const field = this.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '.fallback',
      );
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
    'odd-announce': CustomEvent<AnnounceDetail>;
  }
}
