/**
 * `@oddkin/core/controllers/position` — places a top-layer surface (a `popover`) against an anchor
 * from measured rectangles (ADR 0044). Unbranded; listens only while the surface is open.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import type { Controller, Scope } from '../scope/index.js';

/** A side of the anchor, in the anchor's writing mode and direction. */
export type Side = 'block-start' | 'block-end' | 'inline-start' | 'inline-end';
/** Alignment along the anchor's other axis. */
export type Align = 'start' | 'center' | 'end';

export interface Placement {
  /** The side used, after flipping. */
  readonly side: Side;
  /** Viewport coordinates of the surface's top-left corner, as written. */
  readonly x: number;
  readonly y: number;
  /** Room for the surface on the side used, and across it, in CSS pixels. */
  readonly availableWidth: number;
  readonly availableHeight: number;
  /** The anchor's rectangle when placed. */
  readonly anchor: DOMRectReadOnly;
}

export interface PositionOptions {
  readonly anchor: () => Element | null | undefined;
  /** A `popover` element: placed while open, in the top layer, where it is in the DOM. */
  readonly surface: () => HTMLElement | null | undefined;
  /** Default `'block-end'`. */
  readonly side?: Side;
  /** Default `'start'`. */
  readonly align?: Align;
  /** Distance between anchor and surface, in CSS pixels. Default 0. */
  readonly offset?: number;
  /** Distance kept from the viewport's edges, in CSS pixels. Default 0. */
  readonly viewportMargin?: number;
  /** Use the opposite side when it has more room and the surface does not fit. Default true. */
  readonly flip?: boolean;
  /** Move along the other axis to stay inside the viewport. Default true. */
  readonly shift?: boolean;
  /** Called after each placement, e.g. to size the surface to `availableHeight`. */
  readonly onPlace?: (placement: Placement) => void;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
const vertical = (edge: Edge) => edge === 'top' || edge === 'bottom';

/** The composed-tree parent, so scroll containers outside shadow roots are found. */
const parentOf = (el: Element): Element | null =>
  el.assignedSlot ?? el.parentElement ?? (el.parentNode as ShadowRoot | null)?.host ?? null;

export class PositionController implements Controller {
  readonly #options: PositionOptions;
  #stop: (() => void) | undefined;
  #placement: Placement | undefined;

  constructor(options: PositionOptions) {
    this.#options = options;
  }

  /** The last placement, or undefined before the first. */
  get placement(): Placement | undefined {
    return this.#placement;
  }

  connect(scope: Scope): void {
    const surface = this.#options.surface();
    if (!surface) return;
    const start = () => {
      if (!this.#stop && surface.isConnected && surface.matches(':popover-open')) this.#start();
    };
    // `beforetoggle` is synchronous (`toggle` is a later task): open places in a microtask, when
    // the surface is shown and measurable but not yet painted; close stops at once.
    const before = (event: Event) => {
      if ((event as ToggleEvent).newState === 'open') queueMicrotask(start);
      else this.#halt();
    };
    surface.addEventListener('beforetoggle', before);
    scope.add(() => {
      surface.removeEventListener('beforetoggle', before);
      this.#halt();
    }, 'position');
    start();
  }

  /** Place again now; does nothing while the surface is closed. */
  update(): void {
    if (this.#stop) this.#place();
  }

  #halt(): void {
    this.#stop?.();
    this.#stop = undefined;
  }

  #start(): void {
    const anchor = this.#options.anchor();
    const surface = this.#options.surface();
    if (!anchor || !surface) return;
    const place = () => this.#place();
    const targets: EventTarget[] = [window];
    for (let el = parentOf(anchor); el; el = parentOf(el)) {
      const style = getComputedStyle(el);
      if (/auto|scroll|hidden|overlay/.test(style.overflowX + style.overflowY)) targets.push(el);
    }
    if (window.visualViewport) targets.push(window.visualViewport);
    for (const target of targets) {
      target.addEventListener('scroll', place, { passive: true });
      target.addEventListener('resize', place, { passive: true });
    }
    const resize = new ResizeObserver(place);
    resize.observe(anchor);
    resize.observe(surface);
    this.#stop = () => {
      resize.disconnect();
      for (const target of targets) {
        target.removeEventListener('scroll', place);
        target.removeEventListener('resize', place);
      }
    };
    this.#place();
  }

