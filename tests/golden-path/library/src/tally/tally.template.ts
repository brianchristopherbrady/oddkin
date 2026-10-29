import { html } from '@oddkin/core';
import type { AcmeTally } from './tally.js';

export const tallyTemplate = (tally: AcmeTally) =>
  html`<button type="button" part="button" @click=${tally._increment}>
    ${tally.label}: <output>${tally.count}</output>
  </button>`;
