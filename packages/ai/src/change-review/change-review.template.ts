import { html, repeat } from '@oddkin/core/template';
import type { DiffSegment } from '../controllers/diff.js';
import type { OddkinChangeReview } from './change-review.js';

const segments = (
  host: OddkinChangeReview,
  diff: readonly DiffSegment[],
  show: 'both' | 'before' | 'after',
) => {
  const t = host._strings;
  return diff.map((s) =>
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
  );
};

/** Anatomy: a labelled `list` of `proposal` groups, each with a `diff`, status, and actions. */
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
          return html`<li part="proposal" class="proposal" data-status=${p.status}>
            <p class="label" ?hidden=${!p.label}>${p.label ?? ''}</p>
            ${
              view === 'split'
                ? html`<div part="diff" class="split">
                    <div>
                      <p class="muted">${t.before}</p>
                      <div class=${code ? 'text code' : 'text'}>
                        <span class="segments">${segments(host, diff, 'before')}</span>
                      </div>
                    </div>
                    <div>
                      <p class="muted">${t.after}</p>
                      <div class=${code ? 'text code' : 'text'}>
                        <span class="segments">${segments(host, diff, 'after')}</span>
                      </div>
                    </div>
                  </div>`
                : html`<div part="diff" class=${code ? 'text code' : 'text'}>
                    <span class="segments">${segments(host, diff, 'both')}</span>
                  </div>`
            }
            <p class="state" data-status=${p.status}>${status}</p>
            <div class="actions">
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
                      >${t.reject}</odd-button
                    >`
                  : null
              }
              ${
                p.status === 'applied'
                  ? html`<odd-button
                      size="sm"
                      data-id=${p.proposalId}
                      data-action="undo"
                      @click=${host._act}
                      >${t.undo}</odd-button
                    >`
                  : null
              }
            </div>
          </li>`;
        },
      )}
    </ol>
  </div>`;
};
