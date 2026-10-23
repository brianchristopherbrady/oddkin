import { html } from '@oddkin/core/template';
import { toneGlyph } from '../styles/tone.styles.js';
import type { OddkinAlert } from './alert.js';

/**
 * Anatomy: `part="base"` with the `marker` glyph, the `label` title above the default slot, and
 * the `end` slot for actions. Alternative templates keep the glyph and the title.
 */
export const alertTemplate = (alert: OddkinAlert) =>
  html`<div part="base" class="alert">
    <span part="marker" class="marker">${toneGlyph(alert.tone)}</span>
    <div class="content">
      <p part="label" class="label" ?hidden=${!alert.label}>${alert.label}</p>
      <div class="message"><slot></slot></div>
    </div>
    <div class="end"><slot name="end"></slot></div>
  </div>`;
