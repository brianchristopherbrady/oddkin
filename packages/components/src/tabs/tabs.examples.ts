import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-tabs> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './tabs.js';

/** Moves the mounted panels into the example's element. */
const adopt = (element: Element, host: Element) => {
  element.append(...host.children);
  host.remove();
};

export default defineExamples('odd-tabs', {
  default: {
    label: 'Selected',
    previewRoles: ['tabs'],
    props: { label: 'Project', value: 'overview' },
    recommended: true,
    preset: true,
    guidance:
      'Give each `odd-tab-panel` a `label` and a `value`; listen for `change` to follow the selection.',
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-tab-panel label="Overview" value="overview"
              >This panel belongs to the selected Overview tab.</odd-tab-panel
            ><odd-tab-panel label="Activity" value="activity"
              >Recent changes appear here.</odd-tab-panel
            ><odd-tab-panel label="Settings" value="settings"
              >Settings for this project.</odd-tab-panel
            >
          </div>`,
        ),
      );
    },
  },
  manual: {
    label: 'Manual activation',
    props: { label: 'Project', activation: 'manual' },
    guidance:
      'Arrow keys move focus without changing the panel; Enter or Space selects. Use it when showing a panel is slow.',
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-tab-panel label="Overview">Project overview.</odd-tab-panel
            ><odd-tab-panel label="Activity">Recent changes.</odd-tab-panel>
          </div>`,
        ),
      );
    },
  },
  vertical: {
    label: 'Vertical',
    props: { label: 'Project', orientation: 'vertical' },
    preset: true,
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-tab-panel label="Overview">Project overview.</odd-tab-panel
            ><odd-tab-panel label="Activity">Recent changes.</odd-tab-panel>
          </div>`,
        ),
      );
    },
  },
  disabledTab: {
    label: 'With a disabled tab',
    props: { label: 'Project' },
    guidance: 'A disabled tab is skipped by the arrow keys and cannot be selected.',
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-tab-panel label="Overview">Project overview.</odd-tab-panel
            ><odd-tab-panel label="Billing" disabled>Billing.</odd-tab-panel
            ><odd-tab-panel label="Settings">Settings.</odd-tab-panel>
          </div>`,
        ),
      );
    },
  },
  orientationColumn: {
    label: 'orientation="column"',
    attributes: { orientation: 'column', label: 'Project' },
    incorrect: {
      explanation:
        '`orientation` accepts horizontal or vertical. "column" is reported and the tabs stay horizontal; use vertical.',
      diagnostic: 'usage.attribute.value',
      correct: 'vertical',
    },
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-tab-panel label="Overview">Project overview.</odd-tab-panel
            ><odd-tab-panel label="Activity">Recent changes.</odd-tab-panel>
          </div>`,
        ),
      );
    },
  },
});
