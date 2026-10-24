import { compose } from '@oddkin/core/element';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { toneStyles } from '../styles/tone.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinToast } from './toast.js';
import { toastStructuralStyles } from './toast.structural.styles.js';
import { toastStyles } from './toast.styles.js';
import { toastTemplate } from './toast.template.js';

export const toastDefinition = compose({
  name: 'odd-toast',
  element: OddkinToast,
  template: toastTemplate,
  styles: [
    hostStyles,
    toastStructuralStyles,
    overlaySurfaceStructuralStyles,
    glyphStyles,
    toneStyles,
    overlaySurfaceStyles,
    toastStyles,
  ],
});
