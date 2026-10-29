import { renderHome } from './home.js';
import { icons } from './icons.js';
import { escapeHtml, renderPage, type FactBlocks } from './model.js';
import {
  currentOf,
  navigation,
  openEntry,
  pageAt,
  primaryCurrent,
  primaryLinks,
  routeExists,
  sectionLinks,
  sectionOf,
  sections,
  type NavLink,
} from './site.js';

/** Facts about the release for the shell, from the package manifests and the README. */
export interface SiteFacts {
  version: string;
  license: string;
  /** The source repository's web address. */
  repository: string;
  /** What Oddkin is: the README's first sentence. */
  description: string;
  /** The oldest supported desktop browsers, from the compatibility registry. */
  browsers: string;
  /** How many elements `@oddkin/components` publishes. */
  components: number;
  /** Each package's description, by package name, from its manifest. */
  packages: Readonly<Record<string, string>>;
  /** The catalog's reference pages, by title, for the Components sidebar. */
  catalog: readonly { href: string; label: string }[];
}

const clean = (path: string): string => path.replace(/^\/+|\/+$/g, '');
const current = (value: string | undefined): string => (value ? ` aria-current="${value}"` : '');

function siteHeader(pathname: string, site: SiteFacts): string {
  const links = primaryLinks
    .filter((link) => routeExists(link.path))
    .map(
      (link) =>
        `<a href="/${link.path}"${current(primaryCurrent(link, pathname))}>${escapeHtml(link.label)}</a>`,
    )
    .join('');
  return `<header class="site-header odd-row odd-row-between"><a class="brand odd-row" href="/"><span class="brand-name">oddkin</span><span class="brand-docs odd-type-ui">/ docs</span></a><nav class="primary-nav odd-row" aria-label="Primary">${links}</nav><div class="search-group odd-row"><a class="odd-button search-trigger" href="/search" aria-keyshortcuts="Control+K Meta+K"><span class="search-label">Search docs</span>${icons.search}</a><span class="shortcut odd-type-small" aria-hidden="true">Ctrl K</span></div><button class="odd-button icon-button mode-toggle" type="button" data-appearance="ghost" aria-pressed="false" hidden>${icons.moon}${icons.sun}<span class="odd-visually-hidden">Dark mode</span></button><span class="version odd-type-small">v${escapeHtml(site.version)}</span><button class="odd-button icon-button menu-toggle" type="button" data-appearance="ghost" aria-expanded="false" aria-controls="docs-nav" hidden>${icons.menu}${icons.close}<span class="odd-visually-hidden">Menu</span></button></header>`;
}

/**
 * One sidebar with the site map (the narrow-screen menu, and pages outside a section), which
 * shows a page's children while it is open, and every section's own links (wide screens), the
 * current section's shown. The shell keeps the marks, the open entry, and the shown section up
 * to date as the client changes route, so a route in another section needs no new document.
 */
function siteSidebar(pathname: string, site: SiteFacts): string {
  const here = `/${clean(pathname)}`;
  const groups = navigation();
  const open = openEntry(
    groups.flatMap((group) => group.links),
    here,
  );
  const link = (set: string, entry: NavLink & { exact?: boolean }, extra = '') => {
    const classes = entry.parent ? `${set} nav-child` : set;
    const parent = entry.parent
      ? ` data-parent="${escapeHtml(entry.parent)}"${entry.parent === open ? '' : ' hidden'}`
      : '';
    const exact = entry.exact ? ' data-exact' : '';
    return `<a class="${classes}" href="${escapeHtml(entry.href)}"${parent}${exact}${extra}${current(currentOf(entry.href, here, entry.exact))}>${escapeHtml(entry.label)}</a>`;
  };
  const map = groups
    .map(
      ({ group, links }) =>
        `<p class="nav-group nav-global">${escapeHtml(group)}</p>${links.map((entry) => link('nav-global', entry)).join('')}`,
    )
    .join('');
  const shown = sectionOf(pathname);
  const note = (lines: readonly string[]) => lines.map((line) => `<p>${escapeHtml(line)}</p>`);
  const local = sections
    .map((section) => {
      const of = ` data-section="${section.id}"${section === shown ? '' : ' hidden'}`;
      return [
        `<p slot="header" class="nav-heading nav-section"${of}>${escapeHtml(section.label)}</p>`,
        ...sectionLinks(section, site.catalog).map((entry) => link('nav-section', entry, of)),
        `<div slot="footer" class="nav-footer nav-section odd-stack"${of}>${note(section.note).join('')}</div>`,
      ].join('');
    })
    .join('');
  const id = shown ? ` data-section="${shown.id}"` : '';
  // The site map comes first, so its first group heading is the element's first child.
  return `<odd-side-nav id="docs-nav" class="side-nav"${id} label="Documentation">${map}<div slot="footer" class="nav-footer nav-global odd-stack">${note([`Built with Oddkin ${site.version}`]).join('')}</div>${local}</odd-side-nav>`;
}

