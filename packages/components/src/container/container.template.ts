import { html } from '@oddkin/core/template';
import type { OddkinContainer } from './container.js';

/** Anatomy: `part="base"` around the default slot. */
export const containerTemplate = (_container: OddkinContainer) =>
  html`<div part="base" class="base"><slot></slot></div>`;
