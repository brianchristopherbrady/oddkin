import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { toneStyles } from '../styles/tone.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinAlert } from './alert.js';
import { alertStructuralStyles } from './alert.structural.styles.js';
import { alertStyles } from './alert.styles.js';
import { alertTemplate } from './alert.template.js';

export const alertDefinition = compose({
  name: 'odd-alert',
  element: OddkinAlert,
  template: alertTemplate,
  styles: [hostStyles, alertStructuralStyles, glyphStyles, toneStyles, alertStyles],
});
