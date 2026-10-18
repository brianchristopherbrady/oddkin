import { compose } from '@oddkin/core/element';
import { aiBaseStyles } from '../internal/base.styles.js';
import { OddkinSuggestions } from './suggestions.js';
import { suggestionsStyles } from './suggestions.styles.js';
import { suggestionsTemplate } from './suggestions.template.js';

export const suggestionsDefinition = compose({
  name: 'odd-suggestions',
  element: OddkinSuggestions,
  template: suggestionsTemplate,
  styles: [aiBaseStyles, suggestionsStyles],
});
