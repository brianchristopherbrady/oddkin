import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { format, formatNumber, langOf, strings } from '@oddkin/core/i18n';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';

export const CAROUSEL_STRINGS = {
  carousel: 'carousel',
  slide: 'slide',
  position: '{index} of {count}',
  previous: 'Previous slide',
  next: 'Next slide',
  picker: 'Slides',
  goTo: 'Go to slide {index}',
};

/** The user showed another slide. */
export const carouselInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'current',
  intent: 'user',
});
/** The user showed another slide (committed at once). */
export const carouselChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * A carousel (APG carousel, manual only): one slide at a time, with previous and next, the
 * position, and a button per slide. It never moves by itself. Each element child is a slide; the
 * element assigns each to a slide group inside its own shadow root (manual slot assignment), so the
 * content stays in the light DOM.
 *
 * @slot - The slides, one per element child.
 * @csspart base - The carousel.
 * @csspart slides - The live region around the slides.
 * @csspart slide - Each slide group, around its child.
 * @csspart controls - The row of controls.
 * @csspart previous - The previous-slide button.
 * @csspart next - The next-slide button.
 * @csspart position - The position text ("2 of 3").
 * @csspart picker - The group of slide buttons.
 * @csspart pick - Each slide button; the shown slide's has `aria-current="true"`.
 * @a11y A `region` with the role description "carousel", named by `label` (a `group` without one). Each slide is a `group` with the role description "slide", named by its position ("2 of 3"). The slides are a polite live region: a change the user makes is announced while focus stays on the control they used. At the ends, previous or next is `aria-disabled`, so focus stays on it. Slide buttons are named "Go to slide 2" (`strings.goTo`), their number being the visible text.
 * @keyboard Tab moves through previous, the slide buttons, and next, then into the shown slide; Enter and Space activate. There are no arrow keys and no rotation to stop.
 * @previewRole carousel
 * @useFor A few related highlights in one place, one at a time: onboarding steps, featured items.
 * @notFor Content everyone must see (show it all); switching views (use odd-tabs); paging a long list (use odd-pagination).
 * @category Navigation
 * @customization 1 2 3
 */
export class OddkinCarousel extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the carousel.' }),
  current: prop.string({
    default: '1',
    description:
      "The shown slide's number, from 1 (as odd-pagination's `current`); out of range, the nearest slide shows.",
  }),
  strings: prop.object<Partial<typeof CAROUSEL_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', slotAssignment: 'manual' };
  static override events = { input: carouselInputEvent, change: carouselChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinCarousel>;

  /** @internal The element children, in order. */
  readonly _slides = signal<readonly Element[]>([]);
  /** @internal The index of the slide shown, or -1 without slides. */
  readonly _shown: Readable<number> = computed(() => {
    const count = this._slides.value.length;
    if (!count) return -1;
    return Math.min(count, Math.max(1, Math.floor(Number(this.current)) || 1)) - 1;
  });
  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof CAROUSEL_STRINGS> = computed(() =>
    strings(CAROUSEL_STRINGS, this.strings),
  );

  /** @internal The number of the slide at `index`, in the page language. */
  _number(index: number): string {
    return formatNumber(index + 1, langOf(this));
  }

  /** @internal "2 of 3" for the slide at `index`. */
  _position(index: number): string {
    return format(this._strings.value.position, {
      index: this._number(index),
      count: formatNumber(this._slides.value.length, langOf(this)),
    });
  }

  /** @internal The name of the button for the slide at `index`. */
  _goToLabel(index: number): string {
    return format(this._strings.value.goTo, { index: this._number(index) });
  }

  /** @internal The user showed the slide at `index`. */
  _go(index: number): void {
    if (index < 0 || index >= this._slides.value.length || index === this._shown.value) return;
    this.current = String(index + 1);
    this.emit(carouselInputEvent);
    this.emit(carouselChangeEvent);
  }

  protected override connected(scope: Scope): void {
    const read = () => (this._slides.value = [...this.children]);
    read();
    const observer = new MutationObserver(read);
    observer.observe(this, { childList: true });
    scope.add(() => observer.disconnect(), 'carousel slides');
  }

  protected override mounted(scope: Scope): void {
    scope.effect(
      () => {
        const slides = this._slides.value;
        const slots = this.shadowRoot!.querySelectorAll<HTMLSlotElement>('[part~="slide"] > slot');
        slides.forEach((slide, i) => slots[i]?.assign(slide));
      },
      { phase: 'post', name: '<odd-carousel> slide slots' },
    );
    scope.effect(() => {
      const label = this.label;
      this.internals.role = label ? 'region' : 'group';
      this.internals.ariaRoleDescription = this._strings.value.carousel;
      this.internals.ariaLabel = label || null;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-carousel': OddkinCarousel;
  }
}
