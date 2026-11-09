import { html, repeat } from '@oddkin/core/template';
import { isBoundary, type EditProposal } from '../controllers/document.js';
import { decisionRow } from '../internal/decision-row.js';
import { diffView } from '../internal/diff-view.js';
import type { OddkinChangeReview } from './change-review.js';

/** A proposal's name without a label: its first 60 characters, never half a surrogate pair. */
const groupName = (p: EditProposal) => {
  const text = p.replacement || p.original;
  return text.slice(0, text.length <= 60 || isBoundary(text, 60) ? 60 : 59);
};

/**
 * Anatomy: a labelled `list` of `proposal` items, each a named group with its `label`, `diff`
 * (the change between its muted context), `status`, and `actions`.
 */
export const changeReviewTemplate = (host: OddkinChangeReview) => {
  const t = host._strings;
  const code = host.granularity === 'lines';
  const view = host.view;
  return html`<div class="base" role="group" aria-label=${t.label}>
    <p class="muted" ?hidden=${!!host.proposals.length}>${t.empty}</p>
    <ol part="list" class="list" tabindex="-1">
      ${repeat(
        host.proposals,
        (p) => p.proposalId,
        (p) => {
          const diff = host._diff(p);
          const status = host._status(p.status, p.error?.message);
          const undo = p.status === 'applied' && p.undoable !== false;
          return html`<li part="proposal" class="proposal" data-status=${p.status}>
            <div class="body" role="group" aria-label=${p.label || groupName(p)}>
              <p part="label" class="label" ?hidden=${!p.label}>${p.label ?? ''}</p>
              ${
                view === 'split'
                  ? html`<div part="diff" class="split">
                      <div class="side">
                        <p class="muted">${t.before}</p>
                        <div class=${code ? 'text code' : 'text'}>
                          ${diffView(diff, t, p.context, 'before')}
                        </div>
                      </div>
                      <div class="side">
                        <p class="muted">${t.after}</p>
                        <div class=${code ? 'text code' : 'text'}>
                          ${diffView(diff, t, p.context, 'after')}
                        </div>
                      </div>
                    </div>`
                  : html`<div part="diff" class=${code ? 'text code' : 'text'}>
                      ${diffView(diff, t, p.context)}
                    </div>`
              }
              <p part="status" class="state" data-status=${p.status} ?hidden=${!status}>
                ${status}
              </p>
              ${
                p.status === 'requested' || p.status === 'stale' || undo
                  ? html`<div part="actions" class="actions">
                      ${decisionRow('sm', [
                        p.status === 'requested' && {
                          action: 'accept',
                          label: t.accept,
                          appearance: 'primary',
                          id: p.proposalId,
                          onClick: host._act,
                        },
                        (p.status === 'requested' || p.status === 'stale') && {
                          action: 'reject',
                          label: p.status === 'stale' ? t.dismiss : t.reject,
                          id: p.proposalId,
                          onClick: host._act,
                        },
                        undo && {
                          action: 'undo',
                          label: t.undo,
                          id: p.proposalId,
                          onClick: host._act,
                        },
                      ])}
                    </div>`
                  : null
              }
            </div>
          </li>`;
        },
      )}
    </ol>
  </div>`;
};
