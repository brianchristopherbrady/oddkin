import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinActivity } from './activity.js';
import { activityStyles } from './activity.styles.js';
import { activityTemplate } from './activity.template.js';

export const activityDefinition = compose({
  name: 'odd-activity',
  element: OddkinActivity,
  template: activityTemplate,
  styles: [aiBaseStyles, activityStyles],
});
