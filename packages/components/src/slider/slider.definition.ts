import { compose } from '@oddkin/core/element';
import { controlStyles } from '../styles/control.styles.js';
import { fieldStructuralStyles } from '../styles/field.structural.styles.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinSlider } from './slider.js';
import { sliderStructuralStyles } from './slider.structural.styles.js';
import { sliderStyles } from './slider.styles.js';
import { sliderTemplate } from './slider.template.js';

export const sliderDefinition = compose({
  name: 'odd-slider',
  element: OddkinSlider,
  template: sliderTemplate,
  styles: [
    hostStyles,
    fieldStructuralStyles,
    sliderStructuralStyles,
    focusRingStyles,
    controlStyles,
    sliderStyles,
  ],
});
