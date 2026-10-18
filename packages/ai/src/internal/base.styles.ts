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
    color: ${token('color.success.foreground')};
    background: ${token('color.success.surface')};
  }
  .status[data-tone='danger'] {
    border-color: currentColor;
    color: ${token('color.danger.foreground')};
    background: ${token('color.danger.surface')};
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
    color: ${token('color.danger.foreground')};
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
    border-color: ${token('color.selection.background')};
    background: ${token('color.selection.background')};
    color: ${token('color.selection.foreground')};
  }
  .text-button:disabled {
    color: ${token('color.text.disabled')};
    cursor: not-allowed;
  }
  @media (hover: hover) {
    .text-button:not(:disabled, [aria-pressed='true']):hover {
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
