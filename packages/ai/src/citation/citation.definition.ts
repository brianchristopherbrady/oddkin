import { compose } from '@oddkin/core/element';
import { popoverDefinition } from '@oddkin/components/popover';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinCitation } from './citation.js';
import { citationStyles } from './citation.styles.js';
import { citationTemplate } from './citation.template.js';

export const citationDefinition = compose({
  name: 'odd-citation',
  element: OddkinCitation,
  template: citationTemplate,
  styles: [aiBaseStyles, citationStyles],
  dependencies: { popover: popoverDefinition },
});
