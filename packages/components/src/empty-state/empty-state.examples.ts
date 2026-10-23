import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-empty-state> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './empty-state.js';

export default defineExamples('odd-empty-state', {
  default: {
    label: 'First use',
    previewRoles: ['emptyState'],
    props: { label: 'Your first project starts here' },
    slots: { default: 'Create a shared space for your team’s work.' },
    recommended: true,
    preset: true,
    fixture({ element, mount }) {
      const host = mount(
        html`<div><odd-button slot="footer" appearance="primary">New project</odd-button></div>`,
      );
      element.append(host.querySelector('odd-button')!);
      host.remove();
    },
  },
  noResults: {
    label: 'No results',
    props: { label: 'No matching projects' },
    slots: { default: 'Try a different search or clear your filters.' },
    guidance: 'Offer the way out (clear filters) as the next step.',
  },
  textOnly: {
    label: 'Text only',
    props: { label: 'Nothing to review' },
    slots: { default: 'New requests appear here.' },
  },
  actionsSlot: {
    label: 'Button in an "actions" slot',
    props: { label: 'No matching projects' },
    slots: { default: 'Try a different search.', actions: 'Clear filters' },
    incorrect: {
      explanation:
        'The next step goes in the `footer` slot; content assigned to any other slot name is not shown.',
      diagnostic: 'usage.slot.unknown',
      correct: 'default',
    },
  },
});
