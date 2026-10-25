import { html } from '@oddkin/core/template';
import { spinnerTemplate } from '../styles/spinner.styles.js';
import { checkGlyph, warningGlyph } from '../styles/glyphs.js';
import type { OddkinStatusMarker } from './status-marker.js';

/** Anatomy: `part="base"`, the circle, holding the status glyph, or the default slot while idle. */
export const statusMarkerTemplate = (marker: OddkinStatusMarker) =>
  html`<span part="base" class="base"
    >${
      marker.status === 'complete'
        ? checkGlyph
        : marker.status === 'failed'
          ? warningGlyph
          : marker.status === 'pending'
            ? spinnerTemplate
            : html`<slot></slot>`
    }</span
  >`;
