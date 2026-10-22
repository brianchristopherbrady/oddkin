/**
 * Registers `<oddkin-workbench-theme-studio>`, Theme Studio's content in the shell's light DOM.
 * The shell imports this module only when the Theme Studio route renders, so other pages never
 * load the editor, its model, or the generation client.
 */
import { define } from '@oddkin/core/element';
import type { StyleInput } from '@oddkin/core/styles';
import { contentStyles } from '../panels/styles.js';
import { ThemeStudioElement } from '../panels/theme-studio.js';

export class WorkbenchThemeStudio extends ThemeStudioElement {
  static override shadowRootOptions = null;
  static override styles: StyleInput = contentStyles;
}

define('oddkin-workbench-theme-studio', WorkbenchThemeStudio);

declare global {
  interface HTMLElementTagNameMap {
    'oddkin-workbench-theme-studio': WorkbenchThemeStudio;
  }
}
