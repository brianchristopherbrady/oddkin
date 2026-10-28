import type { SiteFacts } from './document.js';
import { icons } from './icons.js';
import { codeSample, escapeHtml, resourceCard, type Page } from './model.js';
import { routeExists } from './site.js';
import { startApp, startAuthor, startComponents, startTokens, startWorkbench } from './start.js';

/**
 * The home page (Figma "01 · Home"): the hero with live component examples, the five starting
 * points, the reference sections, the tools, and a quick start. The example content is each
 * component's own documented example; every other word comes from the pages, manifests, and
 * compatibility registry.
 */

const firstSentence = (text: string): string => text.replace(/([.!?])\s.*$/s, '$1');
const link = (href: string, label: string): string =>
  `<a class="odd-link" href="${escapeHtml(href)}">${escapeHtml(label)}${icons.arrowRight}</a>`;
/** The first destination that exists, so a section never links to a page that is not built yet. */
const pick = <T extends { path: string }>(...choices: T[]): T =>
  choices.find((choice) => routeExists(choice.path)) ?? choices.at(-1)!;

function hero(site: SiteFacts, page: Page): string {
  const [headline = page.summary, ...rest] = page.summary.split(/(?<=\.)\s+/);
  return `<section class="home-hero" aria-labelledby="home-title"><div class="hero-split odd-split"><div class="hero-copy odd-stack odd-stack-loose"><p class="eyebrow">Oddkin ${escapeHtml(site.version)}</p><h1 id="home-title" class="hero-title">${escapeHtml(headline)}</h1><p class="hero-lede">${escapeHtml(rest.join(' '))}</p><div class="hero-actions odd-cluster"><a class="odd-button" data-appearance="primary" href="/getting-started">Get started</a><a class="odd-button" href="/components">Browse components</a></div><p class="hero-note odd-type-small">Supported browsers: ${escapeHtml(site.browsers)}, and later.</p></div>${specimen()}</div></section>`;
}

const swatches: readonly [string, string][] = [
  ['action', 'color.action.default'],
  ['text', 'color.text.primary'],
  ['surface', 'color.surface.raised'],
  ['success', 'color.success.foreground'],
  ['warning', 'color.warning.foreground'],
];

function specimen(): string {
  return `<div class="specimen odd-stack odd-stack-loose" role="group" aria-labelledby="specimen-title"><div class="specimen-header odd-row odd-row-between"><p class="eyebrow" id="specimen-title">Component examples</p><odd-badge>Default theme</odd-badge></div><div class="specimen-components odd-auto-grid"><odd-card class="resource-card"><p slot="header" class="odd-type-title">Weekly report</p><p>Revenue grew 12% since last week.</p><div slot="footer" class="card-footer odd-stack"><p class="card-meta odd-type-ui">odd-card</p><odd-button>Open report</odd-button></div></odd-card><div class="specimen-controls odd-stack odd-stack-loose"><odd-input label="Full name" autocomplete="name"></odd-input><odd-switch checked>Notifications</odd-switch><div class="odd-cluster"><odd-badge tone="success">Published</odd-badge><odd-badge>Draft</odd-badge></div><div class="odd-cluster"><odd-button>Cancel</odd-button><odd-button appearance="primary">Continue</odd-button></div></div></div><ul class="token-palette odd-auto-grid" role="list" aria-label="Colour roles">${swatches
    .map(
      ([name, role]) =>
        `<li><span class="swatch swatch-${name}"></span><code>${role
          .split('.')
          .map(escapeHtml)
          .join('.<wbr>')}</code></li>`,
    )
    .join('')}</ul></div>`;
}

function paths(): string {
  const items = [startTokens, startComponents, startAuthor, startApp, startWorkbench]
    .map(
      (page, index) =>
        `<li><a class="path" href="/${escapeHtml(page.path)}"><span class="path-number" aria-hidden="true">0${index + 1}</span><span class="path-title">${escapeHtml(page.title)}</span><span class="path-text">${escapeHtml(firstSentence(page.summary))}</span></a></li>`,
    )
    .join('');
  return `<section class="home-section" aria-labelledby="paths-title"><h2 class="eyebrow" id="paths-title">Five starting points</h2><ol class="path-list odd-auto-grid odd-auto-grid-fit" role="list">${items}</ol></section>`;
}

