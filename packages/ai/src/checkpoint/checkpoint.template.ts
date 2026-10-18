import { html } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import type { OddkinCheckpoint } from './checkpoint.js';

/** Anatomy: labelled `base` with description, `restores` list, status, and `actions`. */
export const checkpointTemplate = (host: OddkinCheckpoint) => {
  const t = host._strings;
  const c = host.checkpoint;
  if (!c) return html``;
  const requested = host._requested.value === c.checkpointId;
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
          : t.available;
  const tone =
    c.status === 'restored'
      ? 'success'
      : c.status === 'restore-failed'
        ? 'danger'
        : pending
          ? 'active'
          : '';
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
    <div ?hidden=${!c.restores.length}>
      <p class="muted">${t.restores}</p>
      <ul part="restores" class="restores">
        ${c.restores.map((item) => html`<li>${item}</li>`)}
      </ul>
    </div>
    <p class="state" data-tone=${tone}>${status}</p>
    <div part="actions" class="actions" ?hidden=${confirming || pending}>
      <odd-button
        size="sm"
        ?disabled=${unavailable !== undefined || c.status === 'unavailable'}
        @click=${host._ask}
        >${t.restore}</odd-button
      >
      <span class="muted" ?hidden=${!unavailable || c.status === 'unavailable'}
        >${unavailable ?? ''}</span
      >
    </div>
    <div class="confirm" role="group" aria-labelledby="confirm-text" ?hidden=${!confirming}>
      <p id="confirm-text">${format(t.confirmText, { label: c.label })}</p>
      <div class="actions">
        <odd-button data-confirm size="sm" appearance="primary" @click=${host._restore}
          >${t.confirm}</odd-button
        >
        <odd-button size="sm" appearance="ghost" @click=${host._cancel}>${t.cancel}</odd-button>
      </div>
    </div>
  </div>`;
};
