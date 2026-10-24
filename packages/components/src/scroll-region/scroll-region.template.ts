import { html } from '@oddkin/core/template';
import type { OddkinScrollRegion } from './scroll-region.js';

/**
 * Anatomy: `part="base"`, the scroller (focusable `region` while it overflows), around the
 * content wrapper and the default slot.
 */
export const scrollRegionTemplate = (region: OddkinScrollRegion) => {
  const overflowing = region._overflowing.value;
  return html`<div
    part="base"
    class="base"
    tabindex=${overflowing ? '0' : null}
    role=${overflowing ? 'region' : null}
    aria-label=${overflowing ? region._label : null}
  >
    <div class="content"><slot></slot></div>
  </div>`;
};
