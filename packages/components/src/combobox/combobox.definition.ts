import { compose } from '@oddkin/core/element';
import { chipStructuralStyles } from '../chip/chip.structural.styles.js';
import { chipStyles } from '../chip/chip.styles.js';
import { inputStructuralStyles } from '../input/input.structural.styles.js';
import { inputStyles } from '../input/input.styles.js';
import { listboxStructuralStyles } from '../listbox/listbox.structural.styles.js';
import { listboxStyles } from '../listbox/listbox.styles.js';
import { controlIndicatorStructuralStyles } from '../styles/control-indicator.structural.styles.js';
import { controlIndicatorStyles } from '../styles/control-indicator.styles.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { optionRowStructuralStyles } from '../styles/option-row.structural.styles.js';
import { optionRowStyles } from '../styles/option-row.styles.js';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { OddkinCombobox } from './combobox.js';
import { comboboxStructuralStyles } from './combobox.structural.styles.js';
import { comboboxStyles } from './combobox.styles.js';
import { comboboxTemplate } from './combobox.template.js';

// One home per decision: the chips are odd-chip's sheets, the clear button odd-input's, the rows
// and states odd-listbox's (no nested elements; constructed sheets are shared per document).
export const comboboxDefinition = compose({
  name: 'odd-combobox',
  element: OddkinCombobox,
  template: comboboxTemplate,
  styles: [
    hostStyles,
    chipStructuralStyles,
    fieldStructuralStyles,
    optionRowStructuralStyles,
    listboxStructuralStyles,
    overlaySurfaceStructuralStyles,
    controlIndicatorStructuralStyles,
    inputStructuralStyles,
    visuallyHiddenStyles,
    comboboxStructuralStyles,
    glyphStyles,
    spinnerStyles,
    focusRingStyles,
    controlStyles,
    controlIndicatorStyles,
    chipStyles,
    inputStyles,
    overlaySurfaceStyles,
    optionRowStyles,
    listboxStyles,
    comboboxStyles,
  ],
});
