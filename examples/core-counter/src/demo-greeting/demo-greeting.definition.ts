import { compose } from '@mote/core';
import { DemoGreeting } from './demo-greeting.js';
import { demoGreetingStyles } from './demo-greeting.styles.js';
import { demoGreetingTemplate } from './demo-greeting.template.js';

export const demoGreetingDefinition = compose({
  name: 'demo-greeting',
  element: DemoGreeting,
  template: demoGreetingTemplate,
  styles: demoGreetingStyles,
});
