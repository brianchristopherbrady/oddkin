/**
 * `@oddkin/core/controllers/resize` — a splitter handle moved by pointer and keyboard (WAI-ARIA APG
 * window splitter): the value is the start pane's size in percent of the container. Unbranded and
 * `Scope`-owned; the DOM is touched only after `connect()`.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import type { Controller, Scope } from '../scope/index.js';

export interface ResizeHandleOptions {
  /** The separator: focusable, it receives the pointer and key events. */
  readonly handle: () => HTMLElement | null | undefined;
  /** The element whose size the value is a percentage of. */
  readonly container: () => Element | null | undefined;
  /**
   * `'horizontal'`: the panes are side by side and the handle moves along the inline axis (Left and
   * Right, mirrored in right-to-left text); `'vertical'`: stacked (Up and Down). Read on each event.
   * Default `'horizontal'`.
   */
  readonly orientation?: () => 'horizontal' | 'vertical';
  /** The current value, in percent. */
  readonly value: () => number;
  /** Limits, read on each event. Default 0 and 100. */
  readonly min?: () => number;
  readonly max?: () => number;
  /** Percent per arrow key. Default 1. */
  readonly step?: number;
  /** Each new value while dragging and after each key, clamped to the limits. */
  readonly onInput: (value: number) => void;
  /** The committed value: after a drag that changed it, and after each key that changed it. */
  readonly onChange?: (value: number) => void;
  /** A drag started (`true`) or ended (`false`). */
  readonly onDrag?: (dragging: boolean) => void;
}

/**
 * Dragging follows the pointer's distance from where it was pressed (no jump to the pointer), with
 * pointer capture where the engine grants it. Arrow keys step, Home and End go to the limits; the
 * widget handles Enter (collapse) itself.
 */
export class ResizeHandle implements Controller {
  readonly #options: ResizeHandleOptions;
  #drag: Scope | undefined;

  constructor(options: ResizeHandleOptions) {
    this.#options = options;
  }

  /** True while a pointer drag is in progress. */
  get dragging(): boolean {
    return !!this.#drag;
  }

  connect(scope: Scope): void {
    const handle = this.#options.handle();
    if (!handle) return;
    scope.listen(handle, 'keydown', (event: KeyboardEvent) => this.#onKey(event));
    scope.listen(handle, 'pointerdown', (event: PointerEvent) => this.#start(event, handle, scope));
  }

  #clamp(value: number): number {
    const min = this.#options.min?.() ?? 0;
    const max = this.#options.max?.() ?? 100;
    return Math.min(Math.max(value, min), max);
  }

  #horizontal(): boolean {
    return (this.#options.orientation?.() ?? 'horizontal') === 'horizontal';
  }

  #start(event: PointerEvent, handle: HTMLElement, scope: Scope): void {
    if (this.#drag || event.button !== 0 || !event.isPrimary) return;
    const container = this.#options.container();
    if (!container) return;
    const horizontal = this.#horizontal();
    const rect = container.getBoundingClientRect();
    const size = horizontal ? rect.width : rect.height;
    if (!size) return;
    // No text selection starts; focus moves to the handle so the keys continue from here.
    event.preventDefault();
    handle.focus({ preventScroll: true });
    const sign = horizontal && getComputedStyle(container).direction === 'rtl' ? -1 : 1;
    const origin = horizontal ? event.clientX : event.clientY;
    const initial = this.#options.value();
    let last = initial;
    const drag = scope.child({ name: 'resize drag' });
    this.#drag = drag;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already released pointers cannot be captured; the document still sees them.
    }
    const doc = handle.ownerDocument;
    const ours = (e: PointerEvent) => e.pointerId === event.pointerId;
    drag.listen(doc, 'pointermove', (e: PointerEvent) => {
      if (!ours(e)) return;
      const position = horizontal ? e.clientX : e.clientY;
      const next = this.#clamp(initial + (sign * (position - origin) * 100) / size);
      if (next === last) return;
      last = next;
      this.#options.onInput(next);
    });
    const end = (e: PointerEvent) => {
      if (!ours(e)) return;
      drag.dispose();
      this.#options.onDrag?.(false);
      if (last !== initial) this.#options.onChange?.(last);
    };
    drag.listen(doc, 'pointerup', end);
    drag.listen(doc, 'pointercancel', end);
    drag.add(() => (this.#drag = undefined), 'resize drag');
    this.#options.onDrag?.(true);
  }

  #onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = this.#options.value();
    const step = this.#options.step ?? 1;
    const horizontal = this.#horizontal();
    const rtl =
      horizontal &&
      getComputedStyle((this.#options.container() ?? event.currentTarget) as Element).direction ===
        'rtl';
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        if (!horizontal) return;
        next = current + ((event.key === 'ArrowRight') !== rtl ? step : -step);
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        if (horizontal) return;
        next = current + (event.key === 'ArrowDown' ? step : -step);
        break;
      case 'Home':
        next = -Infinity;
        break;
      case 'End':
        next = Infinity;
        break;
      default:
        return;
    }
    event.preventDefault();
    next = this.#clamp(next);
    if (next === current) return;
    this.#options.onInput(next);
    this.#options.onChange?.(next);
  }
}
