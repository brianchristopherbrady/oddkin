import { html } from '@oddkin/core/template';
import { externalDescriptionTemplate } from '../form-control/description.js';
import type { OddkinButton } from './button.js';

/**
 * Anatomy: a native `<button part="control">` (focus target, keyboard activation, accessible
 * name from the default slot or `label`), a `part="spinner"` shown while loading, and
 * `start`, default, and `end` slots. Alternative templates must keep these relationships.
 */
export const buttonTemplate = (button: OddkinButton) =>
  html`<button
      part="control"
      type="button"
      ?disabled=${button.disabled || button._formDisabled.value}
      aria-disabled=${button.loading ? 'true' : null}
      aria-label=${button.label || null}
      aria-pressed=${button.toggle ? String(button.pressed) : null}
      aria-describedby=${button._externalDescription ? 'external-description' : null}
    >
      <span part="spinner" class="spinner" aria-hidden="true" ?hidden=${!button.loading}></span>
      <slot name="start"></slot>
      <span class="label"><slot></slot></span>
      <slot name="end"></slot>
    </button>
    ${externalDescriptionTemplate(button._externalDescription)}`;
