import { foundationPages } from './foundations.js';

import { agents, browserSupport, frameworks } from './guides.js';
import { composition, formsAccessibility, layout, theming } from './guides-core.js';
import { gettingStarted, guides, recipes } from './landing.js';
import { groups, type Group, type Page } from './model.js';
import { overview } from './overview.js';
import { architecture, roadmap, support, supportPolicy } from './project.js';
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
  supportPolicy,
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
    {
      // Figma's Tools goes to /workbench; until that page exists, to the section's first page.
      label: 'Tools',
      path: ['workbench', 'tooling'].find((path) => routeExists(path)) ?? 'workbench',
      section: ['workbench', 'tooling', 'ai'],
    },
  ];

/** The entry whose children the sidebar shows at `pathname`: the page's parent, or the page. */
export function openEntry(links: readonly NavLink[], pathname: string): string | undefined {
  const here = `/${clean(pathname)}`;
  const active = links.find((link) => link.href === here || here.startsWith(`${link.href}/`));
  return active?.parent ?? active?.href;
}

/**
 * A header section's context sidebar (Figma "Docs / Learn sidebar" and its siblings): a heading,
 * the section's pages, and a note under a divider. Wide screens show it in place of the site map.
 */
export interface NavSection {
  id: string;
  label: string;
  /** The pages listed, in order, each with the sidebar's own label where it has one. */
  links: readonly { path: string; label?: string }[];
  /** Lines under the divider. */
  note: readonly string[];
}

export const sections: readonly NavSection[] = [
  {
    id: 'learn',
    label: 'Learn',
    links: [
      { path: 'getting-started' },
      { path: 'installation' },
      { path: 'core' },
      { path: 'guides', label: 'Guides' },
      { path: 'recipes' },
    ],
    note: ['Oddkin docs'],
  },
  {
    id: 'components',
    label: 'Components',
    // The catalog's components follow, from the reference index (`SiteFacts.catalog`).
    links: [{ path: 'components', label: 'Browse all' }],
    note: ['@oddkin/components'],
  },
  {
    id: 'foundations',
    label: 'Foundations',
    links: [
      { path: 'foundations', label: 'Overview' },
      ...foundationPages.filter((page) => page.parent === 'foundations'),
      { path: 'theme-studio' },
    ],
    note: ['@oddkin/tokens', 'Default theme baseline'],
  },
  {
    id: 'tools',
    label: 'Tools',
    links: [
      { path: 'theme-studio' },
      { path: 'workbench' },
      { path: 'tooling', label: 'Analyzer and agents' },
      { path: 'ai' },
    ],
    note: ['Explore the tools'],
  },
  {
    id: 'project',
    label: 'Project',
    links: [{ path: 'architecture' }, { path: 'roadmap' }, { path: 'support' }],
    note: ['Oddkin docs'],
  },
];

/** The section of the page at `pathname`: one that lists it, a page above it, or its parent. */
export function sectionOf(pathname: string): NavSection | undefined {
  const here = clean(pathname);
  const parent = entries().find((entry) => entry.path === here)?.parent;
  return sections.find((section) =>
    section.links.some(
      ({ path }) => path === here || here.startsWith(`${path}/`) || path === parent,
    ),
  );
}

/**
 * The links of `section` that exist (a page's own pages are linked from its content, as in the
 * design). A link with pages of its own in the list (Browse all, Overview) is current on its
 * page alone; the others also on the pages under them.
 */
export function sectionLinks(
  section: NavSection,
  catalog: readonly { href: string; label: string }[],
): (NavLink & { exact?: boolean })[] {
  const all = entries();
  const links: NavLink[] = section.links
    .filter((link) => routeExists(link.path))
    .map(({ path, label }) => ({
      label: label ?? all.find((entry) => entry.path === path)?.label ?? path,
      href: `/${path}`,
    }));
  if (section.id === 'components') links.push(...catalog);
  return links.map((link) =>
    links.some((other) => other.href.startsWith(`${link.href}/`)) ? { ...link, exact: true } : link,
  );
}

/** `aria-current` of a sidebar link to `href` at `pathname`: the page itself, a page above it, or neither. */
export function currentOf(
  href: string,
  pathname: string,
  exact = false,
): 'page' | 'true' | undefined {
  const target = clean(href);
  const here = clean(pathname);
  if (target === here) return 'page';
  return !exact && target && here.startsWith(`${target}/`) ? 'true' : undefined;
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
