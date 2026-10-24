import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-textarea> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './textarea.js';

export default defineExamples('odd-textarea', {
  default: {
    label: 'Default',
    props: { label: 'Project description', placeholder: 'Describe this project…' },
    previewRoles: ['textArea'],
    preset: true,
    recommended: true,
  },
  count: {
    label: 'With a length limit',
    props: {
      label: 'Project description',
      placeholder: 'Describe this project…',
      maxLength: 500,
    },
    attributes: { value: 'A shared home for our component foundations.' },
    preset: true,
    guidance:
      'The count under the field shows while `maxlength` is set, and typing stops at the limit. Translate it with `strings.count`, which takes `{count}` and `{max}`.',
  },
  description: {
    label: 'With description',
    props: {
      label: 'Release notes',
      description: 'Plain text; line breaks are kept.',
    },
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Project description',
      placeholder: 'Describe this project…',
      maxLength: 500,
      required: true,
      error: 'Description is required.',
    },
    preset: true,
    guidance: '`error` makes the field invalid until it is cleared, and takes the count’s place.',
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Project description', maxLength: 500, disabled: true },
    attributes: { value: 'A shared home for our component foundations.' },
  },
  readonly: {
    label: 'Read-only',
    props: { label: 'Project description', readonly: true },
    attributes: { value: 'A shared home for our component foundations.' },
    guidance:
      'Read-only text is still focusable, selectable, and submitted; disabled text is neither.',
  },
  autoGrow: {
    label: 'Grows with its content',
    props: { label: 'Message', resize: 'auto', rows: 2 },
    guidance:
      'At least `rows` lines; it grows as the text does, up to `--odd-textarea-max-height`, then scrolls.',
  },
  fixedHeight: {
    label: 'Fixed height',
    props: { label: 'Comment', resize: 'none', rows: 3 },
    guidance: 'No resize handle; longer text scrolls inside the field.',
  },
  requiredFalse: {
    label: 'Optional with required="false"',
    props: { label: 'Notes' },
    attributes: { required: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this field is required and blocks an empty submission. Leave the attribute out for an optional field.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Feedback', required: true, maxLength: 200 },
    // Form-associated elements submit under their `name` attribute.
    attributes: { name: 'feedback' },
    guidance:
      'Participates in its form like a native textarea: submitted by name, validated on submit, reset with the form.',
    fixture({ scope, element, mount }) {
      const form = mount(
        html`<form>
          <odd-button type="submit" appearance="primary">Send</odd-button>
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
