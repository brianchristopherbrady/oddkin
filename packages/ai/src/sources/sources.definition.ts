import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinSources } from './sources.js';
import { sourcesStyles } from './sources.styles.js';
import { sourcesTemplate } from './sources.template.js';

export const sourcesDefinition = compose({
  name: 'odd-sources',
  element: OddkinSources,
  template: sourcesTemplate,
  styles: [aiBaseStyles, sourcesStyles],
});
