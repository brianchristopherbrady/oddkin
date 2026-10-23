import { compose } from '@oddkin/core/element';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { tabPanelDefinition } from '../tab-panel/tab-panel.definition.js';
import { OddkinTabs } from './tabs.js';
import { tabsStructuralStyles } from './tabs.structural.styles.js';
import { tabsStyles } from './tabs.styles.js';
import { tabsTemplate } from './tabs.template.js';

export const tabsDefinition = compose({
  name: 'odd-tabs',
  element: OddkinTabs,
  template: tabsTemplate,
  styles: [hostStyles, tabsStructuralStyles, focusRingStyles, tabsStyles],
  // Registering odd-tabs registers the panels it reads.
  dependencies: { panel: tabPanelDefinition },
});
