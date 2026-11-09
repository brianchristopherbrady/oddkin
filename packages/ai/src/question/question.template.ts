import { html } from '@oddkin/core/template';
import { decisionRow } from '../internal/decision-row.js';
import { format } from '../internal/strings.js';
import type { OddkinQuestion } from './question.js';

/** Anatomy: a native `form` with a fieldset (legend = prompt), controls by kind, status, and `actions`. */
export const questionTemplate = (host: OddkinQuestion) => {
  const t = host._strings;
  const q = host.question;
  if (!q) return html``;
  const locked = host._locked;
  const unavailable = host._unavailable;
  const open = q.status === 'requested' || q.status === 'failed';
  const pending = q.status === 'submitting' || (locked && open && unavailable === undefined);
  const status = pending
    ? t.submitting
    : open && unavailable
      ? unavailable
      : q.status === 'failed'
        ? format(t.failed, { message: q.error?.message ?? '' })
        : q.status === 'requested'
          ? ''
          : t[q.status];
  const choice = q.kind === 'choice' || q.kind === 'multi-choice';
  const inputType = q.kind === 'choice' ? 'radio' : 'checkbox';
  const expires = host._expires();
  return html`<form part="form" class="form" @submit=${host._submit} novalidate>
    <fieldset ?disabled=${locked}>
      <legend class="prompt">${q.prompt}</legend>
      <p class="muted" ?hidden=${!expires}>${expires ?? ''}</p>
      ${
        choice
          ? html`<div class="options">
              ${(q.options ?? []).map(
                (option) =>
                  html`<label class="option">
                    <input type=${inputType} name="choice" .value=${option.id} />
                    <span
                      >${option.label}<span class="muted" ?hidden=${!option.description}>
                        — ${option.description ?? ''}</span
                      ></span
                    >
                  </label>`,
              )}
              ${
                q.allowCustom
                  ? html`<label class="option">
                        <input type=${inputType} name="choice" value="__other" />
                        <span>${t.other}</span>
                      </label>
                      <label class="field"
                        ><span>${t.otherLabel}</span
                        ><input type="text" name="custom" @input=${host._onCustom}
                      /></label>`
                  : null
              }
            </div>`
          : null
      }
      ${
        q.kind === 'text'
          ? html`<label class="field"
              ><span class="visually-hidden">${t.otherLabel}</span
              ><textarea name="text" rows="3" required></textarea>
            </label>`
          : null
      }
      ${
        q.kind === 'form'
          ? (q.fields ?? []).map((field) =>
              field.type === 'boolean'
                ? html`<label class="option"
                    ><input type="checkbox" name=${field.id} /><span>${field.label}</span></label
                  >`
                : field.type === 'select'
                  ? html`<label class="field"
                      ><span>${field.label}</span>
                      <select name=${field.id} ?required=${!!field.required}>
                        <option value=""></option>
                        ${(field.options ?? []).map((o) => html`<option .value=${o}>${o}</option>`)}
                      </select></label
                    >`
                  : html`<label class="field"
                      ><span>${field.label}</span>
                      <input
                        type=${field.type === 'number' ? 'number' : 'text'}
                        name=${field.id}
                        ?required=${!!field.required}
                    /></label>`,
            )
          : null
      }
      <p class="error" role="alert" ?hidden=${!host._invalid.value}>${host._invalid.value}</p>
    </fieldset>
    <p class="state" data-status=${q.status} ?hidden=${!status}>${status}</p>
    <div
      part="actions"
      class="actions"
      ?hidden=${q.status !== 'requested' && q.status !== 'failed'}
    >
      ${decisionRow(
        'sm',
        [
          {
            action: 'answer',
            label: t.submit,
            appearance: 'primary',
            type: 'submit',
            disabled: locked,
            onClick: host._submit,
          },
          {
            action: 'skip',
            label: t.skip,
            appearance: 'ghost',
            disabled: locked,
            onClick: host._skip,
          },
        ],
        pending ? 'answer' : undefined,
      )}
    </div>
  </form>`;
};
