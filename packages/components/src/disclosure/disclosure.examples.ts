import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-disclosure> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './disclosure.js';

export default defineExamples('odd-disclosure', {
  default: {
    label: 'Closed',
    previewRoles: ['disclosure'],
    props: { label: 'Advanced settings' },
    slots: { default: 'Additional options appear in this related region.' },
    recommended: true,
    preset: true,
  },
  open: {
    label: 'Open',
    props: { label: 'Advanced settings', open: true },
    slots: { default: 'Additional options appear in this related region.' },
    preset: true,
  },
  accordion: {
    label: 'Accordion',
    props: { label: 'How do themes work?', name: 'faq', open: true },
    slots: {
      default: 'Semantic tokens adapt each control without changing its behaviour or your data.',
    },
    preset: true,
    guidance:
      'Disclosures that share a `name` open one at a time; side by side, they draw as one surface. Without `name`, several can stay open.',
    fixture({ element, mount }) {
      const host = mount(
        html`<div>
          <odd-disclosure name="faq" label="Can I use my own components?"
            >Yes. Oddkin elements work beside any other custom elements.</odd-disclosure
          ><odd-disclosure name="faq" label="Which browsers are supported?"
            >Chrome and Edge 130, Firefox 132, and Safari 18.2 or later.</odd-disclosure
          >
        </div>`,
      );
      element.after(...host.children);
      host.remove();
    },
  },
  disabled: {
    label: 'Disabled',
    props: { label: 'Advanced settings', disabled: true },
    slots: { default: 'Additional options appear in this related region.' },
  },
  openFalse: {
    label: 'open="false"',
    attributes: { open: 'false', label: 'Advanced settings' },
    slots: { default: 'Additional options appear in this related region.' },
    incorrect: {
      explanation:
        'Boolean attributes are on when present, whatever their value: open="false" opens the disclosure. Leave the attribute out.',
      diagnostic: 'usage.boolean.false',
      correct: 'default',
    },
  },
  summarySlot: {
    label: 'Summary as slot content',
    slots: { summary: 'Advanced settings' },
    incorrect: {
      explanation:
        '`odd-disclosure` has no summary slot: the summary text is `label`. Slotted text with an unknown slot name is never shown, and the disclosure button has no name.',
      diagnostic: 'usage.slot.unknown',
      correct: 'default',
    },
  },
});
