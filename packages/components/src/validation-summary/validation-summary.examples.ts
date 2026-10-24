import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-validation-summary> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './validation-summary.js';

// Native fields keep each preview to this element's own module graph.
const fields = html`<p>
    <label>Project name <input name="project" required /></label>
  </p>
  <p>
    <label>Owner email <input name="owner" type="email" required value="ada@" /></label>
  </p>
  <button type="submit">Save</button>`;

/** Submits the form as a user would, then gives focus back, so a preview does not take it. */
async function submit(form: Element) {
  form.addEventListener('submit', (event) => event.preventDefault());
  form.querySelector('button')!.click();
  await new Promise(requestAnimationFrame);
  (document.activeElement as HTMLElement | null)?.blur();
}

export default defineExamples('odd-validation-summary', {
  default: {
    label: 'After a blocked submission',
    previewRoles: ['validationSummary'],
    recommended: true,
    preset: true,
    guidance:
      'Put it at the top of the form. It stays hidden until a submission is blocked, then lists each problem as a link to its field and takes focus.',
    async fixture({ element, mount }) {
      const form = mount(html`<form>${fields}</form>`);
      form.prepend(element);
      await submit(form);
    },
  },
  externalForm: {
    label: 'Outside its form',
    attributes: { form: 'project-settings' },
    guidance: '`form` names the form by ID when the summary is not inside it.',
    async fixture({ element, mount }) {
      const form = mount(html`<form id="project-settings">${fields}</form>`);
      form.before(element);
      await submit(form);
    },
  },
  heading: {
    label: 'Own heading',
    props: { label: 'There is a problem' },
    guidance: '`label` replaces the default heading, "Please fix {count} fields".',
    async fixture({ element, mount }) {
      const form = mount(html`<form>${fields}</form>`);
      form.prepend(element);
      await submit(form);
    },
  },
  forAttribute: {
    label: 'for="…"',
    attributes: { for: 'project-billing' },
    incorrect: {
      explanation:
        'The summary names its form with `form`, as form controls do. `for` is not one of its attributes, so it finds no form and never shows.',
      diagnostic: 'usage.attribute.unknown',
      correct: 'externalForm',
    },
    async fixture({ element, mount }) {
      const form = mount(html`<form id="project-billing">${fields}</form>`);
      form.before(element);
      await submit(form);
    },
  },
});
