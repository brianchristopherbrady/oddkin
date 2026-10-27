import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-picker> into HTMLElementTagNameMap, so props are checked against the element.
import type { TreeItemRecord } from './picker.js';

const layers: readonly TreeItemRecord[] = [
  {
    id: 'workspace',
    label: 'Workspace layers',
    children: [
      {
        id: 'transportation',
        label: 'Transportation',
        children: [
          { id: 'roads', label: 'Roads' },
          { id: 'rail', label: 'Rail' },
        ],
      },
      { id: 'boundaries', label: 'Boundaries' },
      { id: 'buildings', label: 'Buildings' },
    ],
  },
];
const flat =
  '<option value="roads">Roads</option><option value="rail">Rail</option><option value="boundaries">Boundaries</option><option value="buildings">Buildings</option>';
const grouped =
  '<optgroup label="Transportation"><option value="roads">Roads</option><option value="rail">Rail</option></optgroup><option value="boundaries">Boundaries</option><option value="buildings">Buildings</option>';
const field = {
  label: 'Map layers',
  description: 'Choose from the available layers.',
};

export default defineExamples('odd-picker', {
  default: {
    label: 'A hierarchy',
    previewRoles: ['picker'],
    props: { ...field, placeholder: 'Choose a layer…', items: layers, value: 'roads' },
    recommended: true,
    preset: true,
    guidance:
      'With `items`, the popup is a tree: expanding a branch never selects it or its descendants, and the field shows the chosen item after its parent. Activating a row chooses it and closes the popup.',
  },
  multiple: {
    label: 'Several items',
    props: {
      ...field,
      placeholder: 'Choose layers…',
      items: layers,
      multiple: true,
      values: ['roads', 'rail', 'boundaries'],
    },
    preset: true,
    guidance:
      'With `multiple`, rows toggle at once and the chosen items are chips ("+N" for those that do not fit); Done or Escape closes the popup, and Clear empties the selection.',
  },
  list: {
    label: 'A flat list',
    props: { ...field, name: 'layer', placeholder: 'Choose a layer…' },
    guidance:
      'Without `items`, the popup is a listbox: write `<option>` and `<optgroup>` children, as for a native select, or assign `options`.',
    fixture({ element }) {
      element.innerHTML = grouped;
    },
  },
  listMultiple: {
    label: 'Several from a list, counted, with Select all',
    props: {
      ...field,
      name: 'layers',
      placeholder: 'Choose layers…',
      multiple: true,
      view: 'count',
      selectAll: true,
    },
    guidance:
      '`view` shows the chosen values as on odd-combobox (`count` here); `select-all` adds a Select all check box above a listbox (not a tree); `review` starts the popup with the chosen values.',
    fixture({ element }) {
      element.innerHTML = flat.replace('"roads"', '"roads" selected');
    },
  },
  loading: {
    label: 'Loading',
    props: { ...field, placeholder: 'Choose a layer…', loading: true, items: [] },
    preset: true,
  },
  empty: {
    label: 'Nothing to choose',
    props: { ...field, placeholder: 'Choose a layer…', items: [] },
    guidance:
      'The empty slot replaces `strings.empty`; the `status` slot holds an error and a retry action.',
  },
  disabled: {
    label: 'Disabled',
    props: { ...field, items: layers, value: 'roads', disabled: true },
  },
  inForm: {
    label: 'In a form',
    props: { ...field, placeholder: 'Choose a layer…', items: layers, required: true },
    // Form-associated elements submit under their `name` attribute.
    attributes: { name: 'layer' },
    guidance:
      'Participates in its form like a native select: submits the chosen value (each value with `multiple`), blocks submission while required and empty (the message points at the trigger), and resets to the declared value.',
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
  itemsAttribute: {
    label: 'Items written as an attribute',
    attributes: { label: 'Map layers', items: JSON.stringify(layers) },
    incorrect: {
      explanation:
        '`items` is rich data and is read only as a property; an attribute string is ignored, so the popup is an empty listbox. Assign an array to `.items`.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
  },
});
