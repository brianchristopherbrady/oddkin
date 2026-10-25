import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinStatusMarker } from './status-marker.js';
import { statusMarkerStructuralStyles } from './status-marker.structural.styles.js';
import { statusMarkerStyles } from './status-marker.styles.js';
import { statusMarkerTemplate } from './status-marker.template.js';

export const statusMarkerDefinition = compose({
  name: 'odd-status-marker',
  element: OddkinStatusMarker,
  template: statusMarkerTemplate,
  styles: [
    hostStyles,
    statusMarkerStructuralStyles,
    glyphStyles,
    spinnerStyles,
    statusMarkerStyles,
  ],
});
