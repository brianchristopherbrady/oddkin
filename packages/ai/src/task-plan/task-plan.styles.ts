import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { taskPlanRecipeStyles } from './task-plan.recipe.styles.js';

/** The arrangement is the layout recipe in `task-plan.recipe.ts`. */
export const taskPlanStyles = css`
  ${taskPlanRecipeStyles}
  .title {
    margin: 0;
    font-weight: ${token('font.weight.semibold')};
  }
  .steps,
  .tasks {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .body {
    flex: 1 1 auto;
  }
  .step-title {
    flex: 1 1 auto;
  }
  .body > :is(.detail, .request, .parallel, .tasks) {
    flex-basis: 100%;
  }
  .task {
    font-size: ${token('font.size.sm')};
  }
  .symbol {
    inline-size: 1.25em;
    flex: none;
    text-align: center;
    color: ${token('color.text.secondary')};
  }
  [data-status='done'] > .symbol,
  [data-status='done'] > .body > .step-title {
    color: ${token('color.success.foreground')};
  }
  [data-status='failed'] > .symbol,
  [data-status='blocked'] > .symbol {
    color: ${token('color.danger.foreground')};
  }
  [data-status='active'] > .body > .step-title,
  [data-status='needs-input'] > .body > .step-title {
    font-weight: ${token('font.weight.medium')};
  }
  .detail,
  .request {
    font-size: ${token('font.size.sm')};
  }
  .parallel {
    margin: ${token('space.2xs')} 0 0;
  }
  .tasks {
    padding-inline-start: ${token('space.xs')};
    border-inline-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
`;
