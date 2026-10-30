import { html, render } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-listbox> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './listbox.js';

const roles = ({ selected = true, ownerDisabled = false } = {}) =>
  html`<option value="viewer">Viewer</option>
    <option value="editor" ?selected=${selected}>Editor</option>
    <option value="admin">Administrator</option>
    <option value="owner" ?disabled=${ownerDisabled}>Owner</option>`;

export default defineExamples('odd-listbox', {
  default: {
    label: 'Options as children',
    previewRoles: ['listbox'],
    props: { label: 'Workspace role', name: 'role' },
    recommended: true,
    preset: true,
    guidance:
      'Write the choices as `<option>` children, as for a native select; `selected` marks the default.',
    fixture({ element }) {
      render(roles(), element);
    },
  },
  multiple: {
    label: 'Several selected',
    props: { label: 'Notify me about', name: 'topics', multiple: true },
    preset: true,
    guidance: 'With `multiple`, Space and a click toggle an option; Shift with an arrow extends.',
    fixture({ element }) {
      render(
        html`<option value="mentions" selected>Mentions</option>
          <option value="comments" selected>Comments</option>
          <option value="releases">Releases</option>
          <option value="digest" title="Every Monday">Weekly digest</option>`,
        element,
      );
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
  disabledOption: {
    label: 'Disabled option',
    props: { label: 'Workspace role', name: 'role' },
    fixture({ element }) {
      render(roles({ ownerDisabled: true }), element);
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
  loading: {
    label: 'Loading',
    props: { label: 'Workspace role', loading: true },
    preset: true,
  },
  empty: {
    label: 'Empty',
    props: { label: 'Workspace role', options: [] },
    guidance: 'Put your own text in the `empty` slot to say what will appear.',
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Workspace role', required: true },
    // Form-associated elements submit under their `name` attribute.
    attributes: { name: 'role' },
    guidance:
      'Participates in its form like a native select: submits the selected value, blocks submission while required and empty (the message points at the listbox), and resets to the declared selection.',
    fixture({ scope, element, mount }) {
      render(roles({ selected: false }), element);
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
        '`options` is rich data and is read only as a property; an attribute string is ignored and the listbox shows its empty state. Write `<option>` children, or assign an array to `.options`.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
  },
});
