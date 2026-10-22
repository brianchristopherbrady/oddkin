import { compose, html } from '@oddkin/core';
import { AcmeButton, AcmeField } from './field.js';

export const fieldDefinition = compose({
  name: 'acme-field',
  element: AcmeField,
  template: (host: AcmeField) =>
    html`<label part="label">${host.label} <input part="control" .value=${host.value} /></label>`,
});

export const buttonDefinition = compose({
  name: 'acme-button',
  element: AcmeButton,
  template: (host: AcmeButton) =>
    html`<button part="control" ?disabled=${host.disabled}><slot></slot></button>`,
});
