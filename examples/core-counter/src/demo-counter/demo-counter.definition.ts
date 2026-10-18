import { compose } from '@oddkin/core';
import { DemoCounter } from './demo-counter.js';
import { demoCounterStyles } from './demo-counter.styles.js';
import { demoCounterTemplate } from './demo-counter.template.js';

export const demoCounterDefinition = compose({
  name: 'demo-counter',
  element: DemoCounter,
  template: demoCounterTemplate,
  styles: demoCounterStyles,
});