  #place(): void {
    const o = this.#options;
    const anchor = o.anchor();
    const surface = o.surface();
    if (!anchor?.isConnected || !surface?.isConnected) return;
    const offset = o.offset ?? 0;
    const margin = o.viewportMargin ?? 0;
    const view = window.visualViewport;
    const left = (view?.offsetLeft ?? 0) + margin;
    const top = (view?.offsetTop ?? 0) + margin;
    const right = (view ? view.offsetLeft + view.width : innerWidth) - margin;
    const bottom = (view ? view.offsetTop + view.height : innerHeight) - margin;

    const { writingMode: mode, direction } = getComputedStyle(anchor);
    const sideways = mode.startsWith('vertical') || mode.startsWith('sideways');
    const blockStart: Edge = !sideways ? 'top' : mode.endsWith('rl') ? 'right' : 'left';
    const inlineStart: Edge = !sideways
      ? direction === 'rtl'
        ? 'right'
        : 'left'
      : (direction === 'rtl') !== (mode === 'sideways-lr')
        ? 'bottom'
        : 'top';
    const side = o.side ?? 'block-end';
    const start = side.startsWith('block') ? blockStart : inlineStart;
    const preferred: Edge = side.endsWith('start') ? start : OPPOSITE[start];

    const a = anchor.getBoundingClientRect();
    const width = surface.offsetWidth;
    const height = surface.offsetHeight;
    const room: Record<Edge, number> = {
      top: a.top - top - offset,
      bottom: bottom - a.bottom - offset,
      left: a.left - left - offset,
      right: right - a.right - offset,
    };
    const needed = (edge: Edge) => (vertical(edge) ? height : width);
    let edge = preferred;
    if ((o.flip ?? true) && needed(edge) > room[edge] && room[OPPOSITE[edge]] > room[edge])
      edge = OPPOSITE[edge];

    // The other axis: its start edge is whichever logical start lies on it.
    const crossStart = vertical(edge)
      ? vertical(inlineStart)
        ? blockStart
        : inlineStart
      : vertical(inlineStart)
        ? inlineStart
        : blockStart;
    const align = o.align ?? 'start';
    let x: number;
    let y: number;
    if (vertical(edge)) {
      y = edge === 'bottom' ? a.bottom + offset : a.top - offset - height;
      x =
        align === 'center'
          ? a.left + (a.width - width) / 2
          : (align === 'start') === (crossStart === 'left')
            ? a.left
            : a.right - width;
      if (o.shift ?? true) x = Math.max(left, Math.min(x, right - width));
    } else {
      x = edge === 'right' ? a.right + offset : a.left - offset - width;
      y =
        align === 'center'
          ? a.top + (a.height - height) / 2
          : (align === 'start') === (crossStart === 'top')
            ? a.top
            : a.bottom - height;
      if (o.shift ?? true) y = Math.max(top, Math.min(y, bottom - height));
    }
    x = Math.round(x);
    y = Math.round(y);
    const style = surface.style;
    style.setProperty('inset', 'auto');
    style.setProperty('margin', '0');
    style.setProperty('left', `${x}px`);
    style.setProperty('top', `${y}px`);

    const flipped = edge !== preferred;
    const placement: Placement = {
      side: flipped
        ? (`${side.split('-')[0]}-${side.endsWith('start') ? 'end' : 'start'}` as Side)
        : side,
      x,
      y,
      availableWidth: Math.max(0, vertical(edge) ? right - left : room[edge]),
      availableHeight: Math.max(0, vertical(edge) ? room[edge] : bottom - top),
      anchor: a,
    };
    this.#placement = placement;
    o.onPlace?.(placement);
  }
}
