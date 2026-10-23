import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { optionRowStructuralStyles } from '../styles/option-row.structural.styles.js';
import { optionRowStyles } from '../styles/option-row.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { OddkinListbox } from './listbox.js';
import { listboxStructuralStyles } from './listbox.structural.styles.js';
import { listboxStyles } from './listbox.styles.js';
import { listboxTemplate } from './listbox.template.js';

export const listboxDefinition = compose({
  name: 'odd-listbox',
  element: OddkinListbox,
  template: listboxTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    optionRowStructuralStyles,
    listboxStructuralStyles,
    glyphStyles,
    spinnerStyles,
    focusRingStyles,
    controlStyles,
    optionRowStyles,
    listboxStyles,
  ],
});
