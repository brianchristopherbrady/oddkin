import { html } from '@oddkin/core/template';
import { toneGlyph } from '../styles/tone.styles.js';
import type { OddkinBadge } from './badge.js';

/** Anatomy: `part="base"` holding the `marker` glyph (unless `no-marker`) and the default slot. */
export const badgeTemplate = (badge: OddkinBadge) =>
  html`<span part="base" class="badge"
    ><span part="marker" class="marker" ?hidden=${badge.noMarker}>${toneGlyph(badge.tone)}</span
    ><slot></slot
  ></span>`;
