import { compose } from '@oddkin/core/element';
import { nativeButtonStyles } from '../button/button.native.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinCarousel } from './carousel.js';
import { carouselStructuralStyles } from './carousel.structural.styles.js';
import { carouselStyles } from './carousel.styles.js';
import { carouselTemplate } from './carousel.template.js';

export const carouselDefinition = compose({
  name: 'odd-carousel',
  element: OddkinCarousel,
  template: carouselTemplate,
  styles: [
    hostStyles,
    carouselStructuralStyles,
    glyphStyles,
    focusRingStyles,
    nativeButtonStyles,
    carouselStyles,
  ],
});
