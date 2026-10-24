import { OddkinElement, prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Release, Scope } from '@oddkin/core/scope';
import { Overlay } from '../overlay/overlay.js';
import { TONES } from '../styles/tone.styles.js';

export const TOAST_STRINGS = {
  close: 'Dismiss',
};

/** A live region shown with its text in it may go unannounced, so the text joins it just after. */
const REVEAL_DELAY = 100;

/** Open toasts in document order: the last sits at the corner. */
const stack: OddkinToast[] = [];
/** Toasts with the pointer or focus on them: while there is one, no toast's time runs. */
const held = new Set<OddkinToast>();

/**
 * A short message about something that just happened, at the block-end and inline-end corner of
 * the viewport: a tone glyph, a title, the message, an optional action, and a close button. It
 * closes by itself after `duration` unless it has an action; no toast's time runs while the
 * pointer or focus is on any open toast, or while the page is hidden (WCAG 2.2.1). Open toasts
 * stack in document order, the last at the corner, so reading and Tab order follow the screen.
 *
 * @slot - The message.
 * @slot end - One action, such as "Undo". A toast with an action stays until it is closed.
 * @csspart base - The glyph, the title, the message, the action, and the close button.
 * @csspart marker - The tone glyph.
 * @csspart label - The title.
 * @csspart close - The close button.
 * @cssprop --odd-toast-inline-size - Its width, within the viewport.
 * @a11y A `status` live region, or an `alert` for `danger`, announced when it opens: its title and message join the region just after it shows. Opening it never moves focus; keep toasts after the controls that raise them, so Tab reaches an action. The close button is named by `strings.close`.
 * @keyboard Tab reaches its action and its close button in document order. Focus in any open toast pauses them all.
 * @previewRole toast
 * @useFor A passing result of the user's action: saved, sent, copied, with Undo or Retry.
 * @notFor A message that must stay with its region (use odd-alert); a decision (use odd-dialog); a field error (use the field's `error`).
 * @category Overlays
 */
export class OddkinToast extends OddkinElement.with({
  tone: prop.enum(TONES, {
    default: 'neutral',
    reflect: true,
    description: 'Meaning colour and glyph; `danger` is an `alert`, announced at once.',
  }),
  label: prop.string({ default: '', description: 'The title, shown above the message.' }),
  duration: prop.number({
    default: 5000,
    description:
      'Milliseconds it stays open, counted only while no open toast has the pointer or focus and the page is visible; read at each opening. 0, or an action in the `end` slot, keeps it open until it is closed.',
  }),
  open: prop.boolean({ reflect: true, description: 'Whether it is shown.' }),
  strings: prop.object<Partial<typeof TOAST_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  readonly #overlay: Overlay = this.#createOverlay();
  #scope: Scope | undefined;
  #size = 0;
  #hovered = false;
  #focused = false;
  #timer: Release | undefined;
  #reveal: Release | undefined;
  #remaining = Infinity;
  #deadline = 0;

  /** @internal Whether the title and message are in the live region yet. */
  readonly _revealed = signal(false);

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof TOAST_STRINGS> = computed(() =>
    strings(TOAST_STRINGS, this.strings),
  );

  /** Shows it and starts its time. */
  show(): void {
    this.#overlay.show();
  }

  /** Closes it; focus inside returns to where it was before it opened. */
  close(): void {
    this.#overlay.hide();
  }

  #createOverlay(): Overlay {
    const host = this;
    return new Overlay({
      host,
      surface: () => host,
      mode: 'manual',
      onToggle: (open) => {
        host.open = open;
        if (open) host.#opened();
        else host.#closed();
      },
    });
  }

  protected override connected(scope: Scope): void {
    this.#scope = scope;
    scope.use(this.#overlay);
    const observer = new ResizeObserver(([entry]) => {
      this.#size = entry?.borderBoxSize[0]?.blockSize ?? 0;
      if (stack.includes(this)) OddkinToast.#restack();
    });
    observer.observe(this);
    scope.add(() => observer.disconnect(), 'toast size');
    const hold = () => OddkinToast.#hold(this, this.#hovered || this.#focused);
    scope.listen(this, 'pointerenter', () => {
      this.#hovered = true;
      hold();
    });
    scope.listen(this, 'pointerleave', () => {
      this.#hovered = false;
      hold();
    });
    scope.listen(this, 'focusin', () => {
      this.#focused = true;
      hold();
    });
    scope.listen(this, 'focusout', () => {
      this.#focused = false;
      hold();
    });
    scope.listen(document, 'visibilitychange', () =>
      document.hidden ? this.#pause() : this.#resume(),
    );
    scope.add(() => {
      this.#hovered = this.#focused = false;
      this.#closed();
      this.#scope = undefined;
      // Removing a popover hides it without a toggle the wiring would hear.
      this.open = false;
    }, 'toast');
  }

  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      this.internals.role = this.tone === 'danger' ? 'alert' : 'status';
    });
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    if (changes.has('open')) this.#overlay.toggle(this.open);
  }

  /** Positions the open toasts from the corner: each above the ones after it in the document. */
  static #restack(): void {
    stack.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    let offset = 0;
    for (let i = stack.length - 1; i >= 0; i--) {
      const toast = stack[i]!;
      toast.style.setProperty('--_toast-offset', `${offset}px`);
      toast.style.setProperty('--_toast-index', String(stack.length - 1 - i));
      offset += toast.#size;
    }
  }

  static #hold(toast: OddkinToast, on: boolean): void {
    if (on) held.add(toast);
    else held.delete(toast);
    for (const open of stack) {
      if (held.size) open.#pause();
      else open.#resume();
    }
  }

  #opened(): void {
    // A close and an open in one task arrive as a single toggle: start over.
    this.#pause();
    this.#reveal?.();
    this._revealed.value = false;
    if (!stack.includes(this)) stack.push(this);
    OddkinToast.#restack();
    const action = this.querySelector(':scope > [slot="end"]');
    this.#remaining = action || !(this.duration > 0) ? Infinity : this.duration;
    this.#resume();
    this.#reveal = this.#scope?.timeout(() => (this._revealed.value = true), REVEAL_DELAY);
  }

  #closed(): void {
    this.#pause();
    this.#remaining = Infinity;
    this.#reveal?.();
    this.#reveal = undefined;
    this._revealed.value = false;
    const index = stack.indexOf(this);
    if (index >= 0) stack.splice(index, 1);
    OddkinToast.#hold(this, false);
    OddkinToast.#restack();
  }

  #pause(): void {
    if (!this.#timer) return;
    this.#timer();
    this.#timer = undefined;
    this.#remaining = Math.max(0, this.#deadline - performance.now());
  }

  #resume(): void {
    const scope = this.#scope;
    if (!scope || this.#timer || this.#remaining === Infinity) return;
    if (held.size || document.hidden) return;
    this.#deadline = performance.now() + this.#remaining;
    this.#timer = scope.timeout(() => this.close(), this.#remaining);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-toast': OddkinToast;
  }
}
