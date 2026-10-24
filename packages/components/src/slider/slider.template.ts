import { styleMap } from '@oddkin/core/helpers/style-map';
import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import type { OddkinSlider } from './slider.js';

/**
 * Anatomy: a row with the `label` part and the `output` (the current value); the `description`;
 * the slider area (`control`) holding the `track` with its `fill` and the focusable `thumb`
 * (`role="slider"`), placed by the value's fraction (`--_fraction`); the endpoint labels; and the
 * `error`. The output and endpoints repeat values the thumb already announces.
 */
export const sliderTemplate = (slider: OddkinSlider) => {
  const value = slider.valueAsNumber;
  const disabled = slider.disabled || slider._formDisabled.value;
  // `aria-disabled` on the field marks its texts (output, endpoints) as part of a disabled control.
  return html`<div part="field" class="field" aria-disabled=${disabled ? 'true' : null}>
    <div class="heading">
      <div part="label" id="label" class="label" ?hidden=${!slider.label}>${slider.label}</div>
      <div part="output" class="output" aria-hidden="true">${slider._text(value)}</div>
    </div>
    <div part="description" id="description" class="description" ?hidden=${!slider.description}>
      ${slider.description}
    </div>
    <div
      part="control"
      class="slider"
      style=${styleMap({ '--_fraction': String(slider._fraction) })}
    >
      <div part="track" class="track"><div part="fill" class="fill"></div></div>
      <div
        part="thumb"
        class="thumb"
        role="slider"
        tabindex=${disabled ? '-1' : '0'}
        aria-labelledby=${slider.label ? 'label' : null}
        aria-valuemin=${String(slider.min)}
        aria-valuemax=${String(slider._max)}
        aria-valuenow=${String(value)}
        aria-valuetext=${slider.renderValue ? slider._text(value) : null}
        aria-disabled=${disabled ? 'true' : null}
        aria-describedby=${slider._describedBy}
        aria-invalid=${slider._userInvalid.value ? 'true' : null}
        @keydown=${slider._onKeydown}
        @blur=${slider._onBlur}
      ></div>
    </div>
    <div class="endpoints" aria-hidden="true">
      <span part="min-label">${slider._text(slider.min)}</span
      ><span part="max-label">${slider._text(slider._max)}</span>
    </div>
    <div part="error" id="error" class="error" ?hidden=${!slider.error}>${slider.error}</div>
    ${externalDescriptionTemplate(slider._externalDescription)}
  </div>`;
};
