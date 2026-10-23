import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinDisclosure } from './disclosure.js';
import { disclosureStructuralStyles } from './disclosure.structural.styles.js';
import { disclosureStyles } from './disclosure.styles.js';
import { disclosureTemplate } from './disclosure.template.js';

export const disclosureDefinition = compose({
  name: 'odd-disclosure',
  element: OddkinDisclosure,
  template: disclosureTemplate,
  styles: [hostStyles, disclosureStructuralStyles, glyphStyles, disclosureStyles],
});
