import { live } from '@oddkin/core/helpers/live';
import { html, nothing } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { checkGlyph } from '../styles/glyphs.js';
import { spinnerTemplate } from '../styles/spinner.styles.js';
import type { OddkinOneTimeCode } from './one-time-code.js';

/**
 * Anatomy: a `label` part labelling the native `<input part="control">`, which covers the drawn
 * cells (`cell` parts, hidden from assistive technology) and is itself transparent. The cell
 * after the last digit is `data-active` (the caret while focused); a full code makes the last
 * cell active. The `status` line under the cells (`role="status"`) shows the hint, or the
 * `pending` or `complete` text with its glyph; `error` replaces it.
 */
export const oneTimeCodeTemplate = (code: OddkinOneTimeCode) => {
  const value = code.value;
  const cells = code._cells;
  const active = Math.min(value.length, cells - 1);
  const status = code.error ? null : 'status';
  const describedBy = [code._describedBy, status].filter(Boolean).join(' ') || null;
  return html`<div part="field" class="field">
    <label part="label" class="label" for="control" ?hidden=${!code.label}>${code.label}</label>
    <div part="description" id="description" class="description" ?hidden=${!code.description}>
      ${code.description}
    </div>
    <div class="box">
      <input
        part="control"
        id="control"
        class="control code"
        .value=${live(code._currentValue)}
        type="text"
        name=${code.name || null}
        autocomplete=${code.autocomplete || 'one-time-code'}
        inputmode=${code._hints.get('inputmode', 'numeric')}
        enterkeyhint=${code._hints.get('enterkeyhint')}
        autocapitalize=${code._hints.get('autocapitalize')}
        autocorrect=${code._hints.get('autocorrect')}
        spellcheck=${code._hints.get('spellcheck', 'false')}
        maxlength=${cells}
        minlength=${code.minLength ?? cells}
        ?required=${code.required}
        ?disabled=${code.disabled || code._formDisabled.value}
        ?readonly=${code.readonly || code.status === 'pending'}
        aria-describedby=${describedBy}
        aria-invalid=${code._userInvalid.value ? 'true' : null}
        @input=${code._onCodeInput}
        @compositionend=${code._onCodeInput}
        @change=${code._onChange}
        @blur=${code._onBlur}
        @keydown=${code._onCodeKeydown}
        @click=${code._toEnd}
      />
      <span class="cells" aria-hidden="true">
        ${Array.from(
          { length: cells },
          (_, index) =>
            html`<span
              part="cell"
              class="cell"
              data-state=${value[index] ? 'filled' : 'empty'}
              ?data-active=${index === active}
              >${value[index] ?? ''}${
                index === value.length ? html`<span class="caret"></span>` : nothing
              }</span
            >`,
        )}
      </span>
    </div>
    <div part="status" id="status" class="status" role="status" ?hidden=${!status}>
      ${code.status === 'pending' ? spinnerTemplate : nothing}${
        code.status === 'complete' ? checkGlyph : nothing
      }<span>${code._statusText}</span>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!code.error}>${code.error}</div>
    ${externalDescriptionTemplate(code._externalDescription)}
  </div>`;
};
