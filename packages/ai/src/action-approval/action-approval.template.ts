import { html } from '@oddkin/core/template';
import { can } from '../contracts/normalize.js';
import { decisionRow, type DecisionState } from '../internal/decision-row.js';
import { expiryBadge } from '../internal/expiry.js';
import { scopeChoice } from '../internal/scope-choice.js';
import { format } from '../internal/strings.js';
import type { OddkinActionApproval } from './action-approval.js';

/**
 * Anatomy: a labelled `base` group with summary, target, `changes`, `scope`, the reason (a
 * textarea in an `odd-disclosure`), and the decision row (Figma page 08): Approve, Reject and
 * Edit, or the outcome in their place.
 */
export const actionApprovalTemplate = (host: OddkinActionApproval) => {
  const t = host._strings;
  const approval = host.approval;
  if (!approval) return html``;
  const blocked = host._blocked;
  const approveBlocked = host._approveBlocked;
  const scopes = approval.scopes ?? [];
  const scope = host._scopeOf(approval);
  const reason = host._reasonOf(approval);
  const status = approval.status;
  const decided = host._decisions.choice(host._key(approval));
  const actionable = status === 'requested' || status === 'failed';
  const pending = status === 'submitting' || (actionable && decided !== undefined);
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
    <p class="muted" ?hidden=${!approval.risk}>
      ${approval.risk ? format(t.risk, { risk: t[approval.risk] }) : ''}
    </p>
    ${actionable || pending ? expiryBadge(host, approval.expiresAt, t.expires) : null}
    ${
      approval.changes?.length
        ? html`<div part="changes" class="changes" role="group" aria-label=${t.changes}>
            ${approval.changes.map(
              (change) =>
                html`<div class="change">
                  <span class="change-label" ?hidden=${!change.label}>${change.label}</span>
                  ${
                    change.before !== undefined
                      ? html`<del>${t.before}: ${change.before}</del>`
                      : null
                  }
                  ${change.after !== undefined ? html`<ins>${t.after}: ${change.after}</ins>` : null}
                </div>`,
            )}
          </div>`
        : null
    }
    ${scopeChoice(
      {
        scopes,
        chosen: scope,
        defaulted: host._scopeDefaulted(approval),
        reset: host._scopeReset(approval),
        disabled: blocked !== undefined,
        onChange: host._onScope,
      },
      t,
    )}
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
