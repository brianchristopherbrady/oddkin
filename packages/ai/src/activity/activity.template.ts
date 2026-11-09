import { html } from '@oddkin/core/template';
import { statusBadge } from '../internal/status.js';
import type { OddkinActivity } from './activity.js';

/** Anatomy: `base` with a status text (or the wait: a status badge and its counts) and `actions`. */
export const activityTemplate = (host: OddkinActivity) => {
  const a = host.attempt;
  if (!a) return html``;
  const t = host._strings;
  const actions = host._actions();
  const wait = host._wait();
  const busy =
    a.status === 'submitted' ||
    a.status === 'accepted' ||
    a.status === 'streaming' ||
    a.stop === 'requested';
  return html`<div part="base" class="base" data-status=${a.status} data-connection=${a.connection}>
    <span class="indicator" aria-hidden="true" ?hidden=${!busy}></span>
    ${
      wait
        ? html`<span class="text waiting" tabindex="-1"
            >${statusBadge(wait.status, wait.label)}<span class="detail">${wait.detail}</span></span
          >`
        : html`<span class="text" tabindex="-1">${host._text()}</span>`
    }
    <span part="actions" class="actions">
      ${actions.stop ? html`<button class="odd-button" data-size="sm" type="button" data-action="stop" @click=${host._act}>${t.stop}</button>` : null}
      ${actions.resume ? html`<button class="odd-button" data-size="sm" type="button" data-action="resume" @click=${host._act}>${t.resume}</button>` : null}
      ${actions.retry ? html`<button class="odd-button" data-size="sm" type="button" data-action="retry" @click=${host._act}>${t.retry}</button>` : null}
    </span>
  </div>`;
};
