/**
 * `@oddkin/workbench/panels/foundation` — `<oddkin-foundation-panel>`: a foundation page's
 * generated sections (the Spacing scale and vocabularies, token tables) in an open shadow root.
 * Inputs are properties: `page`, `index`, and `href`. Register with `./panels/foundation/define`.
 */
import { FoundationDetailElement } from './foundation-detail.js';

export class OddkinFoundationPanel extends FoundationDetailElement {}

export type { FoundationPageData, WorkbenchIndex } from '../data/types.js';

declare global {
  interface HTMLElementTagNameMap {
    'oddkin-foundation-panel': OddkinFoundationPanel;
  }
}
