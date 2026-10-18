import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-button> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './button.js';

export default defineExamples('odd-button', {
  default: { label: 'Default', slots: { default: 'Save' }, preset: true },
  primary: {
    label: 'Primary',
    props: { appearance: 'primary' },
    slots: { default: 'Continue' },
    previewRoles: ['primaryAction'],
    preset: true,
    recommended: true,
    guidance: 'Use one primary button per view or form, for the action most people take next.',
  },
  secondary: {
    label: 'Secondary',
    props: { appearance: 'secondary' },
    slots: { default: 'Cancel' },
    previewRoles: ['secondaryAction'],
    preset: true,
  },
  ghost: {
    label: 'Ghost',
    props: { appearance: 'ghost' },
    slots: { default: 'Skip for now' },
    guidance: 'For low-emphasis actions beside stronger ones.',
  },
  small: { label: 'Small', props: { size: 'sm' }, slots: { default: 'Edit' } },
  large: {
    label: 'Large',
    props: { size: 'lg', appearance: 'primary' },
    slots: { default: 'Get started' },
  },
  disabled: {
    label: 'Disabled',
    props: { disabled: true },
    slots: { default: 'Delete' },
    guidance: 'A disabled button cannot be focused; say nearby why the action is unavailable.',
  },
  loading: {
    label: 'Loading',
    props: { loading: true, appearance: 'primary' },
    slots: { default: 'Saving' },
    guidance: 'Stays focusable and ignores activation. Announce progress separately if it matters.',
  },
  fullWidth: {
    label: 'Full width',
    props: { fullWidth: true, appearance: 'primary' },
    slots: { default: 'Sign in' },
  },
  inForm: {
    label: 'Submits a form',
    props: { type: 'submit', name: 'intent', value: 'create', appearance: 'primary' },
    slots: { default: 'Create project' },
    guidance:
      'Submits its form with its name and value. Read `new FormData(form, event.submitter)` synchronously in the submit listener: the submitter is a temporary native button.',
    fixture({ scope, element, mount }) {
      const form = mount(
        html`<form>
          <odd-input label="Project name" name="project" value="Atlas" required></odd-input>
          <output name="submitted"></output>
        </form>`,
      ) as HTMLFormElement;
      form.querySelector('output')!.before(element);
      scope.listen<SubmitEvent>(form, 'submit', (event) => {
        event.preventDefault();
        const data = new FormData(form, event.submitter);
        form.querySelector('output')!.value = new URLSearchParams(
          data as unknown as Record<string, string>,
        ).toString();
      });
    },
  },
});
