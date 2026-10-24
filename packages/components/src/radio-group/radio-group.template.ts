import { html } from '@oddkin/core/template';
import { groupsOf, type OptionRow } from '../collection/collection.js';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { radioFlag, radioInput } from '../form-control/radio-input.js';
import type { OddkinRadioGroup } from './radio-group.js';

/**
 * Anatomy: the shared field as a `role="radiogroup"` named by its legend (`label` part) and
 * described by the `description` and `error` parts, around the options (`control`). Each option
 * is a `.choice` row (control-indicator module) holding the native radio, drawn as a round box
 * with a dot, and its label, with its description below; a group's options sit in a
 * `role="group"` named by its heading.
 */
export const radioGroupTemplate = (group: OddkinRadioGroup) => {
  const row = ({ option, index }: OptionRow) => {
    const id = `option-${index}-description`;
    return html`<div part="option" class="option">
      <label class="choice">
        <span class="indicator">
          ${radioInput(group, option, 'indicator-box', {
            describedBy: option.description ? id : null,
          })}
          <span class="indicator-mark indicator-dot"></span>
        </span>
        <span class="label">${option.label}</span>
      </label>
      <div
        part="option-description"
        id=${id}
        class="description option-description"
        ?hidden=${!option.description}
      >
        ${option.description}
      </div>
    </div>`;
  };
  return html`<div
    part="field"
    class="field"
    role="radiogroup"
    aria-labelledby=${group.label ? 'label' : null}
    aria-describedby=${group._describedBy}
    @focusout=${group._onFocusOut}
  >
    <div part="label" id="label" class="label" ?hidden=${!group.label}>${group.label}</div>
    <div part="description" id="description" class="description" ?hidden=${!group.description}>
      ${group.description}
    </div>
    <div part="control" class="options">
      ${groupsOf(group._options.value).map((options, n) =>
        options.label === undefined
          ? options.rows.map(row)
          : html`<div role="group" class="group" aria-labelledby=${`group-${n}`}>
              <div part="group" id=${`group-${n}`} class="group-label">${options.label}</div>
              ${options.rows.map(row)}
            </div>`,
      )}
      ${radioFlag(group)}
    </div>
    <div part="error" id="error" class="error" ?hidden=${!group.error}>${group.error}</div>
    ${externalDescriptionTemplate(group._externalDescription)}
  </div>`;
};
