import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinPagination } from './pagination.js';
import { paginationStructuralStyles } from './pagination.structural.styles.js';
import { paginationStyles } from './pagination.styles.js';
import { paginationTemplate } from './pagination.template.js';

export const paginationDefinition = compose({
  name: 'odd-pagination',
  element: OddkinPagination,
  template: paginationTemplate,
  styles: [hostStyles, paginationStructuralStyles, glyphStyles, focusRingStyles, paginationStyles],
});
