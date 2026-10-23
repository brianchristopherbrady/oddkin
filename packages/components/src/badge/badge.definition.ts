import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { toneStyles } from '../styles/tone.styles.js';
import { OddkinBadge } from './badge.js';
import { badgeStructuralStyles } from './badge.structural.styles.js';
import { badgeStyles } from './badge.styles.js';
import { badgeTemplate } from './badge.template.js';

export const badgeDefinition = compose({
  name: 'odd-badge',
  element: OddkinBadge,
  template: badgeTemplate,
  styles: [hostStyles, badgeStructuralStyles, glyphStyles, toneStyles, badgeStyles],
});
