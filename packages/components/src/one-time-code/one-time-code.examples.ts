import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-one-time-code> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './one-time-code.js';

const description = 'Enter the six-digit code sent to a•••@example.com.';

export default defineExamples('odd-one-time-code', {
  default: {
    label: 'Six digits',
    props: { label: 'Verification code', description, name: 'code' },
    recommended: true,
    preset: true,
    guidance:
      'One field for the whole code: the platform offers the code from a message (`autocomplete="one-time-code"`), and paste enters it at once.',
  },
  entering: {
    label: 'Entering',
    previewRoles: ['oneTimeCode'],
    props: { label: 'Verification code', description, value: '4928' },
    guidance: 'Each digit fills the next cell; the caret waits in the cell after the last digit.',
  },
  pending: {
    label: 'Verifying',
    props: { label: 'Verification code', description, value: '492816', status: 'pending' },
    guidance:
      'Set `status="pending"` while the page checks the code: the code is read-only and the status line says so.',
  },
  complete: {
    label: 'Accepted',
    props: { label: 'Verification code', description, value: '492816', status: 'complete' },
    preset: true,
    guidance: '`status="complete"` confirms the code with words and a check.',
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Verification code',
      value: '492816',
      error: 'That code has expired. Request a new code.',
    },
    preset: true,
    guidance:
      'A failed check is `error`: say why and how to recover, and put the way to recover (a resend button) next to the field.',
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Verification code', description, disabled: true },
  },
  fourDigits: {
    label: 'Four digits',
    props: { label: 'PIN from the letter', maxLength: 4 },
    guidance:
      '`maxlength` sets how many cells; `minlength` defaults to the same, so a short code is invalid.',
  },
  requiredFalse: {
    label: 'Optional with required="false"',
    props: { label: 'Verification code' },
    attributes: { required: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this code is still required and blocks an empty submission. Leave the attribute out for an optional code.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Verification code', description, name: 'code', required: true },
    guidance:
      'The code is submitted under `name`; `required` blocks an empty submission and `minlength` (the cell count) a short one.',
    fixture({ scope, element, mount }) {
      const form = mount(
        html`<form>
          <odd-button type="submit" appearance="primary">Verify</odd-button>
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
