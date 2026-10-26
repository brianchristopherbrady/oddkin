import { css } from '@oddkin/core/styles';
import { rangeStructuralStyles } from '../styles/range.structural.styles.js';

/**
 * The colour picker is a block with the shared field layout: the swatch and the button over the
 * text input's ends, as adornments; the popup (the shared overlay surface) as wide as the field
 * box, stacking the area, the hue slider (the shared slider area, its track the full width), the
 * hex and opacity entries side by side, the RGB values, the suggested colours (each a native radio
 * over its square, its check white or black, whichever contrasts more with the colour), and the
 * actions at the end. The area paints saturation across and brightness up for the hue (`--_hue`,
 * `--_s`, `--_v`); the hue track paints the hues; both are mirrored right to left. They and the
 * swatches are the user's colour data, not theme colours: where forced colours exist, they keep
 * their colours (`forced-color-adjust`, a registered enhancement). No brand tokens.
 */
export const colorPickerStructuralStyles = css`
  ${rangeStructuralStyles}
  :host {
    display: block;
  }
  .button {
    display: grid;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    pointer-events: auto;
  }
  .button:disabled {
    cursor: not-allowed;
  }
  .swatch,
  .option-swatch {
    box-sizing: border-box;
    background: var(--_color);
  }
  .popup {
    box-sizing: border-box;
    inline-size: var(--_anchor-inline-size, auto);
  }
  .controls {
    display: flex;
    flex-direction: column;
  }
  .area {
    position: relative;
    block-size: 9.25rem;
    touch-action: none;
    cursor: pointer;
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, hsl(calc(var(--_hue) * 1deg) 100% 50%));
  }
  .area-thumb {
    position: absolute;
    box-sizing: border-box;
    inset-inline-start: calc(var(--_s) * 100%);
    inset-block-start: calc((1 - var(--_v)) * 100%);
  }
  .hue {
    padding-inline: 0;
  }
  .hue > .track {
    background: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red);
  }
  :host(:dir(rtl)) .area {
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to left, #fff, hsl(calc(var(--_hue) * 1deg) 100% 50%));
  }
  :host(:dir(rtl)) .hue > .track {
    background: linear-gradient(to left, red, yellow, lime, cyan, blue, magenta, red);
  }
  @supports (forced-color-adjust: none) {
    .swatch,
    .option-swatch,
    .area,
    .hue > .track {
      forced-color-adjust: none;
    }
  }
  .entries {
    display: flex;
  }
  .entry {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-inline-size: 0;
  }
  .rgb {
    margin: 0;
  }
  .swatches {
    display: flex;
    flex-direction: column;
  }
  .swatch-row {
    display: flex;
    flex-wrap: wrap;
  }
  .option-swatch {
    position: relative;
    display: grid;
    place-items: center;
    color: #fff;
    cursor: pointer;
  }
  .option-swatch.light {
    color: #000;
  }
  .option-radio {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }
  .option-swatch > .glyph {
    visibility: hidden;
  }
  .option-swatch:has(:checked) > .glyph {
    visibility: visible;
  }
  .option-swatch:has(:disabled) {
    cursor: not-allowed;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
`;