const footerColumns: readonly [string, readonly [string, string][]][] = [
  [
    'Build',
    [
      ['Getting started', 'getting-started'],
      ['Installation', 'installation'],
      ['Components', 'components'],
      ['Foundations', 'foundations'],
    ],
  ],
  [
    'Explore',
    [
      ['Theme Studio', 'theme-studio'],
      ['Workbench', 'workbench'],
      ['AI interfaces', 'ai'],
      ['Agent tooling', 'tooling'],
    ],
  ],
  [
    'Project',
    [
      ['Architecture', 'architecture'],
      ['Roadmap', 'roadmap'],
      ['Help and releases', 'support'],
      ['Browser support', 'support/browsers'],
    ],
  ],
];

function siteFooter(site: SiteFacts): string {
  const columns = footerColumns
    .map(([title, links]) => {
      const items = links
        .filter(([, path]) => routeExists(path))
        .map(([label, path]) => `<li><a href="/${path}">${escapeHtml(label)}</a></li>`);
      if (title === 'Project')
        items.push(
          `<li><a href="${escapeHtml(site.repository)}/blob/main/CONTRIBUTING.md">Contributing</a></li>`,
        );
      return items.length
        ? `<div class="footer-column"><h2 class="footer-heading">${escapeHtml(title)}</h2><ul class="odd-stack" role="list">${items.join('')}</ul></div>`
        : '';
    })
    .join('');
  return `<footer class="site-footer"><div class="footer-columns odd-cluster"><div class="footer-brand"><p class="brand-name">oddkin</p><p>${escapeHtml(site.description)}</p></div><nav class="footer-nav odd-cluster" aria-label="Footer">${columns}</nav></div><div class="footer-meta odd-cluster"><p>Oddkin ${escapeHtml(site.version)}</p><a href="${escapeHtml(site.repository)}">Source on GitHub${icons.external}</a><a href="${escapeHtml(site.repository)}/blob/main/LICENSE">${escapeHtml(site.license)} license</a></div></footer>`;
}

/**
 * The docs shell for `pathname`, filled in: the header, the sidebar with the current page marked,
 * the footer, and an authored page in full or a placeholder the client replaces.
 */
export function renderDocument(
  template: string,
  pathname: string,
  facts: FactBlocks,
  site: SiteFacts,
): string {
  const page = pageAt(pathname);
  const home = page?.path === '';
  const main = page
    ? home
      ? renderHome(page, site)
      : renderPage(page, facts)
    : '<header class="page-header"><p class="eyebrow">Documentation</p><h1>Loading</h1><p class="lede">This page is built in the browser from the published metadata.</p></header>';
  const title = page && page.path ? `${page.title} · Oddkin` : 'Oddkin';
  return template
    .replace('<!-- docs:title -->', escapeHtml(title))
    .replace('<!-- docs:description -->', escapeHtml(page?.summary ?? site.description))
    .replace('<!-- docs:header -->', siteHeader(pathname, site))
    .replace('<!-- docs:nav -->', siteSidebar(pathname, site))
    .replace('<!-- docs:footer -->', siteFooter(site))
    .replace(
      '<div class="site-layout odd-split">',
      home
        ? '<div class="site-layout odd-split" data-home>'
        : '<div class="site-layout odd-split">',
    )
    .replace(
      '<main id="main" tabindex="-1"><!-- docs:main -->',
      page
        ? `<main id="main" tabindex="-1" data-page="${escapeHtml(page.path)}">${main}`
        : `<main id="main" tabindex="-1" aria-busy="true">${main}`,
    );
}
