import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinRelativeTime } from './relative-time.js';
import { relativeTimeStructuralStyles } from './relative-time.structural.styles.js';
import { relativeTimeStyles } from './relative-time.styles.js';
import { relativeTimeTemplate } from './relative-time.template.js';

export const relativeTimeDefinition = compose({
  name: 'odd-relative-time',
  element: OddkinRelativeTime,
  template: relativeTimeTemplate,
  styles: [hostStyles, relativeTimeStructuralStyles, glyphStyles, relativeTimeStyles],
});
