import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-checkbox-group> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './checkbox-group.js';

/** Moves the mounted choices into the example's group. */
const adopt = (element: Element, host: Element) => {
  element.append(...host.children);
  host.remove();
};
const channels = (checked: boolean) =>
  html`<div>
    <odd-checkbox name="channel" value="email" ?checked=${checked}
      >Email notifications</odd-checkbox
    >
    <odd-checkbox name="channel" value="desktop">Desktop notifications</odd-checkbox>
    <odd-checkbox name="channel" value="summary">Weekly summary</odd-checkbox>
  </div>`;
const description = 'Choose how you want to hear about project updates.';

export default defineExamples('odd-checkbox-group', {
  default: {
    label: 'Default',
    props: { label: 'Notifications', description },
    previewRoles: ['checkboxGroup'],
    preset: true,
    recommended: true,
    guidance:
      'Each `odd-checkbox` keeps its own `name`, `value`, and checkedness; the group gives them one legend, description, and error.',
    fixture({ element, mount }) {
      adopt(element, mount(channels(true)));
    },
  },
  required: {
    label: 'Required',
    props: { label: 'Notifications', description, required: true },
    guidance:
      'At least one choice must be checked; a blocked submission points the browser’s message at the first choice.',
    fixture({ element, mount }) {
      adopt(element, mount(channels(false)));
    },
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Notifications',
      description,
      required: true,
      error: 'Choose at least one notification method.',
    },
    preset: true,
    guidance: '`error` shows under the choices and keeps the group invalid until it is cleared.',
    fixture({ element, mount }) {
      adopt(element, mount(channels(false)));
    },
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Notifications', description, disabled: true },
    guidance:
      'Disables every choice; enabling the group again leaves choices you disabled yourself as they were.',
    fixture({ element, mount }) {
      adopt(element, mount(channels(true)));
    },
  },
  horizontal: {
    label: 'Horizontal',
    props: { label: 'Notifications', orientation: 'horizontal' },
    guidance: 'For a few short choices; they wrap onto more lines when space runs out.',
    fixture({ element, mount }) {
      adopt(element, mount(channels(true)));
    },
  },
  requiredFalse: {
    label: 'Optional with required="false"',
    props: { label: 'Notifications' },
    attributes: { required: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this group still needs a choice and blocks an empty submission. Leave the attribute out for an optional group.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
    fixture({ element, mount }) {
      adopt(element, mount(channels(false)));
    },
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Notifications', description, required: true },
    guidance:
      'The choices submit under their own names; the group blocks the submission while none is checked.',
    fixture({ scope, element, mount }) {
      adopt(element, mount(channels(false)));
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
