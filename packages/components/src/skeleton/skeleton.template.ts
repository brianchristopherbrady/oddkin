import { html } from '@oddkin/core/template';
import type { OddkinSkeleton } from './skeleton.js';

/** Anatomy: `lines` × `part="line"` for text, otherwise one `part="base"` block. */
export const skeletonTemplate = (skeleton: OddkinSkeleton) =>
  skeleton.shape === 'text'
    ? html`<span class="lines"
        >${Array.from({ length: skeleton._lines }, () => html`<span part="line" class="line"></span>`)}</span
      >`
    : html`<span part="base" class="block"></span>`;
