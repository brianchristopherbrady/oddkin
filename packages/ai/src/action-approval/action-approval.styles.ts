import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { actionApprovalRecipeStyles } from './action-approval.recipe.styles.js';

/**
 * The arrangement is the layout recipe in `action-approval.recipe.ts`; the changes' look is the
 * shared diff view's (`internal/diff-view.ts`).
 */
export const actionApprovalStyles = css`
  ${actionApprovalRecipeStyles}
  .base {
    padding: ${token('space.sm')};
    border: ${token('border.width.strong')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.raised')};
  }
  .base[data-status='approved'],
  .base[data-status='rejected'],
  .base[data-status='expired'],
  .base[data-status='superseded'],
  .base[data-status='cancelled'] {
    border-width: ${token('border.width.default')};
    border-color: ${token('color.border.default')};
  }
  p {
    margin: 0;
  }
  .title {
    font-weight: ${token('font.weight.semibold')};
  }
  .target {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .changes {
    padding: ${token('space.xs')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.sunken')};
    font-size: ${token('font.size.sm')};
  }
  .change-label {
    font-weight: ${token('font.weight.medium')};
  }
  .state {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  /*
   * The reason is a native textarea drawn by the components' field sheets, with odd-textarea's
   * inset and resize, in body type (the disclosure around it sets UI type).
   */
  .reason .control {
    padding-block: ${token('space.sm')};
    font-family: ${token('type.body.family')};
    font-weight: ${token('type.body.weight')};
    resize: vertical;
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`;
