import { compose } from '@oddkin/core/element';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinTooltip } from './tooltip.js';
import { tooltipStructuralStyles } from './tooltip.structural.styles.js';
import { tooltipStyles } from './tooltip.styles.js';
import { tooltipTemplate } from './tooltip.template.js';

export const tooltipDefinition = compose({
  name: 'odd-tooltip',
  element: OddkinTooltip,
  template: tooltipTemplate,
  styles: [
    hostStyles,
    tooltipStructuralStyles,
    overlaySurfaceStructuralStyles,
    overlaySurfaceStyles,
    tooltipStyles,
  ],
});
