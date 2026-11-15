import {
  controlIndicatorStructuralStyles,
  controlIndicatorStyles,
  controlStyles,
  fieldStructuralStyles,
  glyphStyles,
  optionRowStructuralStyles,
  optionRowStyles,
  overlaySurfaceStructuralStyles,
  overlaySurfaceStyles,
} from '@oddkin/components/styles';
import { chipDefinition } from '@oddkin/components/chip';
import { iconDefinition } from '@oddkin/components/icon';
import { tooltipDefinition } from '@oddkin/components/tooltip';
import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinContextPicker } from './context-picker.js';
import { contextPickerStyles } from './context-picker.styles.js';
import { contextPickerTemplate } from './context-picker.template.js';

export const contextPickerDefinition = compose({
  name: 'odd-context-picker',
  element: OddkinContextPicker,
  template: contextPickerTemplate,
  styles: [
    aiBaseStyles,
    glyphStyles,
    fieldStructuralStyles,
    controlStyles,
    overlaySurfaceStructuralStyles,
    overlaySurfaceStyles,
    optionRowStructuralStyles,
    optionRowStyles,
    controlIndicatorStructuralStyles,
    controlIndicatorStyles,
    contextPickerStyles,
  ],
  // The icon trigger's tooltip, resource icons by kind, and the browser's removable chips.
  dependencies: { chip: chipDefinition, icon: iconDefinition, tooltip: tooltipDefinition },
});
