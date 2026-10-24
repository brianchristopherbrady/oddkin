import { OddkinElement, prop } from '@oddkin/core/element';
import { signal, untracked } from '@oddkin/core/reactive';
import type { Release, Scope } from '@oddkin/core/scope';
import { Overlay, composedContains, deepActiveElement } from '../overlay/overlay.js';

/** An Oddkin control that renders other elements' descriptions itself (component-contracts.md §2.4). */
interface Describable extends Element {
  _describe?(source: object, text: string | null): void;
}

/** How long the pointer rests on the anchor before the tooltip shows; focus shows it at once. */
const SHOW_DELAY = 500;
/** How long it stays after the pointer leaves, so the pointer can move onto it. */
const HIDE_DELAY = 100;
let ids = 0;

/**
 * A short description of the control it is anchored to, shown while the pointer rests on the
 * control or the control has focus. It stays while the pointer is over the control or the tooltip,
 * and until Escape (WCAG 1.4.13). It describes the control and is never its name.
 *
 * @slot - The text: a short phrase, nothing interactive.
 * @csspart base - The text, inside the surface.
 * @cssprop --odd-tooltip-max-inline-size - The widest it grows before its text wraps.
 * @a11y A `tooltip` that describes its anchor: a native anchor gets its `id` in `aria-describedby` (an `id` is generated when it has none); an Oddkin control adds its text to its inner control's description. Give the anchor its own name. It takes no focus.
 * @keyboard Focus on the anchor shows it; Escape hides it until the anchor is hovered or focused again.
 * @previewRole tooltip
 * @useFor A short hint about a control: what an icon button does, a keyboard shortcut.
 * @notFor Content to read at length or interact with (use odd-popover); a control's only name (use its label).
 * @category Overlays
 */
export class OddkinTooltip extends OddkinElement.with({
  anchor: prop.string({
    default: '',
    description:
      'The ID of the element it describes and is placed against, in the same document or shadow root.',
  }),
  side: prop.enum(['block-start', 'block-end', 'inline-start', 'inline-end'], {
    default: 'block-start',
    description:
      "The side of the anchor it shows on, in the anchor's writing direction; it flips when there is more room on the other side.",
  }),
  align: prop.enum(['center', 'start', 'end'], {
    default: 'center',
    description: 'How it lines up with the anchor along that side.',
  }),
  open: prop.boolean({ reflect: true, description: 'Whether it is shown.' }),
}) {
  readonly #anchorElement = signal<Element | null>(null);
  readonly #overlay: Overlay = this.#createOverlay();

  /** The element it describes, when it is not found by `anchor` (another tree, or no ID). */
  get anchorElement(): Element | null {
    return this.#anchorElement.value;
  }
  set anchorElement(element: Element | null) {
    this.#anchorElement.value = element;
  }

  /** Shows it. */
  show(): void {
    this.#overlay.show();
  }

  /** Hides it. */
  close(): void {
    this.#overlay.hide();
  }

  #createOverlay(): Overlay {
    const host = this;
    return new Overlay({
      host,
      surface: () => host,
      anchor: () => host._anchor(),
      mode: 'manual',
      get side() {
        return host.side;
      },
      get align() {
        return host.align;
      },
      onToggle: (open) => (host.open = open),
    });
  }

  /** @internal The element it describes: `anchorElement`, else `anchor`. */
  _anchor(): Element | null {
    const explicit = this.#anchorElement.value;
    if (explicit) return explicit;
    if (!this.anchor) return null;
    return (this.getRootNode() as Document | ShadowRoot).getElementById(this.anchor);
  }

  protected override connected(scope: Scope): void {
    if (!this.id) this.id = `odd-tooltip-${++ids}`;
    scope.use(this.#overlay);
    scope.effect((run) => {
      const anchor = this._anchor();
      // Only the anchor is tracked: describing an Oddkin control reads and writes its signals.
      if (anchor) untracked(() => this.#attach(anchor, run));
    });
  }

  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      this.internals.role = 'tooltip';
    });
  }

  protected override updated(changes: ReadonlyMap<string, unknown>): void {
    if (changes.has('open')) this.#overlay.toggle(this.open);
  }

  #attach(anchor: Element, run: Scope): void {
    let pending: Release | undefined;
    let hovered = false;
    const later = (fn: () => void, ms: number) => {
      pending?.();
      pending = run.timeout(fn, ms);
    };
    const leave = () => {
      hovered = false;
      later(() => {
        if (!hovered && !composedContains(anchor, deepActiveElement())) this.close();
      }, HIDE_DELAY);
    };
    run.listen<PointerEvent>(anchor, 'pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      hovered = true;
      later(() => this.show(), this.open ? 0 : SHOW_DELAY);
    });
    run.listen(anchor, 'pointerleave', leave);
    run.listen(this, 'pointerenter', () => {
      hovered = true;
      pending?.();
    });
    run.listen(this, 'pointerleave', leave);
    run.listen(anchor, 'focusin', () => {
      pending?.();
      this.show();
    });
    run.listen<FocusEvent>(anchor, 'focusout', (event) => {
      if (composedContains(anchor, event.relatedTarget as Node | null)) return;
      pending?.();
      if (!hovered) this.close();
    });
    // Dismissible: Escape hides it wherever focus is, before anything else takes the key.
    run.listen<KeyboardEvent>(
      document,
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || !this.open) return;
        event.preventDefault();
        pending?.();
        this.close();
      },
      true,
    );
    this.#describe(anchor, run);
  }

  #describe(anchor: Element, run: Scope): void {
    const target = anchor as Describable;
    if (typeof target._describe === 'function') {
      const update = () => target._describe!(this, this.textContent?.trim() || null);
      update();
      const observer = new MutationObserver(update);
      observer.observe(this, { childList: true, characterData: true, subtree: true });
      run.add(() => {
        observer.disconnect();
        target._describe!(this, null);
      }, 'tooltip description');
      return;
    }
    const tokens = () =>
      (anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    if (!tokens().includes(this.id))
      anchor.setAttribute('aria-describedby', [...tokens(), this.id].join(' '));
    run.add(() => {
      const rest = tokens().filter((token) => token !== this.id);
      if (rest.length) anchor.setAttribute('aria-describedby', rest.join(' '));
      else anchor.removeAttribute('aria-describedby');
    }, 'tooltip description');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-tooltip': OddkinTooltip;
  }
}
