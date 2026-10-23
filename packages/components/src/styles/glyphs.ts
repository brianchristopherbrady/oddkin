import { css } from '@oddkin/core/styles';
import { html } from '@oddkin/core/template';

// Built-in affordance and tone glyphs (component-contracts.md §2.7), drawn by Oddkin from simple
// geometry on a 20-unit grid. Inline SVG in the shadow root: no image request, so a strict
// Content-Security-Policy needs no `img-src`. One export per glyph, so bundles keep only those
// they render. Decorative: the control or text beside a glyph carries the meaning.

/** Glyph geometry: 1em square, stroked in `currentColor`; `.mirror` glyphs flip right to left. */
export const glyphStyles = css`
  .glyph {
    display: inline-block;
    flex: none;
    inline-size: 1em;
    block-size: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    vertical-align: middle;
  }
  .glyph .dot {
    fill: currentColor;
    stroke: none;
  }
  .glyph.mirror:dir(rtl) {
    scale: -1 1;
  }
`;

export const checkGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M5 10.5l3.5 3.5L15 7" />
</svg>`;
export const minusGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M5 10h10" />
</svg>`;
export const plusGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M10 5v10M5 10h10" />
</svg>`;
export const closeGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M6 6l8 8M14 6l-8 8" />
</svg>`;
export const chevronDownGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M6 8l4 4 4-4" />
</svg>`;
export const chevronUpGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M6 12l4-4 4 4" />
</svg>`;
/** Points to the inline end: right in left-to-right text, left in right-to-left text. */
export const chevronEndGlyph = html`<svg
  class="glyph mirror"
  viewBox="0 0 20 20"
  aria-hidden="true"
>
  <path d="M8 6l4 4-4 4" />
</svg>`;
/** Points to the inline start. */
export const chevronStartGlyph = html`<svg
  class="glyph mirror"
  viewBox="0 0 20 20"
  aria-hidden="true"
>
  <path d="M12 6l-4 4 4 4" />
</svg>`;
/** Points to the inline end. */
export const arrowEndGlyph = html`<svg class="glyph mirror" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M4 10h12M12 6l4 4-4 4" />
</svg>`;
/** Points to the inline start. */
export const arrowStartGlyph = html`<svg
  class="glyph mirror"
  viewBox="0 0 20 20"
  aria-hidden="true"
>
  <path d="M16 10H4M8 6l-4 4 4 4" />
</svg>`;
export const searchGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="8.5" cy="8.5" r="4.5" />
  <path d="M12 12l4 4" />
</svg>`;
export const moreGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <circle class="dot" cx="5" cy="10" r="1.25" />
  <circle class="dot" cx="10" cy="10" r="1.25" />
  <circle class="dot" cx="15" cy="10" r="1.25" />
</svg>`;
export const externalGlyph = html`<svg class="glyph mirror" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4" />
</svg>`;
export const uploadGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M10 13V4M6 8l4-4 4 4M4 13v3h12v-3" />
</svg>`;
export const fileGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M5 3h6l4 4v10H5zM11 3v4h4" />
</svg>`;
export const infoGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="7" />
  <path d="M10 9v5" />
  <circle class="dot" cx="10" cy="6.5" r="1" />
</svg>`;
export const warningGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <path d="M10 3.5l7 12.5H3z" />
  <path d="M10 8.5V12" />
  <circle class="dot" cx="10" cy="14" r="0.9" />
</svg>`;
export const checkCircleGlyph = html`<svg class="glyph" viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="7" />
  <path d="M7 10.25l2 2 4-4.5" />
</svg>`;
