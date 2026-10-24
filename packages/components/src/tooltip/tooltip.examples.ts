import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-tooltip> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './tooltip.js';

export default defineExamples('odd-tooltip', {
  default: {
    label: 'On a button',
    previewRoles: ['tooltip'],
    props: { anchor: 'tooltip-copy-link' },
    slots: { default: 'Copy a link to this workspace' },
    recommended: true,
    preset: true,
    guidance:
      'Point `anchor` at the control by ID. The tooltip describes the control, which keeps its own name: a tooltip is never the only name.',
    fixture({ element, mount }) {
      const parts = mount(
        html`<div><odd-button id="tooltip-copy-link">Copy link</odd-button></div>`,
      );
      element.before(...parts.children);
      parts.remove();
    },
  },
  inlineEnd: {
    label: 'Beside its control',
    props: { anchor: 'tooltip-archive', side: 'inline-end' },
    slots: { default: 'You can restore it from settings.' },
    preset: true,
    guidance:
      "`side` and `align` follow the control's writing direction: `inline-end` is to the right in English and to the left in Arabic or Hebrew.",
    fixture({ element, mount }) {
      const parts = mount(html`<div><odd-button id="tooltip-archive">Archive</odd-button></div>`);
      element.before(...parts.children);
      parts.remove();
    },
  },
  physicalSide: {
    label: 'side="right"',
    attributes: { side: 'right' },
    slots: { default: 'You can restore it from settings.' },
    incorrect: {
      explanation:
        '`side` is logical, so it follows the writing direction: `inline-end` is to the right in English and to the left in Arabic. An unknown value is reported, and the tooltip shows above its control (`block-start`) instead.',
      diagnostic: 'usage.attribute.value',
      correct: 'inlineEnd',
    },
  },
});
