import { html, repeat } from '@oddkin/core/template';
import type { DiffSegment } from '../controllers/diff.js';
import { isBoundary, type EditProposal } from '../controllers/document.js';
import type { OddkinChangeReview } from './change-review.js';

/** A proposal's name without a label: its first 60 characters, never half a surrogate pair. */
const groupName = (p: EditProposal) => {
  const text = p.replacement || p.original;
  return text.slice(0, text.length <= 60 || isBoundary(text, 60) ? 60 : 59);
};

/** The change between its muted context; `show` leaves out the deletions or the insertions. */
const segments = (
  host: OddkinChangeReview,
  p: EditProposal,
  diff: readonly DiffSegment[],
  show: 'both' | 'before' | 'after',
) => {
  const t = host._strings;
  return html`<span class="segments"
    ><span class="context">${p.context?.before ?? ''}</span>${diff.map((s) =>
      s.kind === 'equal'
        ? s.text
        : s.kind === 'delete'
          ? show === 'after'
            ? null
            : html`<del
                ><span class="visually-hidden">[${t.deleted}: </span>${s.text}<span
                  class="visually-hidden"
                  >]</span
                ></del
              >`
          : show === 'before'
            ? null
            : html`<ins
                ><span class="visually-hidden">[${t.inserted}: </span>${s.text}<span
                  class="visually-hidden"
                  >]</span
                ></ins
              >`,
    )}<span class="context">${p.context?.after ?? ''}</span></span
  >`;
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
                          ${segments(host, p, diff, 'before')}
                        </div>
                      </div>
                      <div class="side">
                        <p class="muted">${t.after}</p>
                        <div class=${code ? 'text code' : 'text'}>
                          ${segments(host, p, diff, 'after')}
                        </div>
                      </div>
                    </div>`
                  : html`<div part="diff" class=${code ? 'text code' : 'text'}>
                      ${segments(host, p, diff, 'both')}
                    </div>`
              }
              <p part="status" class="state" data-status=${p.status} ?hidden=${!status}>
                ${status}
              </p>
              ${
                p.status === 'proposed' || p.status === 'stale' || undo
                  ? html`<div part="actions" class="actions">
                      ${
                        p.status === 'proposed'
                          ? html`<odd-button
                              size="sm"
                              appearance="primary"
                              data-id=${p.proposalId}
                              data-action="accept"
                              @click=${host._act}
                              >${t.accept}</odd-button
                            >`
                          : null
                      }
                      ${
                        p.status === 'proposed' || p.status === 'stale'
                          ? html`<odd-button
                              size="sm"
                              data-id=${p.proposalId}
                              data-action="reject"
                              @click=${host._act}
                              >${p.status === 'stale' ? t.dismiss : t.reject}</odd-button
                            >`
                          : null
                      }
                      ${
                        undo
                          ? html`<odd-button
                              size="sm"
                              data-id=${p.proposalId}
                              data-action="undo"
                              @click=${host._act}
                              >${t.undo}</odd-button
                            >`
                          : null
                      }
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
