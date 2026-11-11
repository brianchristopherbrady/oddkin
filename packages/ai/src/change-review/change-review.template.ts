import { html, repeat } from '@oddkin/core/template';
import { isBoundary, type EditProposal } from '../controllers/document.js';
import { decisionRow, type DecisionAction, type DecisionState } from '../internal/decision-row.js';
import { diffPart } from '../internal/diff-view.js';
import { statusBadge } from '../internal/status.js';
import { format } from '../internal/strings.js';
import type { OddkinChangeReview } from './change-review.js';

/** A proposal's name without a label: its first 60 characters, never half a surrogate pair. */
const groupName = (p: EditProposal) => {
  const text = p.replacement || p.original;
  return text.slice(0, text.length <= 60 || isBoundary(text, 60) ? 60 : 59);
};

/**
 * A proposal's decision setup (Figma pages 08 and 11): its buttons (`_actions`), the chosen one
 * loading while its request is in flight, and the line above them, from the record. Applying and
 * undoing keep the buttons locked; a failure keeps the buttons of what failed, with the error.
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
  const ask = requests.get(p.proposalId);
  const asked = host._waiting(ask, p) ? ask!.action : undefined;
  const buttons = (actions: readonly string[]) =>
    actions.map((action): DecisionAction => ({
      action,
      label: t[action as 'accept' | 'reject' | 'dismiss' | 'undo'],
      appearance: action === 'accept' ? 'primary' : undefined,
      id: p.proposalId,
      onClick: host._act,
    }));
  const loading = (action: string | undefined): DecisionState =>
    action
      ? {
          loading: action,
          pending: action === 'accept' ? t.applying : action === 'undo' ? t.undoing : t.recording,
        }
      : {};
  const message = { message: p.error?.message ?? '' };
  switch (p.status) {
    case 'requested':
      return { row: [buttons(host._actions(p)), loading(asked)] };
    case 'applying':
      return {
        line: { text: t.applying },
        row: [buttons(['accept', 'reject']), loading('accept')],
      };
    case 'stale':
      return { line: { text: t.stale }, row: [buttons(['dismiss']), loading(asked)] };
    case 'applied':
    case 'undoing': {
      const undoing = p.status === 'undoing';
      return {
        line: { text: undoing ? t.undoing : t.applied },
        ...(undoing || p.undoable !== false
          ? { row: [buttons(['undo']), loading(undoing ? 'undo' : asked)] as const }
          : {}),
      };
    }
    case 'rejected':
      return host._last(p.proposalId) === 'dismiss'
        ? { line: { text: t.dismissed } }
        : { line: { text: t.rejected, tone: 'danger' } };
    case 'failed': {
      const failure = host._failure(p);
      const error =
        failure === 'undo'
          ? format(t.undoFailed, message)
          : failure === 'record'
            ? t.notRecorded
            : format(t.failed, message);
      const actions = host._actions(p);
      return actions.length
        ? { row: [buttons(actions), asked ? loading(asked) : { error }] }
        : { line: { text: error, tone: 'danger' } };
    }
    default:
      return { line: { text: t[p.status] } };
  }
};

/**
 * Anatomy (Figma page 11): the title, "Review requested" while a proposal awaits review, and a
 * labelled `list` of `proposal` items, each a named group with its `label`, the revision it was
 * made for, its `diff` (page 08's diff view: the context and a long line diff behind
 * disclosures), `status`, and `actions`.
 */
export const changeReviewTemplate = (host: OddkinChangeReview) => {
  const t = host._strings;
  const { granularity, view, proposals } = host;
  // Read here, where the render tracks them: repeat calls its template later.
  const requests = host._asked.value;
  const opened = host._opened.value;
  return html`<div class="base" role="group" aria-labelledby="title">
    <p id="title" class="title">${t.label}</p>
    ${
      proposals.some((p) => p.status === 'requested')
        ? statusBadge('requested', t.reviewRequested)
        : null
    }
    <p class="muted" ?hidden=${!!proposals.length}>${t.empty}</p>
    <ol part="list" class="list" tabindex="-1">
      ${repeat(
        proposals,
        (p) => p.proposalId,
        (p) => {
          const { line, row } = setup(host, p, requests);
          return html`<li part="proposal" class="proposal" data-status=${p.status}>
            <div class="body" role="group" aria-label=${p.label || groupName(p)}>
              <p part="label" class="label" ?hidden=${!p.label}>${p.label ?? ''}</p>
              <p class="revision">
                ${format(t.revision, { revision: p.baseRevision, proposal: p.proposalId })}
              </p>
              <div part="diff" class="diff">
                ${diffPart(
                  {
                    diff: host._diff(p),
                    granularity,
                    view,
                    context: p.context,
                    key: p.proposalId,
                    opened,
                    onToggle: host._onDiffToggle,
                  },
                  t,
                )}
              </div>
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
