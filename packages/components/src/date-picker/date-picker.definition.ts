import { compose } from '@oddkin/core/element';
import { calendarDefinition } from '../calendar/calendar.definition.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { OddkinDatePicker } from './date-picker.js';
import { datePickerStructuralStyles } from './date-picker.structural.styles.js';
import { datePickerStyles } from './date-picker.styles.js';
import { datePickerTemplate } from './date-picker.template.js';

export const datePickerDefinition = compose({
  name: 'odd-date-picker',
  element: OddkinDatePicker,
  template: datePickerTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    overlaySurfaceStructuralStyles,
    datePickerStructuralStyles,
    glyphStyles,
    focusRingStyles,
    controlStyles,
    overlaySurfaceStyles,
    datePickerStyles,
  ],
  // The popup holds a complete odd-calendar.
  dependencies: { calendar: calendarDefinition },
});
