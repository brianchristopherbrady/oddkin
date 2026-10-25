import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import { radioFlag, radioInput } from '../form-control/radio-input.js';
import { starGlyph } from '../styles/glyphs.js';
import type { OddkinRating } from './rating.js';

/**
 * Anatomy: the shared field as a `role="radiogroup"` named by its `label` part and described by
 * the `description` and `error` parts, around a row (`control`) of stars and the chosen value
 * (`value`). Each star (`option`) is a label holding its native radio, drawn as the star's
 * target, under the star glyph and the option's label for assistive technology; stars up to the
 * chosen one are `data-state="on"`.
 */
export const ratingTemplate = (rating: OddkinRating) => {
  const position = rating._position.value;
  return html`<div
    part="field"
    class="field"
    role="radiogroup"
    aria-disabled=${rating.disabled || rating._formDisabled.value ? 'true' : null}
    aria-readonly=${rating.readonly ? 'true' : null}
    aria-labelledby=${rating.label ? 'label' : null}
    aria-describedby=${rating._describedBy}
    @focusout=${rating._onFocusOut}
    @click=${rating._onClick}
  >
    <div part="label" id="label" class="label" ?hidden=${!rating.label}>${rating.label}</div>
    <div part="description" id="description" class="description" ?hidden=${!rating.description}>
      ${rating.description}
    </div>
    <div part="control" class="row">
      <span class="stars">
        ${rating._options.value.map(
          (option, index) =>
            html`<label part="option" class="star" data-state=${index < position ? 'on' : 'off'}>
              ${radioInput(rating, option, 'star-box', { title: option.description })}
              ${starGlyph}<span class="visually-hidden">${option.label}</span>
            </label>`,
        )}
        ${radioFlag(rating)}
      </span>
      <span part="value" class="value">${rating._summary.value}</span>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!rating.error}>${rating.error}</div>
    ${externalDescriptionTemplate(rating._externalDescription)}
  </div>`;
};
