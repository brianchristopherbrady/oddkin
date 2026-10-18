import { buttonDefinition, buttonStructuralStyles } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { StudioButton } from './button.js';
import { studioButtonStyles } from './button.styles.js';

// Level 3: the shared template and structural styles, Studio's skin instead of the default one.
export const studioButtonDefinition = compose({
  ...buttonDefinition,
  name: 'studio-button',
  element: StudioButton,
  styles: [buttonStructuralStyles, studioButtonStyles],
});
