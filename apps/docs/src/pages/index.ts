import { agents, browserSupport, frameworks } from './guides.js';
import { composition, formsAccessibility, layout, theming } from './guides-core.js';
import { overview } from './overview.js';
import { concepts, install } from './reference.js';
import { startApp, startAuthor, startComponents, startTokens, startWorkbench } from './start.js';
import type { Page } from './model.js';

export * from './model.js';

/** Authored pages, served as HTML before any script runs. */
export const pages: readonly Page[] = [
  overview,
  startTokens,
  startComponents,
  startAuthor,
  startApp,
  startWorkbench,
  install,
  concepts,
  theming,
  layout,
  formsAccessibility,
  composition,
  frameworks,
  agents,
  browserSupport,
];

/** Pages the client renders from published data (Workbench panels), linked from the same navigation. */
const rendered = {
  Guides: [{ label: 'Layout: side navigation', href: '/layout/side-nav' }],
  Reference: [
    { label: 'Components', href: '/components' },
    { label: 'Foundations', href: '/foundations' },
    { label: 'Scope ownership case study', href: '/architecture/scope-ownership' },
  ],
} as const;

/** The site navigation, in reading order. */
export function navigation(): { group: string; links: { label: string; href: string }[] }[] {
  return (['Start', 'Guides', 'Reference'] as const).map((group) => ({
    group,
    links: [
      ...pages
        .filter((page) => page.group === group)
        .map((page) => ({ label: page.label ?? page.title, href: `/${page.path}` })),
      ...(group === 'Start' ? [] : rendered[group]),
    ],
  }));
}

export const pageAt = (path: string): Page | undefined =>
  pages.find((page) => page.path === path.replace(/^\/+|\/+$/g, ''));
