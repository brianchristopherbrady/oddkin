import { compose } from '@oddkin/core/element';
import { OddkinCard } from './card.js';
import { cardStructuralStyles } from './card.structural.styles.js';
import { cardStyles } from './card.styles.js';
import { cardTemplate } from './card.template.js';

export const cardDefinition = compose({
  name: 'odd-card',
  element: OddkinCard,
  template: cardTemplate,
  styles: [cardStructuralStyles, cardStyles],
});
