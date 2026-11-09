import { html } from '@oddkin/core/template';
import { decisionRow, type DecisionState } from '../internal/decision-row.js';
import { format } from '../internal/strings.js';
import type { OddkinCheckpoint } from './checkpoint.js';

/**
 * Anatomy: labelled `base` with description and `restores` list, then the decision row (Figma page
 * 08): Restore… with its pending line, failure, reason or outcome, or in its place the
 * confirmation, whose Restore this checkpoint loads while the request is in flight.
 */
export const checkpointTemplate = (host: OddkinCheckpoint) => {
  const t = host._strings;
  const c = host.checkpoint;
  if (!c) return html``;
  const asked = host._decisions.asked(c.checkpointId);
  const pending = c.status === 'restore-pending' || asked;
  // Open while the record keeps the status it was opened at; confirmed, while its request is out.
  const open = host._confirming.value;
  const confirming = asked || (open?.id === c.checkpointId && open.status === c.status);
  const created = host._created();
  const state: DecisionState =
    c.status === 'restored'
      ? { outcome: { text: format(t.restored, { outcome: c.outcome ?? '' }), tone: 'success' } }
      : pending
        ? { loading: 'restore', pending: t['restore-pending'] }
        : {
            error:
              c.status === 'restore-failed'
                ? format(t['restore-failed'], { message: c.error?.message ?? '' })
                : undefined,
            unavailable: host._unavailable,
          };
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
    ${
      confirming
        ? html`<div class="confirm" role="group" aria-labelledby="confirm-text">
            <p id="confirm-text">${format(t.confirmText, { label: c.label })}</p>
            ${decisionRow(
              [
                {
                  action: 'confirm',
                  label: t.confirm,
                  appearance: 'primary',
                  onClick: host._restore,
                },
                { action: 'cancel', label: t.cancel, onClick: host._cancel },
              ],
              asked ? { loading: 'confirm', pending: t['restore-pending'] } : {},
            )}
          </div>`
        : decisionRow(
            [{ action: 'restore', label: t.restore, appearance: 'primary', onClick: host._ask }],
            state,
          )
    }
  </div>`;
};
