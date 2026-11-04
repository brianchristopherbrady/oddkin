import { compose } from '@oddkin/core/element';
import { controlIndicatorStructuralStyles } from '../styles/control-indicator.structural.styles.js';
import { controlIndicatorStyles } from '../styles/control-indicator.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { OddkinTable } from './table.js';
import { tableStructuralStyles } from './table.structural.styles.js';
import { tableStyles } from './table.styles.js';
import { tableTemplate } from './table.template.js';

export const tableDefinition = compose({
  name: 'odd-table',
  element: OddkinTable,
  template: tableTemplate,
  styles: [
    hostStyles,
    controlIndicatorStructuralStyles,
    tableStructuralStyles,
    glyphStyles,
    spinnerStyles,
    visuallyHiddenStyles,
    focusRingStyles,
    controlIndicatorStyles,
    tableStyles,
  ],
});
