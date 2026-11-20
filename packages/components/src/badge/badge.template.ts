import { html } from '@oddkin/core/template';
import { toneGlyph } from '../styles/tone.styles.js';
import type { OddkinBadge } from './badge.js';

/** One label keeps slotted text and inline emphasis in the same text flow. */
export const badgeTemplate = (badge: OddkinBadge) =>
  html`<span part="base" class="badge"
    ><span part="marker" class="marker" ?hidden=${badge.noMarker}>${toneGlyph(badge.tone)}</span
    ><span class="label"><slot></slot></span
  ></span>`;
