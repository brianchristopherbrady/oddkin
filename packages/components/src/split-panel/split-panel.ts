import { ResizeHandle } from '@oddkin/core/controllers/resize';
import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

export const SPLIT_PANEL_STRINGS = { label: 'Resize' };

/** While dragging and after each key: `position` (or `collapsed`) has changed. */
export const splitPanelInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'position',
  intent: 'user',
});
/** When a drag ends with a new position, and after each key that changed it. */
export const splitPanelChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * Two panes side by side or stacked, with a separator the user drags or moves with the keyboard
 * (APG window splitter). Nest split panels for more panes.
 *
 * @slot start - The first pane (inline start, or top when stacked); the separator sets its size.
 * @slot end - The second pane; it takes the rest.
 * @csspart base - The grid of both panes and the separator.
 * @csspart start - The wrapper of the start pane (hidden while collapsed).
 * @csspart separator - The separator.
 * @csspart end - The wrapper of the end pane.
 * @cssprop --odd-split-panel-separator-size - Thickness of the separator.
 * @a11y The separator is a focusable `separator` named by `label` (default `strings.label`, "Resize") with `aria-valuenow` (the start pane's size in percent, 0 while collapsed), `aria-valuemin`, `aria-valuemax`, and `aria-controls` naming the start pane. A collapsed start pane is hidden, so its content leaves the Tab order and the accessibility tree. Name each pane's content (for example with headings) so the separator's purpose is clear.
 * @keyboard Tab reaches the separator. Left and Right move it by 1% (Up and Down when stacked; mirrored right to left); Home and End go to `min` and `max`; Enter collapses the start pane or restores it.
 * @previewRole splitPanel
 * @useFor Two regions the user resizes, such as a file list beside an editor or a preview under code.
 * @notFor A fixed page layout (use the layout recipes); hiding content without resizing (use odd-disclosure).
 * @limitation Stacked panes need a height on the element; side-by-side panes take their content's height.
 * @category Layout
 */
export class OddkinSplitPanel extends OddkinElement.with({
  orientation: prop.enum(['horizontal', 'vertical'], {
    default: 'horizontal',
    reflect: true,
    description: 'Panes side by side (horizontal) or stacked (vertical).',
  }),
  position: prop.number({
    default: 50,
    description: 'Size of the start pane, in percent of the element, between `min` and `max`.',
  }),
  min: prop.number({ default: 0, description: 'Smallest `position`, in percent.' }),
  max: prop.number({ default: 100, description: 'Largest `position`, in percent.' }),
  collapsed: prop.boolean({
    reflect: true,
    description: 'Hides the start pane; Enter on the separator toggles it, keeping `position`.',
  }),
  label: prop.string({ default: '', description: 'Names the separator.' }),
  strings: prop.object<Partial<typeof SPLIT_PANEL_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { input: splitPanelInputEvent, change: splitPanelChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinSplitPanel>;

  /** @internal True while the separator is dragged. */
  readonly _dragging = signal(false);

  /** @internal The limits, within 0 to 100, `max` never under `min`. */
  get _min(): number {
    return Math.min(Math.max(this.min, 0), 100);
  }
  get _max(): number {
    return Math.min(Math.max(this.max, this._min), 100);
  }

  /** @internal The start pane's size as shown: `position` within the limits, 0 while collapsed. */
  get _shown(): number {
    return this.collapsed ? 0 : Math.min(Math.max(this.position, this._min), this._max);
  }

  /** @internal The separator's name. */
  get _label(): string {
    return this.label || strings(SPLIT_PANEL_STRINGS, this.strings).label;
  }

  /** @internal Enter on the separator collapses the start pane or restores it. */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.collapsed = !this.collapsed;
    this.emit(splitPanelInputEvent);
    this.emit(splitPanelChangeEvent);
  };

  protected override mounted(scope: Scope): void {
    const root = this.shadowRoot!;
    scope.use(
      new ResizeHandle({
        handle: () => root.querySelector<HTMLElement>('[part~="separator"]'),
        container: () => root.querySelector('[part~="base"]'),
        orientation: () => this.orientation,
        value: () => this._shown,
        min: () => this._min,
        max: () => this._max,
        onInput: (value) => {
          this.collapsed = false;
          this.position = value;
          this.emit(splitPanelInputEvent);
        },
        onChange: () => this.emit(splitPanelChangeEvent),
        onDrag: (dragging) => (this._dragging.value = dragging),
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-split-panel': OddkinSplitPanel;
  }
}
