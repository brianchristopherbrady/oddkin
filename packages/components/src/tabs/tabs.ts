import { RovingFocus, type RovingFocusOptions } from '@oddkin/core/controllers/focus';
import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { computed, signal, untracked, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { OddkinTabPanel } from '../tab-panel/tab-panel.js';

/** The user selected another tab. */
export const tabsInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** The user selected another tab (the selection is committed at once). */
export const tabsChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/** A panel's value in `value`: its own, or its position. */
const valueOf = (panel: OddkinTabPanel, index: number) => panel.value || String(index);

/**
 * Tabs that switch between related panels (APG tabs). Panels are `odd-tab-panel` children; the
 * element draws a tab for each and assigns each panel to a tab panel inside its own shadow root
 * (manual slot assignment), so each tab and its panel reference each other while the content
 * stays in the light DOM.
 *
 * @slot - `odd-tab-panel` children; other children are not shown.
 * @csspart base - The surface.
 * @csspart list - The tab list.
 * @csspart tab - Each tab (a button).
 * @csspart panel - Each tab panel, around its `odd-tab-panel`.
 * @cssprop --odd-tabs-radius - Corner radius of the surface.
 * @cssprop --odd-tabs-background - Background of the surface.
 * @a11y A `tablist` named by `label`, with `tab` buttons (`aria-selected`, `aria-controls`) and `tabpanel` regions named by their tab. The panel shown is focusable, so its content is reachable even without focusable content.
 * @keyboard Tab reaches the selected tab, then the panel. Arrow keys move between tabs (Left and Right, or Up and Down when vertical; mirrored right to left), Home and End go to the first and last; disabled tabs are skipped. With `activation="automatic"` a focused tab is selected; with `manual`, Enter or Space selects it.
 * @previewRole tabs
 * @useFor Switching between related views of the same subject in place.
 * @notFor Page navigation (use links or odd-side-nav); a choice of value in a form (use a radio group or segmented control); steps of a process.
 * @category Navigation
 * @customization 1 2 3
 */
export class OddkinTabs extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the tab list.' }),
  value: prop.string({
    default: '',
    description:
      "The selected panel's `value` (its position when it has none). Without a match, the first enabled panel shows.",
  }),
  orientation: prop.enum(['horizontal', 'vertical'], {
    default: 'horizontal',
    reflect: true,
    description: 'Tabs in a row above the panel, or in a column beside it.',
  }),
  activation: prop.enum(['automatic', 'manual'], {
    default: 'automatic',
    description: 'Select a tab when it receives focus, or only with Enter or Space (APG).',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', slotAssignment: 'manual' };
  static override events = { input: tabsInputEvent, change: tabsChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinTabs>;

  /** @internal The `odd-tab-panel` children, in order. */
  readonly _panels = signal<readonly OddkinTabPanel[]>([]);
  /** @internal The index of the panel shown, or -1 without an enabled panel. */
  readonly _selected: Readable<number> = computed(() => {
    const panels = this._panels.value;
    const enabled = (panel: OddkinTabPanel) => !panel.disabled;
    const index = panels.findIndex((p, i) => enabled(p) && valueOf(p, i) === this.value);
    return index >= 0 ? index : panels.findIndex(enabled);
  });
  /** @internal The index of the tab in the Tab order (the roving tab stop). */
  readonly _active = signal(0);

  readonly #roving = new RovingFocus(this.#focusOptions());

  /** @internal Re-reads the panels (also called by a panel that connects late). */
  _panelsChanged(): void {
    this._panels.value = [...this.children].filter((c) => c instanceof OddkinTabPanel);
  }

  /** @internal The user selected a tab. */
  _select(index: number): void {
    const panel = this._panels.value[index];
    if (!panel || index === this._selected.value) return;
    this.value = valueOf(panel, index);
    this.emit(tabsInputEvent);
    this.emit(tabsChangeEvent);
  }

  /** @internal A tab received focus: with automatic activation, it is selected. */
  _onTabFocus(index: number): void {
    if (this.activation === 'automatic') this._select(index);
  }

  #list(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="list"]');
  }

  #focusOptions(): RovingFocusOptions {
    const host = this;
    return {
      target: () => this.#list(),
      items: () => [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part~="tab"]') ?? [])],
      // Read on each key press, so a new orientation applies at once.
      get orientation() {
        return host.orientation;
      },
      onActiveChange: (index) => (this._active.value = index),
    };
  }

  protected override connected(scope: Scope): void {
    this._panelsChanged();
    const observer = new MutationObserver(() => this._panelsChanged());
    observer.observe(this, { childList: true });
    scope.add(() => observer.disconnect(), 'tab panels');
  }

  protected override mounted(scope: Scope): void {
    scope.use(this.#roving);
    // Panels are assigned to their tab panels after each render.
    scope.effect(
      () => {
        const panels = this._panels.value;
        const slots = this.shadowRoot!.querySelectorAll<HTMLSlotElement>('[part~="panel"] > slot');
        panels.forEach((panel, i) => slots[i]?.assign(panel));
      },
      { phase: 'post', name: '<odd-tabs> panel slots' },
    );
    // The selected tab holds the Tab stop whenever focus is outside the tab list.
    scope.effect(
      () => {
        const selected = this._selected.value;
        untracked(() => this.#roving.setActive(selected));
      },
      { phase: 'post', name: '<odd-tabs> tab stop' },
    );
    scope.listen(this.#list()!, 'focusout', (event: FocusEvent) => {
      if (!this.#list()!.contains(event.relatedTarget as Node | null))
        this.#roving.setActive(this._selected.value);
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-tabs': OddkinTabs;
  }
}
