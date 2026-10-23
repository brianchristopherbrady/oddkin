import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-checkbox> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './checkbox.js';

export default defineExamples('odd-checkbox', {
  default: {
    label: 'Default',
    previewRoles: ['checkbox'],
    slots: { default: 'Email me about project updates' },
    preset: true,
    recommended: true,
  },
  checked: {
    label: 'Checked',
    attributes: { checked: '' },
    slots: { default: 'Email me about project updates' },
    preset: true,
  },
  description: {
    label: 'With description',
    props: { description: 'At most one email a week.' },
    slots: { default: 'Weekly summary' },
  },
  indeterminate: {
    label: 'Mixed',
    props: { indeterminate: true },
    slots: { default: 'All notifications' },
    guidance:
      'Mixed shows that some of the options it controls are on; toggling it clears the mixed state, as on native checkboxes.',
  },
  required: {
    label: 'Required',
    props: { required: true, error: 'Accept the terms to continue.' },
    slots: { default: 'I accept the terms' },
    preset: true,
  },
  disabled: {
    label: 'Disabled',
    props: { disabled: true },
    attributes: { checked: '' },
    slots: { default: 'Managed by your workspace' },
  },
  checkedFalse: {
    label: 'checked="false"',
    attributes: { checked: 'false' },
    slots: { default: 'Email me about project updates' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: checked="false" starts checked. Leave the attribute out.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  inForm: {
    label: 'In a form',
    props: { required: true },
    // Form-associated elements submit under their `name` attribute.
    attributes: { name: 'terms', value: 'accepted' },
    slots: { default: 'I accept the terms' },
    guidance:
      'Participates in its form like a native checkbox: submits its value while checked, blocks submission while required and unchecked, and resets with the form.',
    fixture({ scope, element, mount }) {
      const form = mount(
        html`<form>
          <odd-button type="submit" appearance="primary">Continue</odd-button>
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
