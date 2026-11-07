import { html } from '@oddkin/core/template';
import { formatTime, langOf } from '../internal/strings.js';
import type { OddkinAiLabel } from './ai-label.js';

/**
 * Anatomy: an `odd-disclosure` (`base`) whose summary, exported as `label`, is the label and
 * whose content lists the origin.
 */
export const aiLabelTemplate = (host: OddkinAiLabel) => {
  const t = host._strings;
  const p = host.provenance;
  if (!p) return html``;
  const label = p.label ?? t[p.kind];
  const when = formatTime(p.generatedAt, langOf(host));
  const hasDetails = !!(p.model || p.provider || when || p.notes);
  return html`<odd-disclosure
    class="base"
    part="base"
    exportparts="summary: label"
    label=${label}
    data-kind=${p.kind}
  >
    <dl part="details" class="details" ?hidden=${!hasDetails}>
      <div ?hidden=${!p.model}>
        <dt>${t.model}</dt>
        <dd>${p.model ?? ''}</dd>
      </div>
      <div ?hidden=${!p.provider}>
        <dt>${t.provider}</dt>
        <dd>${p.provider ?? ''}</dd>
      </div>
      <div ?hidden=${!when}>
        <dt>${t.generatedAt}</dt>
        <dd>${when ?? ''}</dd>
      </div>
    </dl>
    <p class="notes" ?hidden=${!p.notes}>${p.notes ?? ''}</p>
    <p class="muted">${t.disclaimer}</p>
  </odd-disclosure>`;
};
