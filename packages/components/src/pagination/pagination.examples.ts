import { defineExamples } from '@oddkin/workbench/examples';
// Brings <odd-pagination> into HTMLElementTagNameMap, so props are checked against the element.
import type {} from './pagination.js';

export default defineExamples('odd-pagination', {
  default: {
    label: 'Buttons',
    previewRoles: ['pagination'],
    props: { label: 'Search results', current: '3', pageCount: 12 },
    recommended: true,
    preset: true,
    guidance:
      'Without `href`, pages are buttons: listen for `odd-action` (`detail.action` is "page", `detail.id` the page), load the page, then set `current`.',
    fixture({ element, scope }) {
      scope.listen<CustomEvent<{ id: string; action: string }>>(element, 'odd-action', (e) => {
        if (e.detail.action === 'page') element.current = e.detail.id;
      });
    },
  },
  links: {
    label: 'Links',
    props: { label: 'Articles', current: '1', pageCount: 12, href: '#page-{page}' },
    preset: true,
    guidance:
      'With `href`, pages are links (`{page}` is replaced), so they work without script and open in a new tab.',
  },
  lastPage: {
    label: 'Last page',
    props: { label: 'Search results', current: '12', pageCount: 12 },
  },
  fewPages: {
    label: 'Few pages',
    props: { label: 'Search results', current: '2', pageCount: 4 },
  },
  currentPageAttribute: {
    label: '"current-page" instead of "current"',
    attributes: { 'current-page': '3', 'page-count': '12', label: 'Search results' },
    incorrect: {
      explanation:
        '`odd-pagination` takes the page as `current`; an unknown attribute is ignored, so the first page shows as current.',
      diagnostic: 'usage.attribute.unknown',
      correct: 'default',
    },
  },
});
