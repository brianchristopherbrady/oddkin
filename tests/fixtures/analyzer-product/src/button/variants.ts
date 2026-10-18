import { OddkinButton, buttonDefinition, buttonStructuralStyles } from '@oddkin/components/button';
import { compose } from '@oddkin/core/element';
import { html } from '@oddkin/core/template';

class StudioQuietButton extends OddkinButton {}
class StudioIconButton extends OddkinButton {}

// Level 3 without new styles: everything but the name and class comes from the foundation.
export const studioQuietButtonDefinition = compose({
  ...buttonDefinition,
  name: 'studio-quiet-button',
  element: StudioQuietButton,
});

// A different template keeping the control anatomy, without the start and end slots or spinner.
export const studioIconTemplate = (b: OddkinButton) =>
  html`<button part="control icon" type="button" aria-label=${b.label || null}>
    <slot></slot>
  </button>`;
export const studioIconButtonDefinition = compose({
  ...buttonDefinition,
  name: 'studio-icon-button',
  element: StudioIconButton,
  template: studioIconTemplate,
  styles: [buttonStructuralStyles],
});

// Reusing the published class for another name is reported, not documented.
export const studioReusedButtonDefinition = compose({
  ...buttonDefinition,
  name: 'studio-reused-button',
});
