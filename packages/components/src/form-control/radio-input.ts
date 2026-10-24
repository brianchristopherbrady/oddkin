import { live } from '@oddkin/core/helpers/live';
import { html } from '@oddkin/core/template';
import type { OptionRecord } from '../collection/collection.js';
import type { OddkinRadioControl } from './radio-control.js';

/**
 * One option's native radio. Every radio has the same name, so the platform groups them: one Tab
 * stop, arrow keys move the check. Checkedness follows `value` (live: the user may have checked
 * another radio since the last render). `describedBy` names the option's description; `title`
 * carries it where it is not shown.
 */
export const radioInput = (
  control: OddkinRadioControl,
  option: OptionRecord,
  className: string,
  {
    describedBy,
    title,
  }: { describedBy?: string | null | undefined; title?: string | null | undefined } = {},
) =>
  html`<input
    class=${className}
    type="radio"
    name="choice"
    .value=${option.value}
    .checked=${live(option.value === control.value)}
    ?required=${control.required}
    ?disabled=${option.disabled || control.disabled || control._formDisabled.value}
    title=${title ?? null}
    aria-describedby=${describedBy ?? null}
    aria-invalid=${control._userInvalid.value ? 'true' : null}
    @input=${control._onInput}
    @change=${control._onChange}
  />`;

/**
 * A hidden, never-checked radio in the same group, rendered after the options: the validity
 * control while no option is enabled (none given, or all disabled), so a required set still
 * reports the browser's flag and message for an unchosen set. Hidden radios take no Tab stop and
 * no arrow-key step.
 */
export const radioFlag = (control: OddkinRadioControl) =>
  html`<input class="flag" type="radio" name="choice" hidden ?required=${control.required} />`;
