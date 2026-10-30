import { html, render } from '@oddkin/core/template';
import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-tree> into HTMLElementTagNameMap, so props are checked against the element.
import type { TreeItemRecord } from './tree.js';

const items: readonly TreeItemRecord[] = [
  {
    id: 'components',
    label: 'Components',
    children: [
      {
        id: 'forms',
        label: 'Forms',
        children: [
          { id: 'text-field', label: 'Text field' },
          { id: 'combobox', label: 'Combobox' },
        ],
      },
      {
        id: 'navigation',
        label: 'Navigation',
        children: [
          { id: 'tabs', label: 'Tabs' },
          { id: 'breadcrumbs', label: 'Breadcrumbs' },
        ],
      },
    ],
  },
  {
    id: 'foundations',
    label: 'Foundations',
    children: [
      { id: 'color', label: 'Color' },
      { id: 'typography', label: 'Typography' },
    ],
  },
];

export default defineExamples('odd-tree', {
  default: {
    label: 'Selected item',
    previewRoles: ['tree'],
    props: { label: 'Project files', items, value: 'text-field' },
    recommended: true,
    preset: true,
    guidance:
      'Items holding the selected item start expanded. Assign a new `items` array to change items; never mutate it.',
  },
  collapsed: {
    label: 'Collapsed',
    props: { label: 'Project files', items },
    preset: true,
  },
  multiple: {
    label: 'Several selected',
    props: { label: 'Project files', items, multiple: true, values: ['tabs', 'color'] },
    guidance: 'With `multiple`, Space and a click toggle an item; read `values`.',
  },
  lazy: {
    label: 'Children loaded on expand',
    props: {
      label: 'Workspace',
      items: [
        { id: 'projects', label: 'Projects', lazy: true },
        { id: 'archive', label: 'Archive', lazy: true },
      ],
    },
    guidance:
      'Mark an item `lazy` and load its children on `odd-toggle`; the row is busy until new `items` give it `children`.',
    fixture({ scope, element }) {
      scope.listen<CustomEvent<{ id: string; expanded: boolean }>>(element, 'odd-toggle', (e) => {
        const { id, expanded } = e.detail;
        const item = element.items?.find((each) => each.id === id);
        if (!expanded || !item || item.children) return;
        scope.timeout(() => {
          element.items = element.items!.map((each) =>
            each.id === id
              ? {
                  ...each,
                  children: [
                    { id: `${id}-1`, label: `${each.label} 1` },
                    { id: `${id}-2`, label: `${each.label} 2` },
                  ],
                }
              : each,
          );
        }, 600);
      });
    },
  },
  loading: {
    label: 'Loading',
    props: { label: 'Project files', loading: true },
    preset: true,
  },
  empty: {
    label: 'Empty',
    props: { label: 'Project files', items: [] },
    preset: true,
    guidance: 'Put your own text in the `empty` slot to say what will appear and how to add it.',
  },
  error: {
    label: 'Error with retry',
    props: { label: 'Project files', items: [] },
    guidance:
      'Show a failure in the `status` slot with a way to try again, and replace the empty text.',
    fixture({ element }) {
      render(
        html`<span slot="empty"></span>
          <div slot="status" role="alert">
            <p>Unable to load. Try again to reload these items.</p>
            <button type="button">Retry</button>
          </div>`,
        element,
      );
    },
  },
  itemsAttribute: {
    label: 'Items written as an attribute',
    attributes: { label: 'Project files', items: JSON.stringify(items) },
    incorrect: {
      explanation:
        '`items` is rich data and is read only as a property; an attribute string is ignored and the tree shows its empty state. Assign an array to `.items` (a property binding in templates and frameworks).',
      diagnostic: 'usage.attribute.propertyOnly',
      correct: 'default',
    },
  },
});
