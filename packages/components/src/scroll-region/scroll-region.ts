import { ResizeController } from '@oddkin/core/controllers/observe';
import { OddkinElement, prop } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

export const SCROLL_REGION_STRINGS = { label: 'Scrollable content' };

/**
 * Content that scrolls on its own inside a page, reachable and scrollable from the keyboard
 * (WCAG 2.1.1). Bound it with `block-size` or `max-block-size`; while its content overflows, the
 * scroller is focusable and a region named by `label`. When the content fits it is neither, so it
 * adds no tab stop.
 *
 * @slot - The content, stacked with the layout gap.
 * @csspart base - The scroller.
 * @cssprop --odd-scroll-region-gap - Space between children (default the theme's `layout.gap`).
 * @a11y While the content overflows, the scroller is in the tab order as a `region` named by `label` (default `strings.label`, "Scrollable content"); name it after its content. When the content fits, it is not focusable and has no role.
 * @keyboard While it overflows: Tab reaches it; arrow keys, Page Up, Page Down, Home, End, and Space scroll it.
 * @previewRole scrollRegion
 * @useFor A bounded area that scrolls inside a page: a long list in a panel, a log, a preview pane.
 * @notFor The page itself (let the document scroll); a set of choices (use a listbox, which manages focus itself).
 * @category Layout
 * @customization 1 2 3
 */
export class OddkinScrollRegion extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the region while it scrolls.' }),
  strings: prop.object<Partial<typeof SCROLL_REGION_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal True while the content is larger than the scroller; read by the template. */
  readonly _overflowing = signal(false);

  /** @internal The region's name. */
  get _label(): string {
    return this.label || strings(SCROLL_REGION_STRINGS, this.strings).label;
  }

  // The scroller resizes with the element; the content wrapper resizes with the content.
  readonly #resize = new ResizeController(() => this.#measure(), {
    targets: () => [...(this.shadowRoot?.querySelectorAll('.base, .content') ?? [])],
  });

  protected override mounted(scope: Scope): void {
    scope.use(this.#resize);
    // Right after the first render, before the observer's first delivery (the next frame).
    this.#measure();
  }

  #measure(): void {
    const base = this.shadowRoot?.querySelector('.base');
    if (!base) return;
    this._overflowing.value =
      base.scrollHeight > base.clientHeight || base.scrollWidth > base.clientWidth;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-scroll-region': OddkinScrollRegion;
  }
}