function heading(id: string, eyebrow: string, title: string, lede: string): string {
  return `<div class="section-heading"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2 id="${id}">${escapeHtml(title)}</h2><p class="lede">${escapeHtml(lede)}</p></div>`;
}

function explore(site: SiteFacts): string {
  const third = pick(
    {
      path: 'ai',
      title: 'AI interfaces',
      text: site.packages['@oddkin/ai'],
      meta: '@oddkin/ai',
      action: 'Explore AI interfaces',
    },
    {
      path: 'core',
      title: 'Core and state',
      text: site.packages['@oddkin/core'],
      meta: '@oddkin/core',
      action: 'Read about core',
    },
  );
  const cards = [
    {
      path: 'components',
      title: 'Components',
      text: site.packages['@oddkin/components'],
      meta: `${site.components} elements`,
      action: 'Browse components',
    },
    {
      path: 'foundations',
      title: 'Foundations',
      text: site.packages['@oddkin/tokens'],
      meta: '@oddkin/tokens',
      action: 'Browse foundations',
    },
    third,
  ];
  return `<section class="home-section" aria-labelledby="explore-title">${heading(
    'explore-title',
    'Reference',
    'Explore the framework',
    'Each package depends only on the ones it needs. Tokens work without JavaScript; components work in any framework or none; state, app services, and the tooling are optional.',
  )}<ul class="card-list odd-auto-grid odd-auto-grid-fit" role="list">${cards
    .map((card) => resourceCard({ ...card, text: card.text ?? '', href: `/${card.path}` }))
    .join('')}</ul></section>`;
}

function tools(site: SiteFacts): string {
  const studio = pick(
    { path: 'theme-studio', label: 'Open Theme Studio' },
    { path: 'guides/theming', label: 'Read the theming guide' },
  );
  const workbench = pick(
    { path: 'workbench', label: 'Explore Workbench' },
    { path: startWorkbench.path, label: 'Document your library with Workbench' },
  );
  return `<section class="home-section" aria-labelledby="tools-title">${heading(
    'tools-title',
    'Tools',
    'Tools for your system',
    "Component documentation generated from a library's metadata, served locally, with interactive pages and Theme Studio.",
  )}<div class="tool-list odd-auto-grid odd-auto-grid-fit"><div class="tool-panel"><h3>Theme Studio</h3><p>Light and dark come from one theme: each mode is a scope, <code>data-odd-mode</code>, over the same components.</p><div class="theme-scopes odd-auto-grid"><div class="theme-scope" data-odd-mode="light"><odd-button appearance="primary">Light mode</odd-button></div><div class="theme-scope" data-odd-mode="dark"><odd-button appearance="primary">Dark mode</odd-button></div></div>${link(
    `/${studio.path}`,
    studio.label,
  )}</div><div class="tool-panel"><h3>Workbench</h3><p>${escapeHtml(startWorkbench.summary)}</p><div class="tool-preview odd-cluster"><code>odd-button</code><odd-badge tone="info">Preview and API</odd-badge></div><div class="odd-cluster"><odd-button>Save</odd-button><odd-button appearance="primary">Continue</odd-button></div>${link(
    `/${workbench.path}`,
    workbench.label,
  )}</div></div></section>`;
}

function quickStart(page: Page): string {
  const samples = page.sections
    .find((section) => section.id === 'quick-start')
    ?.blocks.flatMap((block, index) =>
      'code' in block ? [codeSample(block.code, `home-code-${index + 1}`)] : [],
    )
    .join('');
  return `<section class="home-section home-quick-start odd-split" aria-labelledby="quick-start-title"><div class="quick-start-text">${heading(
    'quick-start-title',
    'Quick start',
    'Start with one element',
    startComponents.summary,
  )}${link('/getting-started', 'Choose your starting point')}</div><div class="quick-start-code">${samples ?? ''}</div></section>`;
}

/** The home page's `<main>` content. */
export function renderHome(page: Page, site: SiteFacts): string {
  return [hero(site, page), paths(), explore(site), tools(site), quickStart(page)].join('');
}
