import { html } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import type { OddkinResponseFeedback } from './response-feedback.js';

/** Anatomy: rating toggles in `base`, then a `form` with reasons and comment while drafting. */
export const responseFeedbackTemplate = (host: OddkinResponseFeedback) => {
  const t = host._strings;
  const record = host.feedback;
  const status = record?.status ?? 'idle';
  const rating = host._rating.value ?? (status === 'submitted' ? record?.rating : undefined);
  const drafting = !!host._rating.value && status !== 'pending' && status !== 'submitted';
  const outcome =
    status === 'pending'
      ? t.pending
      : status === 'submitted'
        ? t.submitted
        : status === 'failed'
          ? format(t.failed, { message: record?.error?.message ?? '' })
          : '';
  const locked = host.disabled || status === 'pending' || status === 'submitted';
  return html`<div part="base" class="base" role="group" aria-label=${t.label}>
    <div class="actions">
      <button
        class="text-button"
        type="button"
        data-rating="positive"
        aria-pressed=${rating === 'positive' ? 'true' : 'false'}
        ?disabled=${locked}
        @click=${host._rate}
      >
        <span aria-hidden="true">👍</span><span class="visually-hidden">${t.positive}</span>
      </button>
      <button
        class="text-button"
        type="button"
        data-rating="negative"
        aria-pressed=${rating === 'negative' ? 'true' : 'false'}
        ?disabled=${locked}
        @click=${host._rate}
      >
        <span aria-hidden="true">👎</span><span class="visually-hidden">${t.negative}</span>
      </button>
      <span class="outcome muted" data-status=${status} ?hidden=${!outcome}>${outcome}</span>
    </div>
    <form part="form" class="form" ?hidden=${!drafting} @submit=${host._submit}>
      ${
        host._rating.value === 'negative' && host.reasons.length
          ? html`<fieldset>
              <legend>${t.reasons}</legend>
              ${host.reasons.map(
                (reason) =>
                  html`<label class="check">
                    <input
                      type="checkbox"
                      .value=${reason}
                      .checked=${host._selected.value.includes(reason)}
                      @change=${host._toggleReason}
                    />
                    ${reason}
                  </label>`,
              )}
            </fieldset>`
          : null
      }
      <label class="field">
        <span>${t.comment}</span>
        <textarea rows="2" .value=${host._comment.value} @input=${host._onComment}></textarea>
      </label>
      <div class="actions">
        <odd-button type="submit" appearance="primary" size="sm" @click=${host._submit}
          >${status === 'failed' ? t.retry : t.submit}</odd-button
        >
        <odd-button size="sm" appearance="ghost" @click=${host._cancel}>${t.cancel}</odd-button>
      </div>
    </form>
  </div>`;
};
