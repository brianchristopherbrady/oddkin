import { compose } from '@oddkin/core';
import { AcmeGreeting } from './greeting.js';
import { greetingStyles } from './greeting.styles.js';
import { greetingTemplate } from './greeting.template.js';

export const greetingDefinition = compose({
  name: 'acme-greeting',
  element: AcmeGreeting,
  template: greetingTemplate,
  styles: greetingStyles,
});
