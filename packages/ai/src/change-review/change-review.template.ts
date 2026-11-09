import { html, repeat } from '@oddkin/core/template';
import { isBoundary, type EditProposal } from '../controllers/document.js';
import { decisionRow, type DecisionAction, type DecisionState } from '../internal/decision-row.js';
import { diffView } from '../internal/diff-view.js';
import type { OddkinChangeReview } from './change-review.js';

/** A proposal's name without a label: its first 60 characters, never half a surrogate pair. */
const groupName = (p: EditProposal) => {
  const text = p.replacement || p.original;
  return text.slice(0, text.length <= 60 || isBoundary(text, 60) ? 60 : 59);
};

/**
 * A proposal's decision setup (Figma page 08): Accept and Reject while it awaits review, Dismiss
 * once stale, and Undo once applied and undoable; the line above them says where it stands.
 */
const setup = (
  host: OddkinChangeReview,
  p: EditProposal,
  requests: OddkinChangeReview['_asked']['value'],
): {
  line?: { text: string; tone?: string };
  row?: readonly [readonly DecisionAction[], DecisionState];
} => {
  const t = host._strings;
  const request = requests.get(p.proposalId);
  const asked = request?.status === p.status ? request.action : undefined;
  const act = (action: string, label: string, appearance?: 'primary'): DecisionAction => ({
    action,
    label,
    appearance,
    id: p.proposalId,
    onClick: host._act,
  });
  const decide = [act('accept', t.accept, 'primary'), act('reject', t.reject)];
  switch (p.status) {
    case 'requested':
      return {
        row: [
          decide,
          asked ? { loading: asked, pending: asked === 'accept' ? t.applying : t.recording } : {},
        ],
      };
    case 'applying':
      return { row: [decide, { loading: 'accept', pending: t.applying }] };
    case 'stale':
      return {
        line: { text: t.stale },
        row: [
          [act('dismiss', t.dismiss)],
          asked ? { loading: 'dismiss', pending: t.recording } : {},
        ],
      };
    case 'applied':
    case 'undoing': {
      const undoing = p.status === 'undoing' || asked === 'undo';
      return {
        line: { text: t.applied },
        ...(p.status === 'undoing' || p.undoable !== false
          ? {
              row: [
                [act('undo', t.undo)],
                undoing ? { loading: 'undo', pending: t.undoing } : {},
              ] as const,
            }
          : {}),
      };
    }
    case 'rejected':
      return host._last(p.proposalId) === 'dismiss'
        ? { line: { text: t.dismissed } }
        : { line: { text: t.rejected, tone: 'danger' } };
    case 'failed': {
      const last = host._last(p.proposalId);
      return {
        line: {
          text:
            last === 'undo'
              ? t.undoFailed
              : last === 'dismiss' || last === 'reject'
                ? t.notRecorded
                : host._status(p.status, p.error?.message),
          tone: 'danger',
        },
      };
    }
    default:
      return { line: { text: host._status(p.status) } };
  }
};

/**
 * Anatomy: a labelled `list` of `proposal` items, each a named group with its `label`, `diff`
 * (the change between its muted context), `status`, and `actions`.
 */
export const changeReviewTemplate = (host: OddkinChangeReview) => {
  const t = host._strings;
  const code = host.granularity === 'lines';
  const view = host.view;
  // Read here, where the render tracks it: repeat calls its template later.
  const requests = host._asked.value;
  return html`<div class="base" role="group" aria-label=${t.label}>
    <p class="muted" ?hidden=${!!host.proposals.length}>${t.empty}</p>
    <ol part="list" class="list" tabindex="-1">
      ${repeat(
        host.proposals,
        (p) => p.proposalId,
        (p) => {
          const diff = host._diff(p);
          const { line, row } = setup(host, p, requests);
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
              <p
                part="status"
                class="state outcome"
                data-status=${p.status}
                data-tone=${line?.tone ?? ''}
                tabindex="-1"
                ?hidden=${!line}
              >
                ${line?.text ?? ''}
              </p>
              ${row ? decisionRow(...row) : null}
            </div>
          </li>`;
        },
      )}
    </ol>
  </div>`;
};
