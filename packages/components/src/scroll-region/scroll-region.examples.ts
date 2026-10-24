import { html } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-scroll-region> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './scroll-region.js';

const entries = (count: number) =>
  html`<div>
    ${Array.from({ length: count }, (_, i) => html`<p>Release note ${i + 1}: components and tokens updated.</p>`)}
  </div>`;

/** Moves the mounted content into the example's element and bounds its height. */
const fill = (element: Element, host: Element, blockSize: string | null = '12rem') => {
  if (blockSize) (element as HTMLElement).style.maxBlockSize = blockSize;
  element.append(...host.children);
  host.remove();
};

export default defineExamples('odd-scroll-region', {
  default: {
    label: 'Bounded list',
    previewRoles: ['scrollRegion'],
    props: { label: 'Release notes' },
    recommended: true,
    preset: true,
    guidance:
      'Bound the element with `max-block-size` (or `block-size`) and name it after its content: while it overflows, keyboard users reach it with Tab and scroll it with the arrow keys.',
    fixture({ element, mount }) {
      fill(element, mount(entries(12)));
    },
  },
  fits: {
    label: 'Content that fits',
    props: { label: 'Release notes' },
    guidance: 'When the content fits, the element is neither focusable nor a region.',
    fixture({ element, mount }) {
      fill(element, mount(entries(2)));
    },
  },
  heightAttribute: {
    label: 'height="200"',
    attributes: { height: '200', label: 'Release notes' },
    incorrect: {
      explanation:
        'There is no `height` attribute: bound the element with CSS `max-block-size` or `block-size`. Without a bound the content never overflows, so nothing scrolls.',
      diagnostic: 'usage.attribute.unknown',
      correct: 'default',
    },
    fixture({ element, mount }) {
      fill(element, mount(entries(12)), null);
    },
  },
});
