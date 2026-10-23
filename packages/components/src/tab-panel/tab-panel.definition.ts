import { compose } from '@oddkin/core/element';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinTabPanel } from './tab-panel.js';
import { tabPanelStructuralStyles } from './tab-panel.structural.styles.js';
import { tabPanelStyles } from './tab-panel.styles.js';
import { tabPanelTemplate } from './tab-panel.template.js';

export const tabPanelDefinition = compose({
  name: 'odd-tab-panel',
  element: OddkinTabPanel,
  template: tabPanelTemplate,
  styles: [hostStyles, tabPanelStructuralStyles, tabPanelStyles],
});
