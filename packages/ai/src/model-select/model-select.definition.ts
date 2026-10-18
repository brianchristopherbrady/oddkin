import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinModelSelect } from './model-select.js';
import { modelSelectStyles } from './model-select.styles.js';
import { modelSelectTemplate } from './model-select.template.js';

export const modelSelectDefinition = compose({
  name: 'odd-model-select',
  element: OddkinModelSelect,
  template: modelSelectTemplate,
  styles: [aiBaseStyles, modelSelectStyles],
});
