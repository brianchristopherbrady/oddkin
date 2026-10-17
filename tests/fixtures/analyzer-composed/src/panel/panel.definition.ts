import { compose } from '@mote/core';
import { AcmePanel } from './panel.js';
import { panelStyles } from './panel.styles.js';
import { panelTemplate } from './panel.template.js';

export const panelDefinition = compose({
  name: 'acme-panel',
  element: AcmePanel,
  template: panelTemplate,
  styles: [panelStyles],
});
