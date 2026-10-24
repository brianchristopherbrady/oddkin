import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { radioFlag, radioInput } from '../form-control/radio-input.js';
import type { OddkinSegmentedControl } from './segmented-control.js';

/**
 * Anatomy: the shared field as a `role="radiogroup"` named by its `label` part and described by
 * the `description` and `error` parts, around the track (`control`). Each segment (`option`) is a
 * label holding its native radio, drawn as the segment's surface, under its text or icon.
 */
export const segmentedControlTemplate = (control: OddkinSegmentedControl) =>
  html`<div
    part="field"
    class="field"
    role="radiogroup"
    aria-labelledby=${control.label ? 'label' : null}
    aria-describedby=${control._describedBy}
    @focusout=${control._onFocusOut}
  >
    <div part="label" id="label" class="label" ?hidden=${!control.label}>${control.label}</div>
    <div part="description" id="description" class="description" ?hidden=${!control.description}>
      ${control.description}
    </div>
    <div part="control" class="track">
      ${control._options.value.map(
        (option) =>
          html`<label part="option" class="segment">
            ${radioInput(control, option, 'segment-box', { title: option.description })}
            <span class="segment-label"
              >${
                option.icon
                  ? html`<odd-icon src=${option.icon} size="sm"></odd-icon
                      ><span class="visually-hidden">${option.label}</span>`
                  : option.label
              }</span
            >
          </label>`,
      )}
      ${radioFlag(control)}
    </div>
    <div part="error" id="error" class="error" ?hidden=${!control.error}>${control.error}</div>
    ${externalDescriptionTemplate(control._externalDescription)}
  </div>`;
