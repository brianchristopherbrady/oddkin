import { renderHome } from './home.js';
import { icons } from './icons.js';
import { escapeHtml, renderPage, type FactBlocks } from './model.js';
import {
  currentOf,
  navigation,
  pageAt,
  primaryCurrent,
  primaryLinks,
  routeExists,
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
  return `<header class="site-header odd-row odd-row-between"><a class="brand" href="/"><span class="brand-name">oddkin</span><span class="brand-docs">/ docs</span></a><nav class="primary-nav odd-row" aria-label="Primary">${links}</nav><div class="header-tools odd-row"><a class="odd-button search-trigger" href="/search" aria-keyshortcuts="Control+K Meta+K">${icons.search}<span class="search-label">Search docs</span></a><span class="shortcut" aria-hidden="true">Ctrl K</span><button class="odd-button icon-button mode-toggle" type="button" data-appearance="ghost" aria-pressed="false" hidden>${icons.moon}${icons.sun}<span class="odd-visually-hidden">Dark mode</span></button><span class="version">v${escapeHtml(site.version)}</span><button class="odd-button icon-button menu-toggle" type="button" data-appearance="ghost" aria-expanded="false" aria-controls="docs-nav" hidden>${icons.menu}${icons.close}<span class="odd-visually-hidden">Menu</span></button></div></header>`;
}

function siteSidebar(pathname: string, site: SiteFacts): string {
  const here = `/${clean(pathname)}`;
  const groups = navigation();
  const all = groups.flatMap((group) => group.links);
  const active = all.find((link) => link.href === here || here.startsWith(`${link.href}/`));
  const open = active?.parent ?? active?.href;
  const entries = groups
    .map(({ group, links }) => {
      const shown = links.filter((link) => !link.parent || link.parent === open);
      if (!shown.length) return '';
      return `<p class="nav-group">${escapeHtml(group)}</p>${shown
        .map(
          (link) =>
            `<a${link.parent ? ' class="nav-child"' : ''} href="${escapeHtml(link.href)}"${current(currentOf(link.href, here))}>${escapeHtml(link.label)}</a>`,
        )
        .join('')}`;
    })
    .join('');
  return `<odd-side-nav id="docs-nav" class="side-nav" label="Documentation">${entries}<p slot="footer" class="nav-footer">Built with Oddkin ${escapeHtml(site.version)}</p></odd-side-nav>`;
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
