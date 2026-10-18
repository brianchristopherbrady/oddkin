import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinContextPicker } from './context-picker.js';
import { contextPickerStyles } from './context-picker.styles.js';
import { contextPickerTemplate } from './context-picker.template.js';

export const contextPickerDefinition = compose({
  name: 'odd-context-picker',
  element: OddkinContextPicker,
  template: contextPickerTemplate,
  styles: [aiBaseStyles, contextPickerStyles],
});
