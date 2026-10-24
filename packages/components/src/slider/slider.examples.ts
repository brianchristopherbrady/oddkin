import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-slider> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './slider.js';

export default defineExamples('odd-slider', {
  default: {
    label: 'Default',
    previewRoles: ['slider'],
    props: { label: 'Preview scale', name: 'scale', min: 25, max: 100, step: 5 },
    attributes: { value: '60' },
    recommended: true,
    preset: true,
    guidance:
      'The `value` attribute is the default, as on a native range; the value snaps to `step` from `min`.',
  },
  percent: {
    label: 'Formatted values',
    props: { label: 'Preview scale', min: 25, max: 100, step: 5 },
    attributes: { value: '60' },
    preset: true,
    guidance:
      '`renderValue` formats the output, the endpoints, and the announced value, such as "60%".',
    fixture({ element }) {
      element.renderValue = (value) => `${value}%`;
    },
  },
  halfway: {
    label: 'Without a value',
    props: { label: 'Volume', step: 10 },
    guidance: 'Without a `value` attribute the slider starts halfway, as a native range does.',
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Preview scale', min: 25, max: 100, disabled: true },
    attributes: { value: '60' },
  },
  withError: {
    label: 'With an error',
    props: { label: 'Preview scale', min: 25, max: 100, error: 'Use 80% or less for print.' },
    attributes: { value: '90' },
    guidance: 'Set `error` to show a message and mark the slider invalid until it is cleared.',
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Preview scale', name: 'scale', min: 25, max: 100, step: 5 },
    attributes: { value: '60' },
    guidance:
      'The value is submitted under `name`, as a string; reset returns to the `value` attribute.',
    fixture({ scope, element, mount }) {
      const form = mount(
        html`<form>
          <odd-button type="submit" appearance="primary">Save</odd-button>
          <odd-button type="reset">Reset</odd-button>
          <output name="submitted"></output>
        </form>`,
      ) as HTMLFormElement;
      form.prepend(element);
      scope.listen(form, 'submit', (event) => {
        event.preventDefault();
        form.querySelector('output')!.value = new URLSearchParams(
          new FormData(form) as unknown as Record<string, string>,
        ).toString();
      });
    },
  },
});
