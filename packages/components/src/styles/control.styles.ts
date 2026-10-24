import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The field look of the Common page (158:22) for every Oddkin form control: the label in the UI
 * type role, help and error in the small role, and the control surface (`color.border.strong`,
 * `control.radius`, `control.height.md`, never below the target size) with its hover, invalid,
 * disabled, and read-only states. The field variables (`--odd-field-height`, `-radius`,
 * `-border-color`, `-background`) apply to every form control and the `.odd-field` recipe, which
 * is generated from these rules.
 */
export const controlStyles = css`
  .field {
    gap: ${token('space.xs')};
    font-family: ${token('type.body.family')};
    color: ${token('color.text.primary')};
  }
  .label {
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .field:has(.control:disabled) .label {
    color: ${token('color.text.disabled')};
  }
  .description,
  .error {
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .description {
    color: ${token('color.text.secondary')};
  }
  .control {
    min-block-size: max(
      var(--odd-field-height, ${token('control.height.md')}),
      ${token('target.min')}
    );
    padding-block: ${token('space.none')};
    padding-inline: ${token('control.padding.inline.md')};
    border: ${token('border.width.default')} solid
      var(--odd-field-border-color, ${token('color.border.strong')});
    border-radius: var(--odd-field-radius, ${token('control.radius')});
    background: var(--odd-field-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    /* Body size: below 16px, iOS Safari zooms the page when the field takes focus. */
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
    transition-property: border-color, background-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .control::placeholder {
    color: ${token('color.text.secondary')};
    opacity: 1;
  }
  @media (hover: hover) {
    .control:read-write:hover {
      background: var(--odd-field-background, ${token('color.surface.hover')});
    }
  }
  .control[aria-invalid='true'] {
    border-color: ${token('color.danger.foreground')};
  }
  .control:disabled {
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
  .control-box > select.control {
    padding-inline-end: calc(${token('control.padding.inline.md')} + 1em + ${token('control.gap')});
  }
  .control-box:has(> .control-start) > .control {
    padding-inline-start: calc(
      ${token('control.padding.inline.md')} + 1em + ${token('control.gap')}
    );
  }
  .control-box:has(> .control-end) > input.control {
    padding-inline-end: calc(${token('control.padding.inline.md')} + 1em + ${token('control.gap')});
  }
  .control-start,
  .control-end {
    margin-inline: ${token('control.padding.inline.md')};
  }
  .control-box > .control:disabled ~ * {
    color: ${token('color.text.disabled')};
  }
  .error {
    color: ${token('color.danger.foreground')};
  }
`;
