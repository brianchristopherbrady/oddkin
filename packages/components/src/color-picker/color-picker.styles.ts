import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { rangeStyles } from '../styles/range.styles.js';

/**
 * Oddkin's default colour picker: Figma `colorPicker` and `color/Swatch`. The field is the shared
 * control look with the colour's swatch (large-icon size, small radius, strong border) at its
 * start and the chevron button (as the date picker's) at its end. The popup is the overlay
 * surface joined to the field box: the shared corners at the far side only, no border on the near
 * side. Inside, with medium spacing: the area (small radius; a ring for the handle), the hue (the
 * shared slider look, small-icon thick, round, its handle the surface colour with a strong
 * border), the hex and opacity entries (small spacing; small secondary labels), the RGB values,
 * the suggested colours under a divider (small-control squares, small spacing; the check small-icon
 * size), and the actions (small buttons).
 */
export const colorPickerStyles = css`
  ${rangeStyles}
  .control-box > .swatch {
    inline-size: ${token('icon.size.lg')};
    block-size: ${token('icon.size.lg')};
  }
  .control-box:has(> .swatch) > .control {
    padding-inline-start: calc(
      ${token('control.padding.inline.md')} + ${token('icon.size.lg')} + ${token('control.gap')}
    );
  }
  .swatch,
  .option-swatch {
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.sm')};
  }
  .button {
    inline-size: ${token('target.min')};
    block-size: ${token('target.min')};
    margin: calc((1em - ${token('target.min')}) / 2);
    border-radius: ${token('control.radius')};
    color: ${token('color.text.secondary')};
  }
  @media (hover: hover) {
    .button:enabled:hover {
      background: ${token('color.surface.hover')};
      color: ${token('color.text.primary')};
    }
  }
  .controls {
    gap: ${token('space.md')};
    padding: ${token('space.md')};
  }
  .popup[data-side='block-end'] {
    border-block-start-width: 0;
    border-start-start-radius: 0;
    border-start-end-radius: 0;
  }
  .popup[data-side='block-start'] {
    border-block-end-width: 0;
    border-end-start-radius: 0;
    border-end-end-radius: 0;
  }
  :host(:state(open)) .field:has(.popup[data-side='block-end']) .control-box > .control {
    border-end-start-radius: 0;
    border-end-end-radius: 0;
  }
  :host(:state(open)) .field:has(.popup[data-side='block-start']) .control-box > .control {
    border-start-start-radius: 0;
    border-start-end-radius: 0;
  }
  .area {
    --_area-thumb: ${token('space.sm')};
    border-radius: ${token('radius.sm')};
  }
  .area-thumb {
    inline-size: var(--_area-thumb);
    block-size: var(--_area-thumb);
    margin-inline-start: calc(var(--_area-thumb) / -2);
    margin-block-start: calc(var(--_area-thumb) / -2);
    border: calc(2 * ${token('border.width.default')}) solid ${token('color.surface.default')};
    border-radius: ${token('radius.full')};
    box-shadow: 0 0 0 ${token('border.width.default')} ${token('color.border.strong')};
  }
  .hue {
    --_thumb: ${token('icon.size.sm')};
    min-block-size: auto;
  }
  .hue > .track {
    block-size: ${token('icon.size.sm')};
    border-radius: ${token('radius.full')};
  }
  .hue > .thumb {
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    background: ${token('color.surface.default')};
  }
  .entries {
    gap: ${token('space.sm')};
  }
  .entry {
    gap: ${token('space.xs')};
  }
  .entry-label,
  .rgb,
  .swatches-label {
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .swatches {
    gap: ${token('space.md')};
    padding-block-start: ${token('space.md')};
    border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
  .swatches-label {
    margin: 0;
  }
  .swatch-row {
    gap: ${token('space.sm')};
  }
  .option-swatch {
    inline-size: ${token('control.height.sm')};
    block-size: ${token('control.height.sm')};
    font-size: ${token('icon.size.sm')};
  }
  .option-swatch:has(:focus-visible) {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  .option-swatch:has(:disabled) {
    opacity: 0.45;
  }
  .actions {
    gap: ${token('space.xs')};
  }
`;
