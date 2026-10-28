import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { actionApprovalRecipeStyles } from './action-approval.recipe.styles.js';

/** The arrangement is the layout recipe in `action-approval.recipe.ts`. */
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
  .base[data-status='superseded'] {
    border-width: ${token('border.width.default')};
    border-color: ${token('color.border.default')};
  }
  p {
    margin: 0;
  }
  .title {
    font-weight: ${token('font.weight.semibold')};
  }
  .changes {
    font-size: ${token('font.size.sm')};
  }
  .change-label {
    font-weight: ${token('font.weight.medium')};
  }
  del {
    color: ${token('color.danger.foreground')};
  }
  ins {
    color: ${token('color.success.foreground')};
    text-decoration: none;
  }
  .state {
    font-size: ${token('font.size.sm')};
  }
  .state[data-tone='success'] {
    color: ${token('color.success.foreground')};
  }
  .state[data-tone='danger'] {
    color: ${token('color.danger.foreground')};
  }
  .reason {
    flex: 1 1 100%;
  }
  textarea {
    min-block-size: ${token('target.min')};
    padding: ${token('space.2xs')} ${token('space.xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    font: inherit;
    color: inherit;
    background: ${token('color.surface.default')};
    resize: vertical;
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`;
