import { compose } from '@oddkin/core/element';
import { glyphStyles } from '../styles/glyphs.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { hostStyles } from '../styles/host.styles.js';
import { OddkinSplitPanel } from './split-panel.js';
import { splitPanelStructuralStyles } from './split-panel.structural.styles.js';
import { splitPanelStyles } from './split-panel.styles.js';
import { splitPanelTemplate } from './split-panel.template.js';

export const splitPanelDefinition = compose({
  name: 'odd-split-panel',
  element: OddkinSplitPanel,
  template: splitPanelTemplate,
  styles: [hostStyles, splitPanelStructuralStyles, glyphStyles, focusRingStyles, splitPanelStyles],
});
