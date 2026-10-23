import {
  PositionController,
  type Align,
  type Placement,
  type Side,
} from '@oddkin/core/controllers/position';
import { signal, type Readable } from '@oddkin/core/reactive';
import type { Controller, Scope } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import { closeGlyph } from '../styles/glyphs.js';

/**
 * The wiring every anchored overlay shares (component-contracts.md §2.6, ADR 0044): the top layer
 * through `popover`, placement by `@oddkin/core/controllers/position` while open, focus return,
 * the native toggle events re-dispatched at the owning element, and optional dismissal for manual
 * surfaces. Internal to `@oddkin/components`: import it relatively.
 */
export interface OverlayOptions {
  /** The element that owns the overlay; toggle events are re-dispatched at it when the surface is another element. */
  readonly host: HTMLElement;
  /** The `[popover]` element: the host itself, or an element rendered in its shadow root before `connect`. */
  readonly surface: () => HTMLElement | null | undefined;
  /** What the surface is placed against; without one it keeps the browser's centred placement. */
  readonly anchor?: () => Element | null | undefined;
  /** Read at each placement, so a getter follows a live property. Default `'block-end'`. */
  readonly side?: Side;
  /** Read at each placement. Default `'start'`. */
  readonly align?: Align;
  /** Distance from the anchor, in CSS pixels. Default 4. */
  readonly offset?: number;
  /** The `popover` state set when the surface has none. Default `'auto'`: light dismiss and Escape. */
  readonly mode?: 'auto' | 'manual';
  /** A manual surface also closes on Escape within the host, and on a press outside the host and the surface. */
  readonly dismiss?: boolean;
  /** Re-dispatch the surface's toggle events at the host. Default true; false for a nested surface, such as a submenu. */
  readonly relay?: boolean;
  /** Where focus returns on close when it was inside the surface. Default: where it was at open. */
  readonly returnFocus?: () => HTMLElement | null | undefined;
  /** After each open (once shown and placed) or close (before focus returns). */
  readonly onToggle?: (open: boolean) => void;
  /** After each placement. */
  readonly onPlace?: (placement: Placement) => void;
}

/** The focused element, through open shadow roots. */
export function deepActiveElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/** Whether `node` is `container` or inside it in the composed tree (slots and shadow roots). */
export function composedContains(container: Node, node: Node | null): boolean {
  for (let n = node; n; n = (n as Element).assignedSlot ?? n.parentNode ?? (n as ShadowRoot).host)
    if (n === container) return true;
  return false;
}

export class Overlay implements Controller {
  readonly #options: OverlayOptions;
  readonly #open = signal(false);
  readonly #position: PositionController;
  #scope: Scope | undefined;
  #placing: Scope | undefined;
  #dismissal: Scope | undefined;
  #opener: HTMLElement | null = null;
  #restore = false;
  /** The anchor was pressed while the surface was open, so light dismiss has closed it. */
  #pressedOpen = false;

  /** Whether the surface is open; bind a trigger's `aria-expanded` to it. */
  readonly open: Readable<boolean> = this.#open;

