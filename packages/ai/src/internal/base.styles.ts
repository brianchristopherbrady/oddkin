import { focusRingStyles, hostStyles, visuallyHiddenStyles } from '@oddkin/components/styles';
import { css, type StyleInput } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Styles every `@oddkin/ai` element adds to the shared component primitives: host text
 * defaults, status labels, action rows, and text buttons.
 */
export const aiElementStyles = css`
  :host {
    display: block;
    min-inline-size: 0;
    color: ${token('color.text.primary')};
    font-family: ${token('font.family.sans')};
    font-size: ${token('font.size.md')};
    line-height: ${token('line-height.normal')};
    overflow-wrap: anywhere;
  }
  .muted {
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: ${token('space.2xs')};
    padding-block: 0.125rem;
    padding-inline: ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.full')};
    font-size: ${token('font.size.xs')};
    font-weight: ${token('font.weight.medium')};
    color: ${token('color.text.secondary')};
    white-space: nowrap;
  }
  .status[data-tone='success'] {
    border-color: currentColor;
    color: ${token('color.text.success')};
    background: ${token('color.surface.success')};
  }
  .status[data-tone='danger'] {
    border-color: ${token('color.border.danger')};
    color: ${token('color.text.danger')};
    background: ${token('color.surface.danger')};
  }
  .status[data-tone='active'] {
    border-color: ${token('color.border.strong')};
    color: ${token('color.text.primary')};
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space.xs')};
  }
  .error {
    color: ${token('color.text.danger')};
    font-size: ${token('font.size.sm')};
  }
  .text-button {
    min-block-size: ${token('target.min')};
    min-inline-size: ${token('target.min')};
    padding-inline: ${token('space.xs')};
    border: ${token('border.width.default')} solid transparent;
    border-radius: ${token('control.radius')};
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: ${token('font.size.sm')};
    cursor: pointer;
  }
  .text-button[aria-pressed='true'] {
    border-color: ${token('color.border.strong')};
    background: ${token('color.surface.selected')};
  }
  .text-button:disabled {
    color: ${token('color.text.disabled')};
    cursor: not-allowed;
  }
  @media (hover: hover) {
    .text-button:not(:disabled):hover {
      background: ${token('color.surface.hover')};
    }
  }
  @media (forced-colors: active) {
    .status {
      border-color: CanvasText;
    }
    .text-button {
      border-color: ButtonText;
    }
  }
`;

/** Shared primitives first, then the AI element styles; each element adds its own sheet. */
export const aiBaseStyles: readonly StyleInput[] = [
  hostStyles,
  visuallyHiddenStyles,
  focusRingStyles,
  aiElementStyles,
];
