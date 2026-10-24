import { compose } from '@oddkin/core/element';
import { iconDefinition } from '../icon/icon.definition.js';
import { focusRingStyles } from '../styles/focus-ring.styles.js';
import { glyphStyles } from '../styles/glyphs.js';
import { hostStyles } from '../styles/host.styles.js';
import { optionRowStructuralStyles } from '../styles/option-row.structural.styles.js';
import { optionRowStyles } from '../styles/option-row.styles.js';
import { overlaySurfaceStructuralStyles } from '../styles/overlay-surface.structural.styles.js';
import { overlaySurfaceStyles } from '../styles/overlay-surface.styles.js';
import { spinnerStyles } from '../styles/spinner.styles.js';
import { OddkinCommandPalette } from './command-palette.js';
import { commandPaletteStructuralStyles } from './command-palette.structural.styles.js';
import { commandPaletteStyles } from './command-palette.styles.js';
import { commandPaletteTemplate } from './command-palette.template.js';

export const commandPaletteDefinition = compose({
  name: 'odd-command-palette',
  element: OddkinCommandPalette,
  template: commandPaletteTemplate,
  styles: [
    hostStyles,
    overlaySurfaceStructuralStyles,
    optionRowStructuralStyles,
    commandPaletteStructuralStyles,
    glyphStyles,
    spinnerStyles,
    focusRingStyles,
    overlaySurfaceStyles,
    optionRowStyles,
    commandPaletteStyles,
  ],
  // Command icons are drawn by odd-icon, as menu item icons are.
  dependencies: { icon: iconDefinition },
});
