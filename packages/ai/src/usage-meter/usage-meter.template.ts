import { html } from '@oddkin/core/template';
import type { OddkinUsageMeter } from './usage-meter.js';

/** Anatomy: a labelled `list` (`<dl>`); each entry has a label, a value, and an optional `meter`. */
export const usageMeterTemplate = (host: OddkinUsageMeter) => {
  const t = host._strings;
  return html`<dl part="list" class="list" aria-label=${host.label || t.label}>
    ${host.usage.map((entry, i) => {
      const measurable =
        entry.precision !== 'unknown' &&
        entry.used !== undefined &&
        entry.limit !== undefined &&
        entry.limit > 0;
      return html`<div class="entry" data-precision=${entry.precision}>
        <dt id=${`usage-${i}`}>${entry.label}</dt>
        <dd>
          <span class="value">${host._value(entry)}</span>
          ${
            measurable
              ? html`<meter
                  part="meter"
                  min="0"
                  .max=${entry.limit ?? 1}
                  .value=${entry.used ?? 0}
                  .high=${(entry.limit ?? 1) * 0.8}
                  .optimum=${0}
                  aria-labelledby=${`usage-${i}`}
                ></meter>`
              : null
          }
        </dd>
      </div>`;
    })}
  </dl>`;
};
