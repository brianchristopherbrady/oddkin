import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { OddkinBreadcrumbs } from './breadcrumbs.js';
import { breadcrumbsStructuralStyles } from './breadcrumbs.structural.styles.js';
import { breadcrumbsStyles } from './breadcrumbs.styles.js';
import { breadcrumbsTemplate } from './breadcrumbs.template.js';

export const breadcrumbsDefinition = compose({
  name: 'odd-breadcrumbs',
  element: OddkinBreadcrumbs,
  template: breadcrumbsTemplate,
  styles: [
    hostStyles,
    breadcrumbsStructuralStyles,
    glyphStyles,
    visuallyHiddenStyles,
    focusRingStyles,
    breadcrumbsStyles,
  ],
});
