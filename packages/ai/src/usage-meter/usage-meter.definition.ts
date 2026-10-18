import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinUsageMeter } from './usage-meter.js';
import { usageMeterStyles } from './usage-meter.styles.js';
import { usageMeterTemplate } from './usage-meter.template.js';

export const usageMeterDefinition = compose({
  name: 'odd-usage-meter',
  element: OddkinUsageMeter,
  template: usageMeterTemplate,
  styles: [aiBaseStyles, usageMeterStyles],
});
