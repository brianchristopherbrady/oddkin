import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-card> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './card.js';

export default defineExamples('odd-card', {
  default: {
    label: 'Default',
    slots: { default: 'Cards group related content into one unit.' },
    previewRoles: ['surface'],
    preset: true,
    recommended: true,
  },
  filled: {
    label: 'Filled',
    props: { variant: 'filled' },
    slots: { default: 'A filled surface sits quietly on the page background.' },
    preset: true,
  },
  elevated: {
    label: 'Elevated',
    props: { variant: 'elevated' },
    slots: { default: 'An elevated surface stands out with a shadow.' },
    preset: true,
  },
  compact: {
    label: 'Compact',
    props: { padding: 'sm' },
    slots: { default: 'Less padding for dense layouts.' },
  },
  named: {
    label: 'Named region',
    props: { label: 'Usage this month' },
    slots: { default: '2,140 of 5,000 requests.' },
    guidance: '`label` makes the card a named region; use it only when the card is a landmark.',
  },
  headed: {
    label: 'Header and footer',
    slots: { default: 'Revenue grew 12% since last week.' },
    guidance:
      'A heading in the header slot names the card where the browser supports element reflection; otherwise also set `label`.',
    fixture({ element, mount }) {
      const parts = mount(
        html`<div>
          <h3 slot="header">Weekly report</h3>
          <odd-button slot="footer" size="sm">Open report</odd-button>
        </div>`,
      );
      element.prepend(parts.querySelector('h3')!);
      element.append(parts.querySelector('odd-button')!);
      parts.remove();
    },
  },
});
