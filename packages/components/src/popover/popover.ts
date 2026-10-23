import { OddkinElement, prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { computed, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { Overlay } from '../overlay/overlay.js';

export const POPOVER_STRINGS = {
  close: 'Close',
};

/**
 * A non-modal surface anchored to the control that opens it. The host is the popover
 * (`popover="auto"`), so `<button popovertarget="id">` opens and closes it with no script; it also
 * closes on Escape, on a press outside, and with its close button, and focus returns to the
 * trigger.
 *
 * @slot - The content.
 * @csspart base - The content and the close button, inside the surface.
 * @csspart close - The close button.
 * @cssprop --odd-popover-max-inline-size - The widest it grows before its content wraps.
 * @a11y A non-modal `dialog` named by `label`. Opening it leaves focus where it is; Tab moves from the trigger into it, as for any popover. When it closes with focus inside, focus returns to the element that had it, usually the trigger. The close button is named by `strings.close`.
 * @keyboard Escape closes it. Tab from the trigger moves into it.
 * @previewRole popover
 * @useFor Extra controls or details next to the control that shows them: a share form, settings, a definition.
 * @notFor Content that must be answered before going on (use odd-dialog); a list of actions (use odd-menu); a hint on hover or focus (use odd-tooltip).
 * @category Overlays
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
  strings: prop.object<Partial<typeof POPOVER_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  #anchorElement: Element | null = null;
  readonly #overlay: Overlay = this.#createOverlay();

  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof POPOVER_STRINGS> = computed(() =>
    strings(POPOVER_STRINGS, this.strings),
  );

  /** The element it is placed against, when it is not found by `anchor` (another tree, or no ID). */
  get anchorElement(): Element | null {
    return this.#anchorElement;
  }
  set anchorElement(element: Element | null) {
    this.#anchorElement = element;
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
    if (this.#anchorElement) return this.#anchorElement;
    const root = this.getRootNode() as Document | ShadowRoot;
    if (this.anchor) return root.getElementById(this.anchor);
    if (!this.id) return null;
    const invokers = [...root.querySelectorAll(`[popovertarget="${CSS.escape(this.id)}"]`)];
    return invokers.find((invoker) => invoker === root.activeElement) ?? invokers[0] ?? null;
  }

  protected override connected(scope: Scope): void {
    scope.use(this.#overlay);
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
