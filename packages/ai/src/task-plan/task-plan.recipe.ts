import { defineLayoutRecipe, row, stack } from '@oddkin/components/layout';
import { token } from '@oddkin/tokens/refs';

/**
 * Arrangement of the task plan (layout-recipes.md §14): title, progress, and steps stacked; the
 * progress line in a centred row that wraps; each step and task its symbol beside its body, on
 * the text's baseline.
 */
export const taskPlanRecipe = defineLayoutRecipe({
  name: 'task-plan',
  regions: {
    base: stack({ gap: token('space.sm') }),
    progress: row({ gap: token('space.xs'), wrap: true }),
    steps: stack({ gap: token('space.xs') }),
    tasks: stack({ gap: token('space.xs') }),
    step: row({ gap: token('space.xs'), align: 'baseline' }),
    task: row({ gap: token('space.xs'), align: 'baseline' }),
    body: stack({ gap: '0.125rem' }),
  },
});
