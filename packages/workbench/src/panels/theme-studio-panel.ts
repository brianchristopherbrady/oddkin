/**
 * `@oddkin/workbench/panels/theme-studio` — `<oddkin-theme-studio-panel>`: Theme Studio (draft,
 * generation, light and dark screens, export) in an open shadow root. Inputs are properties:
 * `page` (the `theme-studio` page data) and `frameUrl`. No app root or router is needed; register
 * with `./panels/theme-studio/define`.
 */
import { ThemeStudioElement } from './theme-studio.js';

export class OddkinThemeStudioPanel extends ThemeStudioElement {}

export type { ThemeStudioPageData, ThemeStudioScreens } from '../data/types.js';

declare global {
  interface HTMLElementTagNameMap {
    'oddkin-theme-studio-panel': OddkinThemeStudioPanel;
  }
}
