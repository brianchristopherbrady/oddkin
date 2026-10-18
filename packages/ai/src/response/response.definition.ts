import { compose } from '@oddkin/core/element';
import { citationDefinition } from '../citation/citation.definition.js';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinResponse } from './response.js';
import { responseStyles } from './response.styles.js';
import { responseTemplate } from './response.template.js';

export const responseDefinition = compose({
  name: 'odd-response',
  element: OddkinResponse,
  template: responseTemplate,
  styles: [aiBaseStyles, responseStyles],
  dependencies: { citation: citationDefinition },
});
