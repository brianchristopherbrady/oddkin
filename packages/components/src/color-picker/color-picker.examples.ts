import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-color-picker> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './color-picker.js';

const swatches = [
  { value: '#2563eb', label: 'Blue' },
  { value: '#d4466c', label: 'Rose' },
  { value: '#16a34a', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#7c3aed', label: 'Violet' },
];

export default defineExamples('odd-color-picker', {
  default: {
    label: 'Default',
    props: {
      label: 'Layer color',
      description: 'Hex, RGB and opacity describe the selected color.',
      name: 'layer',
      value: '#2563eb',
      options: swatches,
    },
    previewRoles: ['colorPicker'],
    recommended: true,
    preset: true,
    guidance:
      'Type a hex colour in the field, or open the popup to pick one; Apply commits the popup’s colour and Cancel or Escape discards it. The value is a native colour input’s: lowercase `#rrggbb`.',
  },
  alpha: {
    label: 'With opacity',
    props: {
      label: 'Highlight',
      name: 'highlight',
      alpha: true,
      value: 'color(srgb 0.831373 0.27451 0.423529 / 0.5)',
    },
    preset: true,
    guidance:
      'With `alpha`, the popup adds an opacity field and the value takes the CSS form color(srgb r g b / a), as HTML’s `alpha` attribute specifies for a native colour input.',
  },
  children: {
    label: 'Swatches as children',
    props: { label: 'Label color', name: 'label' },
    guidance: 'Write `<option>` children for the suggested colours, their text naming each one.',
    fixture({ element }) {
      element.innerHTML =
        '<option value="#2563eb">Blue</option><option value="#16a34a">Green</option><option value="#f59e0b">Amber</option>';
    },
  },
  invalid: {
    label: 'Invalid',
    props: {
      label: 'Layer color',
      name: 'layer',
      value: '#2563eb',
      error: 'Choose a color with more contrast against white.',
    },
    preset: true,
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Layer color', value: '#2563eb', disabled: true },
  },
  alphaFalse: {
    label: 'alpha="false"',
    attributes: { alpha: 'false' },
    props: { label: 'Highlight', name: 'highlight' },
    incorrect: {
      explanation:
        '`alpha` is a boolean attribute: any value, "false" too, adds opacity. Leave the attribute out for an opaque colour.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
});
