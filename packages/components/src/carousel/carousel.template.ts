import { html } from '@oddkin/core/template';
import { arrowEndGlyph, arrowStartGlyph } from '../styles/glyphs.js';
import type { OddkinCarousel } from './carousel.js';

/**
 * Anatomy: `part="base"` with the `slides` live region (one `slide` group per element child, each
 * holding a slot the element assigns that child to; only the shown one is not `hidden`) and the
 * `controls` row: `previous`, the `position` text, the `picker` of `pick` buttons, and `next`.
 */
export const carouselTemplate = (carousel: OddkinCarousel) => {
  const slides = carousel._slides.value;
  const shown = carousel._shown.value;
  const text = carousel._strings.value;
  const first = shown <= 0;
  const last = shown === slides.length - 1;
  return html`<div part="base" class="carousel">
    <div part="slides" id="slides" class="slides" aria-live="polite">
      ${slides.map(
        (_slide, i) =>
          html`<div
            part="slide"
            class="slide"
            id=${`slide-${i}`}
            role="group"
            aria-roledescription=${text.slide}
            aria-label=${carousel._position(i)}
            ?hidden=${i !== shown}
          >
            <slot></slot>
          </div>`,
      )}
    </div>
    <div part="controls" class="controls">
      <button
        part="previous"
        class="odd-button step"
        data-size="sm"
        type="button"
        aria-label=${text.previous}
        aria-controls="slides"
        aria-disabled=${first ? 'true' : null}
        @click=${() => carousel._go(shown - 1)}
      >
        ${arrowStartGlyph}
      </button>
      <span part="position" class="position">${shown < 0 ? '' : carousel._position(shown)}</span>
      <span part="picker" class="picker" role="group" aria-label=${text.picker}>
        ${slides.map(
          (_slide, i) =>
            html`<button
              part="pick"
              class="pick"
              type="button"
              aria-label=${carousel._goToLabel(i)}
              aria-controls=${`slide-${i}`}
              aria-current=${i === shown ? 'true' : null}
              @click=${() => carousel._go(i)}
            >
              ${carousel._number(i)}
            </button>`,
        )}
      </span>
      <button
        part="next"
        class="odd-button step"
        data-size="sm"
        type="button"
        aria-label=${text.next}
        aria-controls="slides"
        aria-disabled=${last ? 'true' : null}
        @click=${() => carousel._go(shown + 1)}
      >
        ${arrowEndGlyph}
      </button>
    </div>
  </div>`;
};
