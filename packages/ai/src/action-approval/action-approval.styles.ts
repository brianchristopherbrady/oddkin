import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { actionApprovalRecipeStyles } from './action-approval.recipe.styles.js';

/**
 * The arrangement is the layout recipe in `action-approval.recipe.ts`; the changes' look is the
 * shared diff view's (`internal/diff-view.ts`). The reason is a native textarea drawn by the
 * components' field sheets, with odd-textarea's inset and resize, in body type (the disclosure
 * around it sets UI type).
 *
 * Its container sets its density (Figma page 09): 640 px wide by default and 720 px at most, the
 * rest of the space its parent's, 24 px in; below 480 px, compact: 16 px in, its controls 48 px
 * tall, the decision's buttons stacked. A button fills its box: its label's width in a row, the
 * row's when stacked (outside the container query, where WebKit ignores `::part()` rules).
 */
export const actionApprovalStyles = css`
  ${actionApprovalRecipeStyles}
  :host {
    container: odd-action-approval / inline-size;
    inline-size: min(100%, 40rem);
    max-inline-size: 45rem;
  }
  .base {
    padding: ${token('space.lg')};
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
  .recorded-reason {
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
    color: ${token('color.text.secondary')};
  }
  .reason .control {
    padding-block: ${token('space.sm')};
    font-family: ${token('type.body.family')};
    font-weight: ${token('type.body.weight')};
    resize: vertical;
  }
  .actions odd-button::part(control) {
    inline-size: 100%;
  }
  @container odd-action-approval (inline-size < 30rem) {
    .base {
      padding: ${token('space.md')};
      --odd-button-height: ${token('control.height.lg')};
      --odd-field-height: ${token('control.height.lg')};
    }
    .actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
  @media (forced-colors: active) {
    .base {
      border-color: CanvasText;
    }
  }
`;
