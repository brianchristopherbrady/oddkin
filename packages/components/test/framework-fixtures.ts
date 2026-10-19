import { flush } from '@oddkin/core/reactive';
import type { NavigationItem } from '../src/models/navigation.js';
import type { OddkinSideNav } from '../src/side-nav/side-nav.js';

// Shared by the framework fixtures: the same navigation, reordered, and the settled element.

export const ITEMS: readonly NavigationItem[] = [
  { id: 'overview', kind: 'link', label: 'Overview', href: '#overview' },
  {
    id: 'guides',
    kind: 'group',
    label: 'Guides',
    items: [{ id: 'theming', kind: 'link', label: 'Theming', href: '#theming' }],
  },
  { id: 'create', kind: 'action', label: 'Create project', action: 'project.create' },
];
export const REORDERED: readonly NavigationItem[] = [ITEMS[2]!, ITEMS[0]!, ITEMS[1]!];

const frames = (n = 2) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(n);
  });

export async function sideNav(container: Element): Promise<OddkinSideNav> {
  await frames();
  flush();
  const el = container.querySelector('odd-side-nav')!;
  await el.updateComplete;
  flush();
  return el;
}

export const toggle = (el: Element) =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="group-toggle"]')!;
export const action = (el: Element) =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="action"]')!;
