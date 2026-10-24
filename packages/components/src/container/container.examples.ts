import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-container> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './container.js';

const article = () =>
  html`<div>
    <h3>Release notes</h3>
    <p>
      Components, tokens, and layout classes were updated. Long lines are hard to read, so the
      container keeps this text to a comfortable measure on wide screens.
    </p>
  </div>`;

/** Moves the mounted content into the example's element. */
const adopt = (element: Element, host: Element) => {
  element.append(...host.children);
  host.remove();
};

export default defineExamples('odd-container', {
  default: {
    label: 'Constrained',
    previewRoles: ['container'],
    recommended: true,
    preset: true,
    guidance:
      'Centres the content at the theme’s `layout.measure`; children respond to its width with container queries. Add insets with `.odd-box`.',
    fixture({ element, mount }) {
      adopt(element, mount(article()));
    },
  },
  fluid: {
    label: 'Fluid',
    props: { measure: 'fluid' },
    preset: true,
    guidance: 'Fills the available width and is still a query container for its children.',
    fixture({ element, mount }) {
      adopt(element, mount(article()));
    },
  },
  measureWide: {
    label: 'measure="wide"',
    attributes: { measure: 'wide' },
    incorrect: {
      explanation:
        '`measure` accepts constrained or fluid. "wide" is reported and the container stays constrained; set `--odd-container-measure` for another maximum.',
      diagnostic: 'usage.attribute.value',
      correct: 'fluid',
    },
    fixture({ element, mount }) {
      adopt(element, mount(article()));
    },
  },
});
