import { html } from '@oddkin/core/template';
import { can } from '../contracts/normalize.js';
import { format } from '../internal/strings.js';
import type { OddkinActionApproval } from './action-approval.js';

/** Anatomy: a labelled `base` group with summary, target, `changes`, status, and `actions`. */
export const actionApprovalTemplate = (host: OddkinActionApproval) => {
  const t = host._strings;
  const approval = host.approval;
  if (!approval) return html``;
  const blocked = host._blocked;
  const pending =
    approval.status === 'decision-pending' || (blocked === '' && approval.status === 'requested');
  const decided = host._requested.value?.split(':').pop();
  const actionable = approval.status === 'requested' || approval.status === 'decision-failed';
  const statusText =
    approval.status === 'decision-failed'
      ? format(t['decision-failed'], { message: approval.error?.message ?? '' })
      : pending
        ? t['decision-pending']
        : t[approval.status];
  const tone =
    approval.status === 'approved'
      ? 'success'
      : approval.status === 'decision-failed' || approval.status === 'rejected'
        ? 'danger'
        : 'active';
  const expires = host._expires();
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
    <p class="muted" ?hidden=${!approval.risk && !expires}>
      ${approval.risk ? format(t.risk, { risk: t[approval.risk] }) : ''} ${expires ?? ''}
    </p>
    ${
      approval.changes?.length
        ? html`<div part="changes" class="changes" role="group" aria-label=${t.changes}>
            ${approval.changes.map(
              (change) =>
                html`<div class="change">
                  <span class="change-label">${change.label}</span>
                  ${
                    change.before !== undefined
                      ? html`<del
                          ><span class="visually-hidden">${t.before}: </span>${change.before}</del
                        >`
                      : null
                  }
                  ${
                    change.after !== undefined
                      ? html`<ins
                          ><span class="visually-hidden">${t.after}: </span>${change.after}</ins
                        >`
                      : null
                  }
                </div>`,
            )}
          </div>`
        : null
    }
    <p class="state" data-tone=${tone}>${statusText}</p>
    <div part="actions" class="actions" ?hidden=${!actionable}>
      <label class="reason">
        <span class="muted">${t.reason}</span>
        <textarea
          rows="1"
          .value=${host._reason.value}
          @input=${host._onReason}
          ?disabled=${blocked !== undefined}
        ></textarea>
      </label>
      <odd-button
        appearance="primary"
        ?disabled=${blocked !== undefined && !(pending && decided === 'approve')}
        ?loading=${pending && decided === 'approve'}
        @click=${host._approve}
        >${t.approve}</odd-button
      >
      <odd-button
        ?disabled=${blocked !== undefined && !(pending && decided === 'reject')}
        ?loading=${pending && decided === 'reject'}
        @click=${host._reject}
        >${t.reject}</odd-button
      >
      ${
        can(host.capabilities, 'editApproval')
          ? html`<odd-button
              appearance="ghost"
              ?disabled=${blocked !== undefined}
              @click=${host._edit}
              >${t.edit}</odd-button
            >`
          : null
      }
    </div>
    <p class="muted" ?hidden=${!actionable || !blocked}>${blocked ?? ''}</p>
  </div>`;
};
