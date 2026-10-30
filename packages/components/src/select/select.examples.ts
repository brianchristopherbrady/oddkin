import { html, render } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-select> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './select.js';

const roles = (selected = true) =>
  html`<option value="viewer">Viewer</option>
    <option value="editor" ?selected=${selected}>Editor</option>
    <option value="admin">Administrator</option>
    <option value="owner">Owner</option>`;

export default defineExamples('odd-select', {
  default: {
    label: 'Options as children',
    previewRoles: ['select'],
    props: { label: 'Workspace role', name: 'role' },
    recommended: true,
    preset: true,
    guidance:
      'Write the choices as `<option>` children, as for a native select; `selected` marks the default.',
    fixture({ element }) {
      render(roles(), element);
    },
  },
  placeholder: {
    label: 'Placeholder',
    props: {
      label: 'Workspace role',
      description: 'Choose the access level.',
      placeholder: 'Choose a role…',
    },
    preset: true,
    guidance:
      'A placeholder shows until an option is chosen and submits an empty value; it is never the label.',
    fixture({ element }) {
      render(roles(false), element);
    },
  },
  groups: {
    label: 'Groups',
    props: { label: 'Region', name: 'region' },
    fixture({ element }) {
      render(
        html`<optgroup label="Europe">
            <option value="fra">Frankfurt</option>
            <option value="dub">Dublin</option>
          </optgroup>
          <optgroup label="Americas">
            <option value="iad">Virginia</option>
            <option value="gru">São Paulo</option>
          </optgroup>`,
        element,
      );
    },
  },
  fromData: {
    label: 'Options property',
    props: {
      label: 'Workspace role',
      options: [
        { value: 'viewer', label: 'Viewer', description: 'Can view' },
        { value: 'editor', label: 'Editor', description: 'Can edit' },
      ],
      value: 'editor',
    },
    guidance:
      'Set `options` to `{ value, label, description?, disabled?, group? }` records when the choices come from data.',
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Workspace role', disabled: true },
    fixture({ element }) {
      render(roles(), element);
    },
  },
  withError: {
    label: 'With an error',
    props: { label: 'Workspace role', error: 'Choose a role to continue.' },
    guidance: 'Set `error` to show a message and mark the select invalid until it is cleared.',
    fixture({ element }) {
      render(roles(), element);
    },
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Workspace role', placeholder: 'Choose a role…', required: true },
    // Form-associated elements submit under their `name` attribute.
    attributes: { name: 'role' },
    guidance:
      'Participates in its form like a native select: submits the chosen value, blocks submission while required and on the placeholder, and resets to the declared choice.',
    fixture({ scope, element, mount }) {
      render(roles(false), element);
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
  optionsAttribute: {
    label: 'Options written as an attribute',
    attributes: {
      label: 'Workspace role',
      options: JSON.stringify([{ value: 'viewer', label: 'Viewer' }]),
    },
    incorrect: {
      explanation:
        '`options` is rich data and is read only as a property; an attribute string is ignored and the select has no options. Write `<option>` children, or assign an array to `.options`.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
  },
});
