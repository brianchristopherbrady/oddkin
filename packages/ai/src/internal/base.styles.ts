import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Styles shared by every `@oddkin/ai` element: host defaults, text, focus, visually hidden
 * text, status labels, and action rows. Each element adds its own sheet after this one.
 */
export const aiBaseStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    min-inline-size: 0;
    color: ${token('color.text.primary')};
    font-family: ${token('font.family.sans')};
    font-size: ${token('font.size.md')};
    line-height: ${token('line-height.normal')};
    overflow-wrap: anywhere;
  }
  :host([hidden]) {
    display: none;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  [hidden] {
    display: none !important;
  }
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  :focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
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
