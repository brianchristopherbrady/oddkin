import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default segmented control (Figma `segmented`): a sunken track with the strong border
 * and the control radius, inset by `space.xs`; `control.height.sm` segments in the UI type role,
 * the checked one in the selection colours, a pointer hover on the others, and the disabled text
 * colour (the checked segment keeps its colours). `size` steps the segment height and padding;
 * the danger border marks an invalid control, and the label is dimmed while it is disabled.
 */
export const segmentedControlStyles = css`
  .track {
    gap: ${token('control.gap')};
    padding: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.sunken')};
  }
  .segment-box {
    min-block-size: ${token('control.height.sm')};
    border-radius: ${token('radius.sm')};
    transition-property: background-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .segment-label {
    gap: ${token('control.gap')};
    padding-inline: ${token('control.padding.inline.sm')};
    color: ${token('color.text.primary')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  @media (hover: hover) {
    .segment-box:not(:checked, :disabled):hover {
      background: ${token('color.surface.hover')};
    }
  }
  .segment-box:checked {
    background: ${token('color.selection.background')};
  }
  .segment-box:checked + .segment-label {
    color: ${token('color.selection.foreground')};
  }
  .segment-box:disabled:not(:checked) + .segment-label {
    color: ${token('color.text.disabled')};
  }
  :host(:state(user-invalid)) .track {
    border-color: ${token('color.danger.foreground')};
  }
  :host(:disabled) .label {
    color: ${token('color.text.disabled')};
  }
  :host([size='sm']) .track {
    padding: ${token('space.2xs')};
  }
  :host([size='sm']) .segment-box {
    min-block-size: ${token('target.min')};
  }
  :host([size='lg']) .segment-box {
    min-block-size: ${token('control.height.md')};
  }
  :host([size='lg']) .segment-label {
    padding-inline: ${token('control.padding.inline.md')};
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
  }
`;
