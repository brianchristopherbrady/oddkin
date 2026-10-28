import { foundationPages } from './foundations.js';
import { agents, browserSupport, frameworks } from './guides.js';
import { composition, formsAccessibility, layout, theming } from './guides-core.js';
import { gettingStarted, guides, recipes } from './landing.js';
import { groups, type Group, type Page } from './model.js';
import { overview } from './overview.js';
import { architecture, roadmap, support } from './project.js';
import { concepts, install } from './reference.js';
import { startApp, startAuthor, startComponents, startTokens, startWorkbench } from './start.js';

/** Authored pages, served as HTML before any script runs. */
export const pages: readonly Page[] = [
  overview,
  gettingStarted,
  startTokens,
  startComponents,
  startAuthor,
  startApp,
  startWorkbench,
  install,
  frameworks,
  ...foundationPages,
  concepts,
  guides,
  theming,
  layout,
  formsAccessibility,
  composition,
  agents,
  recipes,
  architecture,
  roadmap,
  support,
  browserSupport,
];

/** A page the client renders from published data (the Workbench panels). */
export interface ClientPage {
  path: string;
  title: string;
  group: Group;
  parent?: string;
}

export const clientPages: readonly ClientPage[] = [
  { path: 'components', title: 'Components', group: 'Build' },
  { path: 'ai', title: 'AI interfaces', group: 'Build' },
  { path: 'layout/side-nav', title: 'Layout: side navigation', group: 'Build', parent: 'guides' },
  {
    path: 'architecture/scope-ownership',
    title: 'Case study: scope ownership',
    group: 'Project',
    parent: 'architecture',
  },
];

/** Sidebar order within each group (the website map); pages not named here follow in page order. */
const order: Record<Group, readonly string[]> = {
  'Start here': ['', 'getting-started', 'installation'],
  Build: ['components', 'foundations', 'core', 'guides', 'ai'],
  Explore: ['theme-studio', 'workbench', 'tooling', 'recipes'],
  Project: ['architecture', 'roadmap', 'support'],
};

export interface NavLink {
  label: string;
  href: string;
  /** Href of the entry this one is listed under. */
  parent?: string;
}

const entries = (): (ClientPage & { label: string })[] => [
  ...pages.map((page) => ({ ...page, label: page.label ?? page.title })),
  ...clientPages.map((page) => ({ ...page, label: page.title })),
];

const clean = (path: string): string => path.replace(/^\/+|\/+$/g, '');

/** Whether a site path (with or without slashes) is a page of this site. */
export function routeExists(path: string): boolean {
  const target = clean(path);
  return entries().some((entry) => entry.path === target);
}

/** The site navigation, in reading order: each group's entries, each followed by its children. */
export function navigation(): { group: Group; links: NavLink[] }[] {
  const all = entries();
  const exists = new Set(all.map((entry) => entry.path));
  const isChild = (entry: { parent?: string }) =>
    entry.parent !== undefined && exists.has(entry.parent);
  return groups.map((group) => {
    const rank = (path: string) => {
      const index = order[group].indexOf(path);
      return index === -1 ? order[group].length : index;
    };
    const top = all
      .filter((entry) => entry.group === group && !isChild(entry))
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => rank(a.entry.path) - rank(b.entry.path) || a.index - b.index)
      .map(({ entry }) => entry);
    return {
      group,
      links: top.flatMap((entry) => [
        { label: entry.label, href: `/${entry.path}` },
        ...all
          .filter((child) => child.parent === entry.path)
          .map((child) => ({
            label: child.label,
            href: `/${child.path}`,
            parent: `/${entry.path}`,
          })),
      ]),
    };
  });
}

/** The header's destinations, each with the paths of its section. */
export const primaryLinks: readonly { label: string; path: string; section: readonly string[] }[] =
  [
    {
      label: 'Learn',
      path: 'getting-started',
      section: ['getting-started', 'installation', 'core', 'guides', 'layout', 'recipes'],
    },
    { label: 'Components', path: 'components', section: ['components'] },
    { label: 'Foundations', path: 'foundations', section: ['foundations'] },
    { label: 'Theme Studio', path: 'theme-studio', section: ['theme-studio'] },
    { label: 'Tools', path: 'workbench', section: ['workbench', 'tooling'] },
  ];

/** `aria-current` of a sidebar link to `href` at `pathname`: the page itself, a page above it, or neither. */
export function currentOf(href: string, pathname: string): 'page' | 'true' | undefined {
  const target = clean(href);
  const here = clean(pathname);
  if (target === here) return 'page';
  return target && here.startsWith(`${target}/`) ? 'true' : undefined;
}

/** `aria-current` of a header destination at `pathname`: its page, or a page of its section. */
export function primaryCurrent(
  link: (typeof primaryLinks)[number],
  pathname: string,
): 'page' | 'true' | undefined {
  const here = clean(pathname);
  if (here === link.path) return 'page';
  return link.section.some((s) => here === s || here.startsWith(`${s}/`)) ? 'true' : undefined;
}

export const pageAt = (path: string): Page | undefined =>
  pages.find((page) => page.path === clean(path));
