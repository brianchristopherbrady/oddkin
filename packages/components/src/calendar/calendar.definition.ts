import { compose } from '@oddkin/core/element';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinCalendar } from './calendar.js';
import { calendarStructuralStyles } from './calendar.structural.styles.js';
import { calendarStyles } from './calendar.styles.js';
import { calendarTemplate } from './calendar.template.js';

export const calendarDefinition = compose({
  name: 'odd-calendar',
  element: OddkinCalendar,
  template: calendarTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    calendarStructuralStyles,
    glyphStyles,
    focusRingStyles,
    controlStyles,
    nativeButtonStyles,
    calendarStyles,
  ],
});
