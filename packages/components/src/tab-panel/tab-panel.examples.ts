import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-tab-panel> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './tab-panel.js';

export default defineExamples('odd-tab-panel', {
  default: {
    label: 'In odd-tabs',
    previewRoles: ['tabPanel'],
    props: { label: 'Overview', value: 'overview' },
    slots: { default: 'This panel belongs to the selected Overview tab.' },
    recommended: true,
    preset: true,
    guidance: 'A panel is a child of `odd-tabs`; its `label` is the text of its tab.',
    fixture({ element, mount }) {
      const tabs = mount(html`<odd-tabs label="Project"></odd-tabs>`);
      tabs.append(element);
    },
  },
});
