import { html } from '@oddkin/core/template';
import { can } from '../contracts/normalize.js';
import { decisionRow, type DecisionState } from '../internal/decision-row.js';
import { diffPart } from '../internal/diff-view.js';
import { expiryBadge } from '../internal/expiry.js';
import { scopeChoice, scopeReceipt } from '../internal/scope-choice.js';
import { format } from '../internal/strings.js';
import type { OddkinActionApproval } from './action-approval.js';

/** The risk badge's tone (Figma page 09): passive, never the record's status. */
const RISK_TONES = { low: 'neutral', medium: 'warning', high: 'danger' } as const;

/**
 * Anatomy (Figma page 09): a labelled `base` group with summary, target, the risk and expiry
 * badges, `changes` (each a Before block over an After block, from the shared diff view), `scope`,
 * the reason (a textarea in an `odd-disclosure`), and the decision row (Figma page 08): Approve,
 * Reject and Edit, or the outcome in their place. Once decided, the scope and the reason are the
 * host's record's: what it confirms, never the person's draft.
 */
export const actionApprovalTemplate = (host: OddkinActionApproval) => {
  const t = host._strings;
  const approval = host.approval;
  if (!approval) return html``;
  const opened = host._opened.value;
  const blocked = host._blocked;
  const approveBlocked = host._approveBlocked;
  const scopes = approval.scopes ?? [];
  const scope = host._scopeOf(approval);
  const reason = host._reasonOf(approval);
  const status = approval.status;
  const decided = host._decisions.choice(host._key(approval));
  const actionable = status === 'requested' || status === 'failed';
  const pending = status === 'submitting' || (actionable && decided !== undefined);
  // Page 09 shows when the request expires in every status; it reads as soon only while open.
  const expiry = expiryBadge(host, approval.expiresAt, t.expires, actionable || pending);
  // Only the host's record says why a decision was made.
  const recorded = (status === 'approved' || status === 'rejected') && !!approval.reason;
  const state: DecisionState = pending
    ? { loading: decided, pending: t.submitting }
    : actionable
      ? {
          error:
            status === 'failed'
              ? format(t.failed, { message: approval.error?.message ?? '' })
              : undefined,
          unavailable: blocked || undefined,
        }
      : {
          outcome: {
            text: t[status as Exclude<typeof status, 'requested' | 'submitting' | 'failed'>],
            tone: status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : undefined,
          },
        };
  return html`<div
    part="base"
    class="base"
    role="group"
    aria-labelledby="title"
    data-status=${approval.status}
  >
    <p id="title" class="title">${approval.title}</p>
    <p class="summary" ?hidden=${!approval.summary}>${approval.summary ?? ''}</p>
    <p class="target" ?hidden=${!approval.target}>
      <span class="muted">${t.target}:</span> ${approval.target ?? ''}
    </p>
    <div class="meta" ?hidden=${!approval.risk && !expiry}>
      ${
        approval.risk
          ? html`<odd-badge class="risk" tone=${RISK_TONES[approval.risk]}
              >${format(t.risk, { risk: t[approval.risk] })}</odd-badge
            >`
          : null
      }
      ${expiry}
    </div>
    ${
      approval.changes?.length
        ? html`<div part="changes" class="changes" role="group" aria-label=${t.changes}>
            ${approval.changes.map(
              (change, i) =>
                html`<div class="change">
                  <p class="change-label" ?hidden=${!change.label}>${change.label}</p>
                  <div class="diff">
                    ${diffPart(
                      {
                        diff: host._diff(change),
                        granularity: 'lines',
                        view: 'inline',
                        sides: {
                          before: change.before !== undefined,
                          after: change.after !== undefined,
                        },
                        key: `${host._key(approval)}:${i}`,
                        opened,
                        onToggle: host._onDiffToggle,
                      },
                      t,
                    )}
                  </div>
                </div>`,
            )}
          </div>`
        : null
    }
    ${
      actionable || pending
        ? scopeChoice(
            {
              scopes,
              chosen: scope,
              defaulted: host._scopeDefaulted(approval),
              reset: host._scopeReset(approval),
              disabled: blocked !== undefined,
              onChange: host._onScope,
            },
            t,
          )
        : status === 'approved'
          ? scopeReceipt(approval, t)
          : null
    }
    <p class="state" ?hidden=${status !== 'requested' || pending}>${t.requested}</p>
    <odd-disclosure
      class="reason"
      label=${t.reason}
      .open=${reason.open}
      ?disabled=${blocked !== undefined}
      ?hidden=${!actionable && !pending}
      @toggle=${host._onReason}
    >
      <textarea
        class="control"
        rows="4"
        aria-label=${t.reason}
        placeholder=${t.reasonPlaceholder}
        .value=${reason.text}
        ?disabled=${blocked !== undefined}
        @input=${host._onReason}
      ></textarea>
    </odd-disclosure>
    <p class="recorded-reason" ?hidden=${!recorded}>
      ${recorded ? format(t.recordedReason, { reason: approval.reason ?? '' }) : ''}
    </p>
    ${decisionRow(
      [
        {
          action: 'approve',
          label: t.approve,
          appearance: 'primary',
          disabled: approveBlocked !== undefined,
          onClick: host._approve,
        },
        {
          action: 'reject',
          label: t.reject,
          disabled: blocked !== undefined,
          onClick: host._reject,
        },
        can(host.capabilities, 'editApproval') && {
          action: 'edit',
          label: t.edit,
          appearance: 'ghost',
          disabled: blocked !== undefined,
          onClick: host._edit,
        },
      ],
      state,
    )}
    <p
      class="muted"
      ?hidden=${
        !actionable || pending || !approveBlocked || !!blocked || approveBlocked === t.scopeRequired
      }
    >
      ${approveBlocked ?? ''}
    </p>
  </div>`;
};
