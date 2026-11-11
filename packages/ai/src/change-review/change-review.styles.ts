import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { diffViewStyles } from '../internal/diff-view.js';
import { changeReviewRecipeStyles } from './change-review.recipe.styles.js';

/**
 * The arrangement is the layout recipe in `change-review.recipe.ts`. Side by side, the two sides
 * are the cards, and proposals sit further apart than their parts. The diff draws with the shared
 * diff view (`internal/diff-view.ts`); the unchanged text around a change (`.context`) shows the
 * reader where it applies. The title, the attention badge at its width, and each proposal's
 * revision in small secondary type follow Figma page 11 lightly, until its visual pass.
 */
export const changeReviewStyles = css`
  ${changeReviewRecipeStyles}
  .title {
    font-weight: ${token('font.weight.semibold')};
  }
  .status-badge {
    align-self: start;
  }
  .revision {
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .proposal {
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.md')};
    background: ${token('color.surface.default')};
  }
  .proposal[data-status='stale'],
  .proposal[data-status='failed'],
  :host([view='split']) .proposal:is([data-status='stale'], [data-status='failed']) .side {
    border-color: ${token('color.danger.foreground')};
  }
  :host([view='split']) .list {
    row-gap: ${token('space.lg')};
  }
  :host([view='split']) .proposal {
    padding: 0;
    border: none;
    border-radius: 0;
    background: none;
  }
  .side {
    padding: ${token('space.sm')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.default')};
  }
  .side > .muted {
    font-weight: ${token('font.weight.medium')};
  }
  p {
    margin: 0;
  }
  .label {
    font-weight: ${token('font.weight.semibold')};
  }
  ${diffViewStyles}
`;
