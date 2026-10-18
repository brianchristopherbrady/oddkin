import { html } from '@oddkin/core/template';
import { format } from '../internal/strings.js';
import type { OddkinModelSelect } from './model-select.js';

/** Anatomy: a `label`, the native `select`, and `details` for the selected model. */
export const modelSelectTemplate = (host: OddkinModelSelect) => {
  const t = host._strings;
  const selected = host.selected;
  return html`<label part="label" class="label" for="select">${host.label || t.label}</label>
    <select
      part="select"
      id="select"
      class="select"
      aria-describedby="details"
      ?disabled=${host.disabled || !host.models.length}
      @change=${host._onChange}
    >
      ${host.models.length ? null : html`<option value="">${t.none}</option>`}
      ${host.models.map(
        (model) =>
          html`<option
            .value=${model.id}
            ?disabled=${!model.available}
            ?selected=${model.id === host.value}
          >
            ${model.available ? model.label : format(t.unavailable, { label: model.label })}
          </option>`,
      )}
    </select>
    <div part="details" id="details" class="details muted" ?hidden=${!selected}>
      <span ?hidden=${!selected?.description}>${selected?.description ?? ''}</span>
      <span ?hidden=${!selected?.capabilities?.length}
        >${t.capabilities}: ${selected?.capabilities?.join(', ') ?? ''}</span
      >
      <span ?hidden=${!selected || selected.available}>${selected?.reason ?? ''}</span>
    </div>`;
};
