import { html, render } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-segmented-control> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './segmented-control.js';

const sizes = (selected = true) =>
  html`<option value="sm">Small</option>
    <option value="md" ?selected=${selected}>Medium</option>
    <option value="lg">Large</option>`;
// Spelled out, not built by a helper, so the published metadata carries this preset's values.
const listIcon =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"%3E%3Crect x="3" y="4" width="14" height="2"/%3E%3Crect x="3" y="9" width="14" height="2"/%3E%3Crect x="3" y="14" width="14" height="2"/%3E%3C/svg%3E';
const gridIcon =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"%3E%3Crect x="3" y="3" width="6" height="6"/%3E%3Crect x="11" y="3" width="6" height="6"/%3E%3Crect x="3" y="11" width="6" height="6"/%3E%3Crect x="11" y="11" width="6" height="6"/%3E%3C/svg%3E';

export default defineExamples('odd-segmented-control', {
  default: {
    label: 'Options as children',
    props: { label: 'Preview size', name: 'size' },
    recommended: true,
    preset: true,
    guidance:
      'Write the options as `<option>` children, as for a native select; `selected` marks the default.',
    fixture({ element }) {
      render(sizes(), element);
    },
  },
  fromData: {
    label: 'Options property',
    previewRoles: ['segmented'],
    props: {
      label: 'Preview size',
      options: [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
        { value: 'lg', label: 'Large' },
      ],
      value: 'md',
    },
    guidance:
      'Set `options` to `{ value, label, description?, disabled?, icon? }` records when the options come from data.',
  },
  iconOnly: {
    label: 'Icon-only options',
    props: {
      label: 'View',
      size: 'sm',
      options: [
        { value: 'list', label: 'List', icon: listIcon },
        { value: 'grid', label: 'Grid', icon: gridIcon },
      ],
      value: 'list',
    },
    preset: true,
    guidance:
      'An option with an `icon` shows the icon alone; its `label` stays its accessible name, so always give one. The icon is drawn from its URL, so the page must allow the URL in `img-src`: these `data:` URLs need `img-src data:`.',
  },
  small: {
    label: 'Small',
    props: { label: 'Preview size', size: 'sm' },
    fixture({ element }) {
      render(sizes(), element);
    },
  },
  large: {
    label: 'Large',
    props: { label: 'Preview size', size: 'lg' },
    fixture({ element }) {
      render(sizes(), element);
    },
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Preview size', disabled: true },
    fixture({ element }) {
      render(sizes(), element);
    },
  },
  requiredFalse: {
    label: 'Optional with required="false"',
    props: { label: 'Preview size' },
    attributes: { required: 'false' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: this control still needs a choice and blocks an empty submission. Leave the attribute out for an optional control.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
    fixture({ element }) {
      render(sizes(false), element);
    },
  },
});
