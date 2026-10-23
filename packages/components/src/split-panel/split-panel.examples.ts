import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-split-panel> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './split-panel.js';

/** Moves the mounted panes into the example's element. */
const adopt = (element: Element, host: Element) => {
  element.append(...host.children);
  host.remove();
};

const panes = (start: string, end: string) =>
  html`<div>
    <section slot="start">
      <h3>${start}</h3>
      <ul>
        <li>Overview</li>
        <li>Components</li>
        <li>Design tokens</li>
      </ul>
    </section>
    <section slot="end">
      <h3>${end}</h3>
      <p>Buttons, forms, and navigation are ready to review.</p>
    </section>
  </div>`;

export default defineExamples('odd-split-panel', {
  default: {
    label: 'Side by side',
    previewRoles: ['splitPanel'],
    props: { label: 'Resize project files', position: 30, min: 15, max: 70 },
    recommended: true,
    preset: true,
    guidance:
      'Name the separator after what it resizes. Give the panes headings, and keep a minimum so neither pane becomes too narrow to use.',
    fixture({ element, mount }) {
      adopt(element, mount(panes('Project files', 'Design system')));
    },
  },
  stacked: {
    label: 'Stacked',
    props: { label: 'Resize preview', orientation: 'vertical', position: 60 },
    preset: true,
    guidance: 'Stacked panes share the element’s height: give the element a height.',
    fixture({ element, mount }) {
      (element as HTMLElement).style.blockSize = '18rem';
      adopt(element, mount(panes('Code', 'Preview')));
    },
  },
  collapsed: {
    label: 'Collapsed start pane',
    props: { label: 'Resize project files', position: 30, collapsed: true },
    guidance:
      'Enter on the separator restores the pane to its last position; a visible control that toggles `collapsed` helps pointer users.',
    fixture({ element, mount }) {
      adopt(element, mount(panes('Project files', 'Design system')));
    },
  },
  orientationColumn: {
    label: 'orientation="column"',
    attributes: { orientation: 'column', label: 'Resize preview' },
    incorrect: {
      explanation:
        '`orientation` accepts horizontal (side by side) or vertical (stacked). "column" is reported and the panes stay side by side.',
      diagnostic: 'usage.attribute.value',
      correct: 'stacked',
    },
    fixture({ element, mount }) {
      adopt(element, mount(panes('Code', 'Preview')));
    },
  },
});
