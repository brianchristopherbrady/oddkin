import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinTaskPlan } from './task-plan.js';
import { taskPlanStyles } from './task-plan.styles.js';
import { taskPlanTemplate } from './task-plan.template.js';

export const taskPlanDefinition = compose({
  name: 'odd-task-plan',
  element: OddkinTaskPlan,
  template: taskPlanTemplate,
  styles: [aiBaseStyles, taskPlanStyles],
});
