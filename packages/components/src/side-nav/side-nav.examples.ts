import { defineExamples } from '@oddkin/workbench/examples';
import type { NavigationItem } from '../models/navigation.js';
import type {} from './side-nav.js';

const items: readonly NavigationItem[] = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '#overview' },
  { id: 'components', kind: 'link', label: 'Components', href: '#components', badge: '4' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [
      { id: 'theming', kind: 'link', label: 'Theming', href: '#theming' },
      { id: 'layout', kind: 'link', label: 'Layout', href: '#layout' },
    ],
  },
  { id: 'new-project', kind: 'action', label: 'New project', action: 'project.create' },
];

export default defineExamples('odd-side-nav', {
  default: {
    label: 'From data',
    props: { label: 'Primary', items, current: 'overview' },
    previewRoles: ['navigation'],
    preset: true,
    recommended: true,
    guidance: 'Assign a new `items` array to change entries; never mutate it.',
  },
  currentInGroup: {
    label: 'Current page in a group',
    props: { label: 'Primary', items, current: 'layout' },
    guidance: 'A group that contains the current page starts open.',
  },
  regions: {
    label: 'Header and footer',
    props: { label: 'Workspace', items, current: 'components' },
    slots: { header: 'Acme', footer: 'Signed in as Ada' },
    preset: true,
  },
  controlled: {
    label: 'Controlled expansion',
    props: { label: 'Primary', items, expanded: [] },
    guidance:
      'With `expanded` set, the element only reports `odd-toggle`; the page owns the state.',
    fixture({ scope, element }) {
      scope.listen<CustomEvent<{ id: string; expanded: boolean }>>(element, 'odd-toggle', (e) => {
        const others = (element.expanded ?? []).filter((id) => id !== e.detail.id);
        element.expanded = e.detail.expanded ? [...others, e.detail.id] : others;
      });
    },
  },
  declarative: {
    label: 'Slotted links',
    props: { label: 'Documentation' },
    guidance: 'Without `items`, native links in the default slot are styled as entries.',
    fixture({ element }) {
      for (const [href, text] of [
        ['#overview', 'Overview'],
        ['#components', 'Components'],
        ['#tokens', 'Tokens'],
      ] as const) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = text;
        element.append(link);
      }
      element.querySelector('a')!.setAttribute('aria-current', 'page');
    },
  },
  wide: {
    label: 'Wide container',
    props: { label: 'Site map', items },
    guidance: 'From 40rem of its own width the top-level entries form three columns.',
    fixture({ element }) {
      element.style.inlineSize = '48rem';
      element.style.maxInlineSize = '100%';
    },
  },
});
