import { OddkinElement, prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Release, Scope } from '@oddkin/core/scope';
import { composedContains, deepActiveElement, Overlay } from '../overlay/overlay.js';

export const POPOVER_STRINGS = {
  close: 'Close',
};

/** How long interest lasts on the anchor before the popover opens (HTML's `interest-delay-start`). */
const SHOW_DELAY = 500;
/** How long it stays once the pointer and focus have left both (HTML's `interest-delay-end`). */
const HIDE_DELAY = 250;

/**
 * A non-modal surface anchored to the control that opens it. The host is the popover
 * (`popover="auto"`), so `<button popovertarget="id">` opens and closes it with no script; it also
 * closes on Escape, on a press outside, and with its close button, and focus returns to the
 * trigger. With `interest`, it is a hover card: it also opens while the pointer rests on its anchor
 * or the anchor has focus.
 *
 * @slot - The content.
 * @csspart base - The content and the close button, inside the surface.
 * @csspart close - The close button.
 * @cssprop --odd-popover-max-inline-size - The widest it grows before its content wraps.
 * @a11y A non-modal `dialog` named by `label`. Opening it leaves focus where it is; Tab moves from the trigger into it, as for any popover. When it closes with focus inside, focus returns to the element that had it, usually the trigger. The close button is named by `strings.close`. With `interest`, keep it supplementary: what it shows must also be at the anchor's destination, since touch users do not hover; place it right after the anchor so Tab moves from the anchor into it, and add a `popovertarget` button where touch users need the card itself.
 * @keyboard Escape closes it. Tab from the trigger moves into it. With `interest`, focus on the anchor opens it after the delay, and it stays while focus is on the anchor or in it.
 * @previewRole popover
 * @useFor Extra controls or details next to the control that shows them: a share form, settings, a definition.
 * @notFor Content that must be answered before going on (use odd-dialog); a list of actions (use odd-menu); a hint on hover or focus (use odd-tooltip).
 * @category Overlays
 * @customization 1 2 3
 */
export class OddkinPopover extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the popover.' }),
  anchor: prop.string({
    default: '',
    description:
      'The ID of the element it is placed against, in the same document or shadow root. Default: the button whose `popovertarget` names it; with neither, it is centred.',
  }),
  side: prop.enum(['block-end', 'block-start', 'inline-end', 'inline-start'], {
    default: 'block-end',
    description:
      "The side of the anchor it opens on, in the anchor's writing direction; it flips to the other side when there is more room there.",
  }),
  align: prop.enum(['start', 'center', 'end'], {
    default: 'start',
    description: 'How it lines up with the anchor along that side.',
  }),
  noClose: prop.boolean({
    description:
      'Hides the close button. Keep it wherever touch users need it: Safari on iOS before 18.3 does not close a popover on a tap outside.',
  }),
  open: prop.boolean({ reflect: true, description: 'Whether it is open.' }),
  interest: prop.boolean({
    description:
      "A hover card (HTML interest invokers): it also opens once the pointer has rested on its anchor, or the anchor has had focus, for half a second, and closes a quarter of a second after both have left the anchor and the popover. A touch keeps the anchor's own action.",
  }),
  strings: prop.object<Partial<typeof POPOVER_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  readonly #anchorElement = signal<Element | null>(null);
  readonly #overlay: Overlay = this.#createOverlay();

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof POPOVER_STRINGS> = computed(() =>
    strings(POPOVER_STRINGS, this.strings),
  );

  /** The element it is placed against, when it is not found by `anchor` (another tree, or no ID). */
  get anchorElement(): Element | null {
    return this.#anchorElement.value;
  }
  set anchorElement(element: Element | null) {
    this.#anchorElement.value = element;
    this.#overlay.update();
  }

  /** Opens it. */
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
      anchor: () => host._anchor(),
      get side() {
        return host.side;
      },
      get align() {
        return host.align;
      },
      onToggle: (open) => (host.open = open),
    });
  }

  /** @internal The element it is placed against: `anchorElement`, `anchor`, or its invoker. */
  _anchor(): Element | null {
    const explicit = this.#anchorElement.value;
    if (explicit) return explicit;
    const root = this.getRootNode() as Document | ShadowRoot;
    if (this.anchor) return root.getElementById(this.anchor);
    if (!this.id) return null;
    const invokers = [...root.querySelectorAll(`[popovertarget="${CSS.escape(this.id)}"]`)];
    return invokers.find((invoker) => invoker === root.activeElement) ?? invokers[0] ?? null;
  }

  protected override connected(scope: Scope): void {
    scope.use(this.#overlay);
    scope.effect((run) => {
      if (!this.interest) return;
      const anchor = this._anchor();
      if (anchor) untracked(() => this.#attachInterest(anchor, run));
    });
  }

  /** Opens on interest in `anchor` (hover or focus) and closes once both it and the card lose it. */
  #attachInterest(anchor: Element, run: Scope): void {
    let pending: Release | undefined;
    let hovered = false;
    // Closing because interest ended, rather than on Escape, a press outside, or a button.
    let losing = false;
    // Dismissed while interest lasts: it opens again only after the pointer and focus leave.
    let dismissed = false;
    // Focus was in the card when it closed.
    let focused = false;
    const later = (fn: () => void, ms: number) => {
      pending?.();
      pending = run.timeout(fn, ms);
    };
    const within = (node: Node | null) =>
      composedContains(anchor, node) || composedContains(this, node);
    const lose = () =>
      later(() => {
        if (hovered || within(deepActiveElement())) return;
        dismissed = false;
        if (!this.open) return;
        losing = true;
        this.close();
      }, HIDE_DELAY);
    const gain = () => {
      if (!dismissed) later(() => this.show(), this.open ? 0 : SHOW_DELAY);
    };
    for (const target of [anchor, this]) {
      run.listen<PointerEvent>(target, 'pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        hovered = true;
        if (target === anchor) gain();
      });
      run.listen(target, 'pointerleave', () => {
        hovered = false;
        lose();
      });
      run.listen<FocusEvent>(target, 'focusout', (event) => {
        if (!within(event.relatedTarget as Node | null)) lose();
      });
    }
    run.listen(anchor, 'focusin', () => (this.open ? pending?.() : gain()));
    // Synchronous, before focus returns to the anchor, which must not open it again.
    run.listen<ToggleEvent>(this, 'beforetoggle', (event) => {
      if (event.newState !== 'closed') return;
      if (!losing) dismissed = true;
      losing = false;
      focused = composedContains(this, deepActiveElement());
      pending?.();
    });
    // The browser returns focus to where it was when the card opened, often away from the anchor.
    run.listen<ToggleEvent>(this, 'toggle', (event) => {
      if (event.newState === 'closed' && focused) (anchor as HTMLElement).focus();
      focused = false;
    });
  }

  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      this.internals.role = 'dialog';
      this.internals.ariaLabel = this.label || null;
    });
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    if (changes.has('open')) this.#overlay.toggle(this.open);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-popover': OddkinPopover;
  }
}
