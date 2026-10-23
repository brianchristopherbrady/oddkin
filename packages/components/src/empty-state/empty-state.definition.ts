import { compose } from '@oddkin/core/element';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinEmptyState } from './empty-state.js';
import { emptyStateStructuralStyles } from './empty-state.structural.styles.js';
import { emptyStateStyles } from './empty-state.styles.js';
import { emptyStateTemplate } from './empty-state.template.js';

export const emptyStateDefinition = compose({
  name: 'odd-empty-state',
  element: OddkinEmptyState,
  template: emptyStateTemplate,
  styles: [hostStyles, emptyStateStructuralStyles, emptyStateStyles],
});
