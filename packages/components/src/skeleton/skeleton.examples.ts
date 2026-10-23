import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-skeleton> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './skeleton.js';

export default defineExamples('odd-skeleton', {
  default: {
    label: 'Text',
    previewRoles: ['placeholder'],
    props: { lines: 3 },
    recommended: true,
    preset: true,
    guidance: 'Mark the region that loads with `aria-busy="true"`; the placeholders are hidden.',
  },
  rect: { label: 'Rectangle', props: { shape: 'rect' } },
  circle: {
    label: 'Circle',
    props: { shape: 'circle' },
    guidance:
      'Compose shapes to match the layout that will load, such as a circle beside two lines.',
  },
  shapeSquare: {
    label: 'shape="square"',
    attributes: { shape: 'square' },
    incorrect: {
      explanation:
        '`shape` takes text, rect, or circle. "square" is reported and text lines are drawn; use rect and size it with CSS.',
      diagnostic: 'usage.attribute.value',
      correct: 'rect',
    },
  },
});
