import { prop } from '@oddkin/core/element';
import { OddkinRadioControl } from '../form-control/radio-control.js';

export type { OptionRecord } from '../form-control/radio-control.js';
export { changeEvent, inputEvent } from '../form-control/radio-control.js';

/**
 * One value from a few short options, drawn as joined segments: the radio-group behavior with a
 * segmented look. Options come from `<option>` children or from `options`; an option with an
 * `icon` (`options` only) shows the icon alone, and its `label` names it.
 *
 * @csspart field - Wrapper of label, description, segments, and error.
 * @csspart label - The visible label.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart control - The track holding the segments.
 * @csspart option - One segment.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The control shows its error: `error` is set, or nothing is checked while `required` after focus left the control or a validity check failed.
 * @a11y A `role="radiogroup"` in the shadow root, named by `label` and described by the description and error, holds native radios, each named by its option's label (also for icon-only options) and described by its option's description (`title`).
 * @keyboard Native radio behavior: Tab enters the control at the checked segment (or the first, when none is checked) and leaves it; arrow keys move to the next or previous segment and check it; Space checks the focused segment.
 * @previewRole segmented
 * @useFor A compact choice among two to five short values that takes effect at once: a view mode, a preview size.
 * @notFor Switching between content panels (use odd-tabs); options that need descriptions (use odd-radio-group); actions (use odd-button or odd-toolbar).
 * @limitation Option descriptions are each segment's tooltip (`title`); groups (`<optgroup>`) are drawn as one run of segments.
 * @category Forms
 * @customization 1 2 3
 */
export class OddkinSegmentedControl extends OddkinRadioControl.with({
  size: prop.enum(['sm', 'md', 'lg'], {
    default: 'md',
    reflect: true,
    description: 'Segment height and padding.',
  }),
}) {}

declare global {
  interface HTMLElementTagNameMap {
    'odd-segmented-control': OddkinSegmentedControl;
  }
}
