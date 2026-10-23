import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-input> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './input.js';

export default defineExamples('odd-input', {
  default: {
    label: 'Default',
    props: { label: 'Full name', autocomplete: 'name' },
    previewRoles: ['textInput'],
    preset: true,
    recommended: true,
  },
  description: {
    label: 'With description',
    props: {
      label: 'Email',
      type: 'email',
      description: 'We only use it to send receipts.',
      autocomplete: 'email',
    },
    preset: true,
  },
  required: {
    label: 'Required',
    props: { label: 'Project name', required: true },
    guidance: 'The error appears after the field is left empty or a submission is attempted.',
  },
  requiredFalse: {
    label: 'Optional with required="false"',
    props: { label: 'Nickname' },
    attributes: { required: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this field is required and blocks an empty submission. Leave the attribute out for an optional field.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  invalid: {
    label: 'Invalid',
    props: { label: 'Email', type: 'email', error: 'Enter an address like ada@example.com.' },
    attributes: { value: 'ada@' },
    preset: true,
    guidance: '`error` sets the message and makes the field invalid until it is cleared.',
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Account id', disabled: true },
    attributes: { value: 'AC-1042' },
  },
  readonly: {
    label: 'Read-only',
    props: { label: 'Account id', readonly: true },
    attributes: { value: 'AC-1042' },
    guidance: 'Read-only values are still focusable and submitted; disabled ones are neither.',
  },
  password: {
    label: 'Password',
    props: { label: 'Password', type: 'password', autocomplete: 'current-password' },
  },
  number: {
    label: 'Number',
    props: {
      label: 'Seats',
      type: 'number',
      min: '1',
      max: '50',
      description: '1–50 seats available.',
    },
    attributes: { value: '12' },
    guidance:
      'Arrow keys and the browser’s spin buttons move by `step`; a value outside `min`–`max` is invalid. The spin buttons are the browser’s own and are not styled.',
  },
  search: {
    label: 'Search',
    props: { label: 'Search projects', type: 'search', placeholder: 'Search…' },
    preset: true,
    guidance:
      'A searchbox with a clear button while it has a value; Escape clears it too. Change `strings.clear` to translate the button’s name.',
  },
  date: {
    label: 'Date',
    props: { label: 'Publish date', type: 'date', min: '2026-01-01' },
    attributes: { value: '2026-10-24' },
    guidance:
      'Values use the ISO form (2026-10-24); the browser shows them in the reader’s locale.',
  },
  time: {
    label: 'Time',
    props: { label: 'Time', type: 'time', step: '900' },
    attributes: { value: '09:30' },
    guidance: '`step` is in seconds: 900 offers quarter hours.',
  },
  constraints: {
    label: 'Length and pattern',
    props: {
      label: 'Project code',
      minLength: 3,
      maxLength: 8,
      pattern: '[A-Z0-9\\-]+',
      description: '3–8 capital letters, digits or hyphens.',
    },
    guidance:
      '`maxLength` stops typing at the limit; `minLength` and `pattern` make a typed value invalid until it fits.',
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Email', type: 'email', required: true, autocomplete: 'email' },
    // Form-associated elements submit under their `name` attribute.
    attributes: { name: 'email' },
    guidance:
      'Participates in its form like a native input: submitted by name, validated on submit, reset with the form.',
    fixture({ scope, element, mount }) {
      const form = mount(
        html`<form>
          <odd-button type="submit" appearance="primary">Subscribe</odd-button>
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
