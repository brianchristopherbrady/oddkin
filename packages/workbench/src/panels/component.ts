/**
 * `@oddkin/workbench/panels/component` — `<oddkin-component-panel>`: a component's detail page
 * (overview, interactive example, editable API table, examples, tokens, behavior, source,
 * limitations) in an open shadow root. Inputs are properties: `page`, `index`, `href`, and
 * `frameUrl`. No app root or router is needed; register with `./panels/component/define`.
 */
import { ComponentDetailElement } from './component-detail.js';

export class OddkinComponentPanel extends ComponentDetailElement {}

export type { EventLogEntry } from './component-detail.js';
export type { ComponentPageData, WorkbenchIndex } from '../data/types.js';

declare global {
  interface HTMLElementTagNameMap {
    'oddkin-component-panel': OddkinComponentPanel;
  }
}
