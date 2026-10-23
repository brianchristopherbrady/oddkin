import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-breadcrumbs> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './breadcrumbs.js';

const items = [
  { label: 'Home', href: '#home' },
  { label: 'Workspace', href: '#workspace' },
  { label: 'Projects', href: '#projects' },
  { label: 'Components', href: '#components' },
  { label: 'Forms', href: '#forms' },
];

export default defineExamples('odd-breadcrumbs', {
  default: {
    label: 'Links as children',
    previewRoles: ['breadcrumbs'],
    props: {},
    recommended: true,
    preset: true,
    guidance:
      'Write the trail as an ordered list of links, as a server would; the last link is the current page and shows as text.',
    fixture({ element }) {
      element.innerHTML =
        '<ol><li><a href="#home">Home</a></li><li><a href="#workspace">Workspace</a></li><li><a href="#components">Components</a></li><li><a href="#forms">Forms</a></li></ol>';
    },
  },
  items: {
    label: 'Items property',
    props: { label: 'Location', items },
    guidance: 'Set `items` to `{ label, href }` records when the trail comes from data.',
  },
  collapsed: {
    label: 'Collapsed',
    props: { maxItems: 3, items },
    preset: true,
    guidance:
      'With `max-items`, a long trail keeps the first item and the last ones; "more" shows the rest.',
  },
  itemsAttribute: {
    label: 'Items written as an attribute',
    attributes: { items: JSON.stringify(items) },
    incorrect: {
      explanation:
        '`items` is rich data and is read only as a property; an attribute string is ignored and the trail is empty. Assign an array to `.items`, or write `<a href>` children.',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'items',
    },
  },
});
