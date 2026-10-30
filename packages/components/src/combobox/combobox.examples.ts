import { html, render } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-combobox> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './combobox.js';

const projects = [
  { value: 'atlas', label: 'Atlas' },
  { value: 'beacon', label: 'Beacon', description: 'Archived' },
  { value: 'cobalt', label: 'Cobalt' },
  { value: 'delta', label: 'Delta' },
  { value: 'ember', label: 'Ember' },
  { value: 'falcon', label: 'Falcon' },
];
const members = [
  { value: 'amelia', label: 'Amelia Johnson', group: 'Design' },
  { value: 'noah', label: 'Noah Williams', group: 'Engineering' },
  { value: 'olivia', label: 'Olivia Brown', group: 'Design' },
  { value: 'liam', label: 'Liam Wilson', group: 'Engineering' },
  { value: 'sophia', label: 'Sophia Davis', group: 'Product' },
  { value: 'ethan', label: 'Ethan Miller', group: 'Engineering' },
];
const chosen = ['amelia', 'noah', 'olivia', 'liam', 'sophia'];
const topics = html`<option value="design">Design</option>
  <option value="research" selected>Research</option>
  <option value="engineering" selected>Engineering</option>
  <option value="marketing">Marketing</option>
  <option value="support">Support</option>
  <option value="sales">Sales</option>`;

export default defineExamples('odd-combobox', {
  default: {
    label: 'Find a project',
    previewRoles: ['combobox'],
    props: {
      label: 'Project',
      description: 'Search by project name.',
      placeholder: 'Choose a project…',
      options: projects,
    },
    recommended: true,
    preset: true,
    guidance:
      'Typing filters the options by label and makes the first match active; Enter or a click chooses it. The text the user types is never the value.',
  },
  multiple: {
    label: 'Several values',
    props: { label: 'Topics', name: 'topics', multiple: true },
    preset: true,
    guidance:
      'With `multiple`, chosen values are chips in the field; while the field is not in use they collapse to the ones that fit and "+N". Backspace in the empty input removes the last one.',
    fixture({ element }) {
      render(topics, element);
    },
  },
  views: {
    label: 'Chosen values as a count',
    props: {
      label: 'Team members',
      multiple: true,
      view: 'count',
      options: members,
      values: chosen,
    },
    guidance:
      '`view` shows the chosen values as chips (the default), a count, a sentence (`text`), chips up to four and then the count (`auto`), two rows of chips with Show all (`expandable`), initials (`avatars`), or a count per option `group` (`grouped`). Past a handful of values, prefer `count`, `auto`, or `grouped`.',
  },
  grouped: {
    label: 'Chosen values counted by group',
    props: {
      label: 'Team members',
      multiple: true,
      view: 'grouped',
      options: members,
      values: chosen,
    },
    guidance:
      'Give each option a `group`; the field shows one chip per group with its count, or the total when they do not fit.',
  },
  selectAll: {
    label: 'Select all and review',
    props: {
      label: 'Team members',
      multiple: true,
      view: 'auto',
      selectAll: true,
      review: true,
      options: members,
      values: chosen,
    },
    guidance:
      '`select-all` puts a Select all check box above the options shown (mixed while some are chosen); `review` starts the open popup with the chosen values, each removable, and the count with Clear all.',
  },
  children: {
    label: 'Options as children',
    props: { label: 'Region', name: 'region' },
    guidance: 'Write `<option>` and `<optgroup>` children, as for a native select.',
    fixture({ element }) {
      render(
        html`<optgroup label="Europe">
            <option value="fra">Frankfurt</option>
            <option value="dub">Dublin</option>
          </optgroup>
          <optgroup label="Americas">
            <option value="iad" selected>Virginia</option>
            <option value="gru">São Paulo</option>
          </optgroup>`,
        element,
      );
    },
  },
  serverFiltered: {
    label: 'Filtered by the page',
    props: { label: 'Person', noFilter: true, placeholder: 'Type a name…', options: [] },
    guidance:
      'With `no-filter`, listen to `odd-query-change` and replace `options` with the matches (set `loading` while they load).',
    fixture({ scope, element }) {
      const people = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Katherine Johnson'];
      scope.listen(element, 'odd-query-change', (event) => {
        const query = (event as CustomEvent<{ query: string }>).detail.query.toLowerCase();
        element.options = people
          .filter((name) => name.toLowerCase().startsWith(query))
          .map((name) => ({ value: name.toLowerCase().replace(/ /g, '-'), label: name }));
      });
    },
  },
  loading: {
    label: 'Loading',
    props: { label: 'Project', loading: true, options: [] },
    preset: true,
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Project', disabled: true, options: projects, value: 'atlas' },
  },
  readonly: {
    label: 'Read-only',
    props: {
      label: 'Topics',
      readonly: true,
      multiple: true,
      options: projects,
      values: ['atlas', 'cobalt'],
    },
  },
  inForm: {
    label: 'In a form',
    props: { label: 'Project', required: true, options: projects },
    // Form-associated elements submit under their `name` attribute.
    attributes: { name: 'project' },
    guidance:
      'Participates in its form like a native select: submits the chosen value (each value with `multiple`), blocks submission while required and empty (the message points at the input), and resets to the declared value.',
    fixture({ scope, element, mount }) {
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
      label: 'Project',
      options: JSON.stringify([{ value: 'atlas', label: 'Atlas' }]),
    },
    incorrect: {
      explanation:
        '`options` is rich data and is read only as a property; an attribute string is ignored and the popup shows its empty state. Write `<option>` children, or assign an array to `.options`.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
  },
});
