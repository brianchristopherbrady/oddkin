import { html } from '@oddkin/core/template';
import { decisionRow } from '../internal/decision-row.js';
import { toneOf } from '../internal/status.js';
import { format } from '../internal/strings.js';
import type { OddkinCheckpoint } from './checkpoint.js';

/** Anatomy: labelled `base` with description, `restores` list, status, and `actions`. */
export const checkpointTemplate = (host: OddkinCheckpoint) => {
  const t = host._strings;
  const c = host.checkpoint;
  if (!c) return html``;
  const requested = host._decisions.asked(c.checkpointId);
  const pending = c.status === 'restore-pending' || (requested && c.status === 'available');
  const confirming = host._confirming.value && !pending;
  const status = pending
    ? t['restore-pending']
    : c.status === 'restored'
      ? format(t.restored, { outcome: c.outcome ?? '' })
      : c.status === 'restore-failed'
        ? format(t['restore-failed'], { message: c.error?.message ?? '' })
        : c.status === 'unavailable'
          ? t.unavailable
          : '';
  const tone = toneOf(pending ? 'restore-pending' : c.status);
  const unavailable = host._unavailable;
  const created = host._created();
  return html`<div
    part="base"
    class="base"
    role="group"
    aria-labelledby="label"
    data-status=${c.status}
  >
    <p id="label" class="label">${c.label}</p>
    <p class="muted" ?hidden=${!created}>${created ?? ''}</p>
    <p class="description">${c.description}</p>
    <p class="muted" ?hidden=${!c.restores.length}>${t.restores}</p>
    <ul part="restores" class="restores" ?hidden=${!c.restores.length}>
      ${c.restores.map((item) => html`<li>${item}</li>`)}
    </ul>
    <p class="state" data-tone=${tone} ?hidden=${!status}>${status}</p>
    <div part="actions" class="actions" ?hidden=${confirming || pending}>
      ${decisionRow('sm', [
        {
          action: 'restore',
          label: t.restore,
          disabled: unavailable !== undefined || c.status === 'unavailable',
          onClick: host._ask,
        },
      ])}
      <span class="muted" ?hidden=${!unavailable || c.status === 'unavailable'}
        >${unavailable ?? ''}</span
      >
    </div>
    <div class="confirm" role="group" aria-labelledby="confirm-text" ?hidden=${!confirming}>
      <p id="confirm-text">${format(t.confirmText, { label: c.label })}</p>
      <div class="actions">
        ${decisionRow('sm', [
          { action: 'confirm', label: t.confirm, appearance: 'primary', onClick: host._restore },
          { action: 'cancel', label: t.cancel, appearance: 'ghost', onClick: host._cancel },
        ])}
      </div>
    </div>
  </div>`;
};
