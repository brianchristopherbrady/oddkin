import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-toolbar> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './toolbar.js';

/** Moves the mounted controls into the example's element. */
const adopt = (element: Element, host: Element) => {
  element.append(...host.children);
  host.remove();
};

export default defineExamples('odd-toolbar', {
  default: {
    label: 'Actions',
    previewRoles: ['toolbar'],
    props: { label: 'Project actions' },
    recommended: true,
    preset: true,
    guidance:
      'Name the toolbar. Only one control is a Tab stop; arrow keys reach the others, so keep the set small and related.',
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-button size="sm" appearance="ghost">Filter</odd-button>
            <hr aria-orientation="vertical" />
            <odd-button size="sm" appearance="secondary">Export</odd-button
            ><odd-button size="sm" appearance="primary">New item</odd-button>
          </div>`,
        ),
      );
    },
  },
  selection: {
    label: 'Selection',
    props: { label: 'Selection actions' },
    preset: true,
    guidance: 'Text such as a count sits between controls and is skipped by the arrow keys.',
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <span>3 selected</span><odd-button size="sm" appearance="ghost">Clear</odd-button
            ><odd-button size="sm" appearance="secondary">Export</odd-button
            ><odd-button size="sm" appearance="primary">Assign</odd-button>
          </div>`,
        ),
      );
    },
  },
  vertical: {
    label: 'Vertical',
    props: { label: 'Formatting', orientation: 'vertical' },
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-button size="sm" appearance="ghost">Bold</odd-button
            ><odd-button size="sm" appearance="ghost">Italic</odd-button
            ><odd-button size="sm" appearance="ghost">Underline</odd-button>
          </div>`,
        ),
      );
    },
  },
  orientationRow: {
    label: 'orientation="row"',
    attributes: { orientation: 'row', label: 'Formatting' },
    incorrect: {
      explanation:
        '`orientation` accepts horizontal or vertical. "row" is reported and the toolbar stays horizontal; leave it out for a row.',
      diagnostic: 'usage.attribute.value',
      correct: 'vertical',
    },
    fixture({ element, mount }) {
      adopt(
        element,
        mount(
          html`<div>
            <odd-button size="sm" appearance="ghost">Bold</odd-button
            ><odd-button size="sm" appearance="ghost">Italic</odd-button>
          </div>`,
        ),
      );
    },
  },
});
