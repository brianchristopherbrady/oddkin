import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-file-input> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './file-input.js';

const description = 'PDF, PNG, or JPG, up to 10 MB each.';

export default defineExamples('odd-file-input', {
  default: {
    label: 'Default',
    props: { label: 'Project attachments', description, name: 'attachments' },
    previewRoles: ['fileInput'],
    recommended: true,
    preset: true,
    guidance:
      'The browser draws the picker button; files can also be dropped on the surface. Each chosen file appears as a row with its size and a remove button.',
  },
  multiple: {
    label: 'Several files',
    props: {
      label: 'Project attachments',
      description,
      name: 'attachments',
      multiple: true,
      accept: '.pdf,image/png,image/jpeg',
    },
    preset: true,
    guidance: '`accept` narrows what the picker offers; check the files on the server as well.',
  },
  chosen: {
    label: 'Files chosen',
    props: { label: 'Project attachments', description, name: 'attachments', multiple: true },
    guidance:
      'Each file is a row with its size; its remove button is named after the file. Scripts cannot choose files: this example drops two, as a user would.',
    async fixture({ element }) {
      await element.updateComplete;
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(245_000)], 'project-brief.pdf'));
      data.items.add(new File([new Uint8Array(1_200_000)], 'site-photo.jpg'));
      element.shadowRoot!.querySelector('[part~="surface"]')!.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          composed: true,
          dataTransfer: data,
        }),
      );
    },
  },
  required: {
    label: 'Required',
    props: { label: 'Signed contract', name: 'contract', required: true, accept: '.pdf' },
    guidance: 'A blocked submission points the browser’s message at the file input.',
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Project attachments',
      description,
      name: 'attachments',
      error: 'The file is larger than 10 MB.',
    },
    preset: true,
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Project attachments', name: 'attachments', disabled: true },
  },
  multipleFalse: {
    label: 'multiple="false"',
    attributes: { multiple: 'false' },
    props: { label: 'Project attachments', name: 'attachments' },
    incorrect: {
      explanation:
        '`multiple` is a boolean attribute: any value, "false" too, lets the user choose several files. Leave the attribute out for one file.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
});
