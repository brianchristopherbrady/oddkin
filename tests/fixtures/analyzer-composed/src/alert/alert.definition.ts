import { compose } from '@oddkin/core';
import { panelDefinition } from '../panel/panel.definition.js';
import { AcmeAlert } from './alert.js';

// Recomposes the panel: same template and styles, its own class and name.
export const alertDefinition = compose({
  ...panelDefinition,
  name: 'acme-alert',
  element: AcmeAlert,
  dependencies: { panel: panelDefinition },
});