  constructor(options: OverlayOptions) {
    this.#options = options;
    const o = options;
    this.#position = new PositionController({
      anchor: () => o.anchor?.(),
      surface: o.surface,
      get side(): Side {
        return o.side ?? 'block-end';
      },
      get align(): Align {
        return o.align ?? 'start';
      },
      offset: o.offset ?? 4,
      viewportMargin: 8,
      onPlace: (placement) => {
        const surface = o.surface();
        if (surface) {
          const sideways = /^(vertical|sideways)/.test(getComputedStyle(surface).writingMode);
          const { availableWidth: width, availableHeight: height, anchor } = placement;
          const style = surface.style;
          style.setProperty('--_overlay-max-inline-size', `${sideways ? height : width}px`);
          style.setProperty('--_overlay-max-block-size', `${sideways ? width : height}px`);
          // A listbox surface is at least as wide as its field (Figma ListboxSurface).
          style.setProperty(
            '--_anchor-inline-size',
            `${sideways ? anchor.height : anchor.width}px`,
          );
        }
        o.onPlace?.(placement);
      },
    });
  }

  /** The last placement, or undefined before the first. */
  get placement(): Placement | undefined {
    return this.#position.placement;
  }

  connect(scope: Scope): void {
    const surface = this.#options.surface();
    if (!surface) return;
    this.#scope = scope;
    if (!surface.hasAttribute('popover')) surface.popover = this.#options.mode ?? 'auto';
    scope.listen<ToggleEvent>(surface, 'beforetoggle', (event) => this.#before(event, surface));
    scope.listen<ToggleEvent>(surface, 'toggle', (event) => this.#toggled(event, surface));
    // The anchor acts as the invoker: pressing it while open closes the surface (light dismiss),
    // and the click that follows must not open it again (`showPopover({ source })`, which says
    // so to the browser, is above the floor).
    const host = this.#options.host;
    scope.listen(
      host,
      'pointerdown',
      (event) => {
        const anchor = this.#options.anchor?.();
        this.#pressedOpen =
          !!anchor && event.composedPath().includes(anchor) && surface.matches(':popover-open');
      },
      true,
    );
    // A keyboard activation never follows such a press (a press dragged away leaves the flag set).
    scope.listen(host, 'keydown', () => (this.#pressedOpen = false), true);
    // Disconnected: the browser hides the surface without toggle events, so focus stays put; the
    // per-open scopes are gone with this one.
    scope.add(() => {
      this.#placing = undefined;
      this.#dismissal = undefined;
    }, 'overlay state');
    this.#open.value = surface.matches(':popover-open');
    this.#startPlacing();
  }

  show(): void {
    const surface = this.#options.surface();
    if (surface?.isConnected && !surface.matches(':popover-open')) surface.showPopover();
  }

  hide(): void {
    const surface = this.#options.surface();
    if (surface?.matches(':popover-open')) surface.hidePopover();
  }

  toggle(force?: boolean): void {
    const pressed = this.#pressedOpen;
    this.#pressedOpen = false;
    const open = force ?? (!pressed && !this.#options.surface()?.matches(':popover-open'));
    if (open) this.show();
    else this.hide();
  }

  /** Place again now, e.g. after the content changed size; does nothing while closed. */
  update(): void {
    this.#position.update();
  }

  /**
   * Placement starts once the surface shows: in the frame after `beforetoggle` (which runs before
   * the surface is showing; a native invoker gives no later synchronous hook), or at `toggle` if
   * that comes first, so `onToggle(true)` always follows the first placement.
   */
  #startPlacing(): void {
    if (this.#placing || !this.#scope || !this.#options.surface()?.matches(':popover-open')) return;
    this.#placing = this.#scope.child({ name: 'overlay placement' });
    this.#placing.use(this.#position);
  }

  #stopPlacing(): void {
    this.#placing?.dispose();
    this.#placing = undefined;
  }

  #before(event: ToggleEvent, surface: HTMLElement): void {
    const host = this.#options.host;
    if (surface !== host && this.#options.relay !== false) {
      const relay = new ToggleEvent('beforetoggle', {
        oldState: event.oldState,
        newState: event.newState,
        cancelable: event.cancelable,
      });
      host.dispatchEvent(relay);
      if (relay.defaultPrevented) {
        event.preventDefault();
        return;
      }
    }
    if (event.newState === 'open') {
      this.#opener = deepActiveElement() as HTMLElement | null;
      let release = () => {};
      const frame = requestAnimationFrame(() => {
        release();
        this.#startPlacing();
      });
      release = this.#scope?.add(() => cancelAnimationFrame(frame), 'overlay frame') ?? release;
    } else {
      this.#restore = composedContains(surface, deepActiveElement());
      this.#stopPlacing();
    }
  }

  #toggled(event: ToggleEvent, surface: HTMLElement): void {
    const open = surface.matches(':popover-open');
    this.#open.value = open;
    const host = this.#options.host;
    if (surface !== host && this.#options.relay !== false)
      host.dispatchEvent(
        new ToggleEvent('toggle', { oldState: event.oldState, newState: event.newState }),
      );
    if (open) this.#startPlacing();
    if (open && this.#options.dismiss && !this.#dismissal) this.#listenForDismissal(surface);
    if (open) {
      this.#options.onToggle?.(true);
      return;
    }
    this.#dismissal?.dispose();
    this.#dismissal = undefined;
    this.#options.onToggle?.(false);
    if (this.#restore) {
      this.#restore = false;
      // Unless focus deliberately moved elsewhere (ADR 0044 §6).
      const active = deepActiveElement();
      if (!active || active === document.body || composedContains(surface, active))
        (this.#options.returnFocus?.() ?? this.#opener)?.focus();
    }
  }

  #listenForDismissal(surface: HTMLElement): void {
    const scope = (this.#dismissal = this.#scope?.child({ name: 'overlay dismissal' }));
    if (!scope) return;
    const host = this.#options.host;
    // Only while open, so Escape on a closed overlay reaches the host's own handlers.
    scope.listen<KeyboardEvent>(host, 'keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      this.hide();
    });
    scope.listen(
      document,
      'pointerdown',
      (event) => {
        const path = event.composedPath();
        if (!path.includes(host) && !path.includes(surface)) this.hide();
      },
      true,
    );
  }
}

/** The explicit close control every dismissible surface carries (iOS floor exception, §2.6). */
export const closeButton = (label: string | Readable<string>, onClose: () => void) =>
  html`<button
    part="close"
    class="overlay-close"
    type="button"
    aria-label=${label}
    @click=${onClose}
  >
    ${closeGlyph}
  </button>`;
