import { html, render } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-radio-group> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './radio-group.js';

const visibility = (selected: boolean, publicDisabled = false) =>
  html`<option value="private" title="Only invited members" ?selected=${selected}>Private</option>
    <option value="team" title="Anyone in your workspace">Team</option>
    <option value="public" title="Anyone with the link" ?disabled=${publicDisabled}>
      Public
    </option>`;
const description = 'Who can open this project.';

export default defineExamples('odd-radio-group', {
  default: {
    label: 'Options as children',
    props: { label: 'Workspace visibility', name: 'visibility' },
    recommended: true,
    preset: true,
    guidance:
      'Write the options as `<option>` children, as for a native select: `selected` marks the default and `title` is the option’s description.',
    fixture({ element }) {
      render(visibility(true), element);
    },
  },
  fromData: {
    label: 'Options property',
    previewRoles: ['radioGroup'],
    props: {
      label: 'Workspace visibility',
      options: [
        { value: 'private', label: 'Private', description: 'Only invited members' },
        { value: 'team', label: 'Team', description: 'Anyone in your workspace' },
      ],
      value: 'private',
    },
    guidance:
      'Set `options` to `{ value, label, description?, disabled?, group? }` records when the options come from data.',
  },
  required: {
    label: 'Required',
    props: { label: 'Workspace visibility', description, required: true },
    guidance:
      'An option must be checked; a blocked submission points the browser’s message at the first option.',
    fixture({ element }) {
      render(visibility(false), element);
    },
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Workspace visibility',
      required: true,
      error: 'Choose a visibility setting.',
    },
    preset: true,
    guidance: '`error` shows under the options and keeps the group invalid until it is cleared.',
    fixture({ element }) {
      render(visibility(false), element);
    },
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Workspace visibility', description, disabled: true },
    fixture({ element }) {
      render(visibility(true), element);
    },
  },
  disabledOption: {
    label: 'A disabled option',
    props: { label: 'Workspace visibility' },
    guidance: 'A disabled `<option>` stays visible and is skipped by the arrow keys.',
    fixture({ element }) {
      render(visibility(true, true), element);
    },
  },
  horizontal: {
    label: 'Horizontal',
    props: { label: 'Density', orientation: 'horizontal', value: 'comfortable' },
    guidance: 'For a few short options; they wrap onto more lines when space runs out.',
    fixture({ element }) {
      render(
        html`<option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>`,
        element,
      );
    },
  },
  groups: {
    label: 'Groups',
    props: { label: 'Plan', name: 'plan' },
    guidance: '`<optgroup label>` children give a run of options a heading.',
    fixture({ element }) {
      render(
        html`<optgroup label="Monthly">
            <option value="m-team">Team</option>
            <option value="m-business">Business</option>
          </optgroup>
          <optgroup label="Yearly">
            <option value="y-team" title="Two months free">Team</option>
            <option value="y-business" title="Two months free">Business</option>
          </optgroup>`,
        element,
      );
    },
  },
  requiredFalse: {
    label: 'Optional with required="false"',
    props: { label: 'Workspace visibility' },
    attributes: { required: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this group still needs a choice and blocks an empty submission. Leave the attribute out for an optional group.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
    fixture({ element }) {
      render(visibility(false), element);
    },
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Workspace visibility', description, name: 'visibility', required: true },
    guidance:
      'The checked option’s value is submitted under `name`; nothing is submitted while none is checked, and `required` blocks that.',
    fixture({ scope, element, mount }) {
      render(visibility(false), element);
      const form = mount(
        html`<form>
          <odd-button type="submit" appearance="primary">Save</odd-button>
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
