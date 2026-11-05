import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the task plan (layout-recipes.md §14), as the Figma specimen has it: title,
 * progress, and steps stacked; each step and task its symbol beside its body, on the text's
 * baseline; a step's title and status on one line, the status at its end.
 */
export const taskPlanRecipe = defineLayoutRecipe({
  name: 'task-plan',
  regions: {
    base: stack({ gap: token('space.xs') }),
    steps: stack({ gap: token('space.xs') }),
    tasks: stack({ gap: token('space.xs') }),
    step: row({ gap: token('space.xs'), align: 'baseline' }),
    task: row({ gap: token('space.xs'), align: 'baseline' }),
    body: row({ gap: token('space.sm'), align: 'baseline', wrap: true }),
  },
});
