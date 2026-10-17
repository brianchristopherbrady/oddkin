import { compose } from '@mote/core/element';
import { MoteCard } from './card.js';
import { cardStructuralStyles } from './card.structural.styles.js';
import { cardStyles } from './card.styles.js';
import { cardTemplate } from './card.template.js';

export const cardDefinition = compose({
  name: 'mote-card',
  element: MoteCard,
  template: cardTemplate,
  styles: [cardStructuralStyles, cardStyles],
});
