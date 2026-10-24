import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-split-button> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './split-button.js';

const saves =
  'Save<option value="save-as">Save as…</option><option value="copy">Save a copy</option>';

export default defineExamples('odd-split-button', {
  default: {
    label: 'Primary action with alternatives',
    previewRoles: ['splitAction'],
    props: { value: 'save', appearance: 'primary' },
    recommended: true,
    preset: true,
    guidance:
      'The primary half reports `{ id: value, action: "primary" }`; the `<option value>` children are the menu, reporting `{ id, action: "select" }`.',
    fixture({ element }) {
      element.innerHTML = saves;
    },
  },
  secondary: {
    label: 'Secondary',
    props: { value: 'merge' },
    preset: true,
    fixture({ element }) {
      element.innerHTML =
        'Merge<optgroup label="Strategy"><option value="squash">Squash and merge</option><option value="rebase">Rebase and merge</option></optgroup><hr><option value="settings">Merge settings</option>';
    },
  },
  fromData: {
    label: 'Items property with a submenu',
    props: {
      value: 'publish',
      appearance: 'primary',
      items: [
        { id: 'schedule', label: 'Schedule…' },
        {
          id: 'share',
          label: 'Publish to',
          items: [
            { id: 'web', label: 'Web' },
            { id: 'newsletter', label: 'Newsletter' },
          ],
        },
      ],
    },
    guidance: 'Set `items` when the alternatives come from data, as on odd-menu.',
    fixture({ element }) {
      element.textContent = 'Publish';
    },
  },
  loading: {
    label: 'Loading',
    props: { value: 'save', appearance: 'primary', loading: true },
    guidance:
      'While `loading`, the primary half shows a spinner and ignores presses; the menu still opens.',
    fixture({ element }) {
      element.innerHTML = saves;
    },
  },
  disabled: {
    label: 'Disabled',
    props: { value: 'save', appearance: 'primary', disabled: true },
    fixture({ element }) {
      element.innerHTML = saves;
    },
  },
  itemsAttribute: {
    label: 'Items written as an attribute',
    attributes: { value: 'save', items: JSON.stringify([{ id: 'copy', label: 'Save a copy' }]) },
    incorrect: {
      explanation:
        '`items` is rich data and is read only as a property; an attribute string is ignored and the menu has no items. Write `<option>` children, or assign an array to `.items`.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
    fixture({ element }) {
      element.textContent = 'Save';
    },
  },
});
