import { html } from '@oddkin/core/template';
import type { OddkinSpinner } from './spinner.js';

/**
 * Anatomy: `part="base"` with `role="progressbar"` named by the text beside the `indicator`: the
 * slotted text when present, otherwise `label` (or the built-in "Loading"), visually hidden.
 */
export const spinnerTemplate = (spinner: OddkinSpinner) =>
  html`<span part="base" class="base" role="progressbar" aria-labelledby="text"
    ><span part="indicator" class="spinner"></span
    ><span id="text" class=${spinner._hasText.value ? 'text' : 'visually-hidden'}
      ><slot @slotchange=${spinner._onSlotChange}
        >${spinner.label || spinner._strings.loading}</slot
      ></span
    ></span
  >`;
