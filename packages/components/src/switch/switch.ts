import { prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import { OddkinCheckable, changeEvent, inputEvent } from '../form-control/checkable.js';

export { changeEvent, inputEvent };

export const SWITCH_STRINGS = { on: 'On', off: 'Off' };

/**
 * An on/off setting that participates in forms like a checkbox: a native checkbox with
 * `role="switch"` in the shadow root, drawn as a track and thumb, labelled by the slotted text.
 *
 * @slot - The label; names the switch.
 * @csspart field - Wrapper of the switch row, description, and error.
 * @csspart label - The label text beside the track.
 * @csspart control - The native checkbox with `role="switch"` (the drawn track).
 * @csspart thumb - The thumb inside the track.
 * @csspart state - The visible on/off text (`strings.on`, `strings.off`), hidden from assistive technology.
 * @csspart description - Help text, referenced by `aria-describedby`.
 * @csspart error - The error message, referenced by `aria-describedby`.
 * @cssstate user-invalid - The switch shows its error: `error` is set, or a required switch is off after the user left it or a validity check failed. Style it with `odd-switch:state(user-invalid)`.
 * @a11y The slotted text names the switch through its `<label>`; the role announces on and off, so the visible state text is hidden from assistive technology. Description and error are announced through `aria-describedby`.
 * @keyboard Space toggles; Tab order as a native checkbox.
 * @previewRole switch
 * @useFor A setting that takes effect at once, such as turning notifications on or off.
 * @notFor A choice confirmed with a submit button (use odd-checkbox); one choice among several (use odd-radio-group).
 * @limitation Validation bubbles anchor to the inner checkbox.
 * @category Forms
 */
export class OddkinSwitch extends OddkinCheckable.with({
  strings: prop.object<Partial<typeof SWITCH_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  declare readonly _events?: ElementEvents<typeof OddkinSwitch>;

  /** @internal The visible state text. */
  get _stateText(): string {
    const text = strings(SWITCH_STRINGS, this.strings);
    return this.checked ? text.on : text.off;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-switch': OddkinSwitch;
  }
}
