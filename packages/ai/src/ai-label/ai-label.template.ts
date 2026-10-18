import { html } from '@oddkin/core/template';
import { formatTime, langOf } from '../internal/strings.js';
import type { OddkinAiLabel } from './ai-label.js';

/** Anatomy: a native `<details>` whose `summary` is the label and whose body lists the origin. */
export const aiLabelTemplate = (host: OddkinAiLabel) => {
  const t = host._strings;
  const p = host.provenance;
  if (!p) return html``;
  const label = p.label ?? t[p.kind];
  const when = formatTime(p.generatedAt, langOf(host));
  const hasDetails = !!(p.model || p.provider || when || p.notes);
  return html`<details class="base" part="base">
    <summary part="label" class="label" data-kind=${p.kind}>${label}</summary>
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
  </details>`;
};
