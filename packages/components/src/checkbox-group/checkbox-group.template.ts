import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import type { OddkinCheckboxGroup } from './checkbox-group.js';

/**
 * Anatomy: the shared field as a `role="group"` named by its legend (`label` part) and
 * described by the `description` and `error` parts, around the slotted choices (`control`).
 */
export const checkboxGroupTemplate = (group: OddkinCheckboxGroup) =>
  html`<div
    part="field"
    class="field"
    role="group"
    aria-labelledby=${group.label ? 'label' : null}
    aria-describedby=${group._describedBy}
    aria-invalid=${group._userInvalid.value ? 'true' : null}
    @focusout=${group._onFocusOut}
  >
    <div part="label" id="label" class="label" ?hidden=${!group.label}>${group.label}</div>
    <div part="description" id="description" class="description" ?hidden=${!group.description}>
      ${group.description}
    </div>
    <div part="control" class="options"><slot @slotchange=${group._onSlotChange}></slot></div>
    <div part="error" id="error" class="error" ?hidden=${!group.error}>${group.error}</div>
    <input class="flag" type="radio" name="flag" hidden />
    ${externalDescriptionTemplate(group._externalDescription)}
  </div>`;
