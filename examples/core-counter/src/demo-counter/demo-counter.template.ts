import { html } from '@oddkin/core';
import type { DemoCounter } from './demo-counter.js';

// `label` is a tracked read (re-runs the template); `_count` binds the readable directly.
export const demoCounterTemplate = (counter: DemoCounter) =>
  html`<button type="button" @click=${counter._increment}>
    ${counter.label}: <output>${counter._count}</output>
  </button>`;
