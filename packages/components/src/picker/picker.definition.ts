import { compose } from '@oddkin/core/element';
import { avatarDefinition } from '../avatar/avatar.definition.js';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { chipStructuralStyles } from '../chip/chip.structural.styles.js';
import { chipStyles } from '../chip/chip.styles.js';
import { comboboxStructuralStyles } from '../combobox/combobox.structural.styles.js';
import { comboboxStyles } from '../combobox/combobox.styles.js';
import { iconDefinition } from '../icon/icon.definition.js';
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
import { navRowStructuralStyles } from '../styles/nav-row.structural.styles.js';
import { navRowStyles } from '../styles/nav-row.styles.js';
import { optionRowStructuralStyles } from '../styles/option-row.structural.styles.js';
import { optionRowStyles } from '../styles/option-row.styles.js';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { visuallyHiddenStyles } from '../styles/visually-hidden.styles.js';
import { treeStructuralStyles } from '../tree/tree.structural.styles.js';
import { OddkinPicker } from './picker.js';
import { pickerStructuralStyles } from './picker.structural.styles.js';
import { pickerStyles } from './picker.styles.js';
import { pickerTemplate } from './picker.template.js';

// One home per decision: the field, chips, and clear button are odd-combobox's sheets (its
// `.combobox` is the trigger here), the option rows odd-listbox's, the tree rows odd-tree's, the
// footer actions the native button module's (no nested elements but odd-tree's item icons).
export const pickerDefinition = compose({
  name: 'odd-picker',
  element: OddkinPicker,
  template: pickerTemplate,
  styles: [
    hostStyles,
    chipStructuralStyles,
    fieldStructuralStyles,
    optionRowStructuralStyles,
    controlIndicatorStructuralStyles,
    listboxStructuralStyles,
    navRowStructuralStyles,
    treeStructuralStyles,
    overlaySurfaceStructuralStyles,
    inputStructuralStyles,
    visuallyHiddenStyles,
    comboboxStructuralStyles,
    pickerStructuralStyles,
    glyphStyles,
    spinnerStyles,
    focusRingStyles,
    controlStyles,
    chipStyles,
    inputStyles,
    nativeButtonStyles,
    overlaySurfaceStyles,
    controlIndicatorStyles,
    optionRowStyles,
    listboxStyles,
    navRowStyles,
    comboboxStyles,
    pickerStyles,
  ],
  // Tree item icons are drawn by odd-icon.
  dependencies: { avatar: avatarDefinition, icon: iconDefinition },
});
