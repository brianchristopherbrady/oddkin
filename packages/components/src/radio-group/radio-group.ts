import { prop } from '@oddkin/core/element';
import { OddkinRadioControl } from '../form-control/radio-control.js';

export type { OptionRecord } from '../form-control/radio-control.js';
export { changeEvent, inputEvent } from '../form-control/radio-control.js';

/**
 * One value from a short set of visible options, each a native radio with its label and
 * description. Options come from `<option>` and `<optgroup>` children, written as for a native
 * select (`selected` marks the default, `title` is the description), or from `options`.
 *
 * @csspart field - The group: legend, description, options, and error.
 * @csspart label - The visible legend.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The options.
 * @csspart option - One option: its radio and label.
 * @csspart option-description - An option's description, referenced by its radio.
 * @csspart group - The heading of a group of options (`<optgroup label>`).
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The group shows its error: `error` is set, or nothing is checked while `required` after focus left the group or a validity check failed.
 * @a11y A `role="radiogroup"` in the shadow root, named by the legend and described by the description and error, holds native radios; each radio is named by its option's label and described by its option's description. `label` names the group; a `<label for>` outside the shadow root cannot.
 * @keyboard Native radio behavior: Tab enters the group at the checked radio (or the first, when none is checked) and leaves it; arrow keys move to the next or previous option and check it; Space checks the focused option.
 * @previewRole radioGroup
 * @useFor One choice from a few options that should all stay visible, especially with descriptions: a visibility setting, a plan.
 * @notFor Several independent choices (use odd-checkbox-group); a long list (use odd-select or odd-combobox); a compact switch between a few short values (use odd-segmented-control).
 * @category Forms
 */
export class OddkinRadioGroup extends OddkinRadioControl.with({
  orientation: prop.enum(['vertical', 'horizontal'], {
    default: 'vertical',
    reflect: true,
    description: 'Stacks the options, or lines them up and wraps them.',
  }),
}) {}

declare global {
  interface HTMLElementTagNameMap {
    'odd-radio-group': OddkinRadioGroup;
  }
}
