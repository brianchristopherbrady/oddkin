/**
 * Authored documentation pages as plain data: rendered to HTML by the docs server, so each page is
 * readable before JavaScript runs, and by nothing else. Facts (package versions, the browser floor,
 * component counts) are named here and filled in from the published files when the page is served.
 */

import { icons } from './icons.js';

/** What a token preview draws: the shell sets the matching CSS property to `var(<token>)`. */
export type Preview = 'color' | 'shadow' | 'radius' | 'space' | 'font-size';
export type Mode = 'light' | 'dark';
/** The text roles of `@oddkin/components/css/typography.css` (`odd-type-<role>`). */
export type TextRole =
  'display' | 'section' | 'title' | 'body' | 'ui' | 'small' | 'eyebrow' | 'code';

/** Inline content: text, code, a link, emphasis, or a token drawn with its own value. */
export type Inline =
  | string
  | { code: string }
  | { link: string; href: string }
  | { strong: string }
  /** A token's value drawn by the shell (swatch, shadow, corner, bar, size), in a mode when named. */
  | { preview: Preview; token: string; mode?: Mode; text?: string }
  /** Text set in one of the text roles. */
  | { sample: string; role: TextRole }
  /** A duration drawn as a bar on a scale shared by its table. */
  | { meter: number; max: number; label: string };

/** Architecture documents and examples are linked in the source repository. */
export const repository = 'https://github.com/brianchristopherbrady/oddkin/blob/main/';

/** A code sample; `verify` names how `snippets/verify.mjs` checks it against packed packages. */
export interface CodeBlock {
  code: string;
  lang: 'html' | 'js' | 'ts' | 'css' | 'sh' | 'json';
  caption?: string;
  verify?: 'module' | 'markup' | 'css' | 'none';
  /** File name in the verifying consumer, so one sample can import another. */
  file?: string;
}

/**
 * The sections of docs/support.md, in its order: each id is the heading's anchor there, and each is
 * a fact the server renders from that file, so the page and the policy say the same thing.
 */
export const supportSections = [
  ['browsers', 'Browsers'],
  ['accessibility', 'Accessibility'],
  ['nodejs', 'Node.js'],
  ['typescript', 'TypeScript'],
  ['frameworks', 'Frameworks'],
  ['package-managers-and-bundlers', 'Package managers and bundlers'],
  ['copies-and-versions-on-one-page', 'Copies and versions on one page'],
  ['fixes', 'Fixes'],
] as const;
export type SupportSection = (typeof supportSections)[number][0];

/** Facts generated from the published metadata, manifests, tokens, and compatibility data. */
export type Fact =
  | 'packages'
  | 'browser-floor'
  | 'browser-features'
  | 'component-counts'
  | 'framework-versions'
  | 'decisions'
  | 'milestones'
  | 'examples'
  | 'support-intro'
  | `support-${SupportSection}`
  | 'token-categories'
  | 'token-pipeline'
  | 'token-trace'
  | 'palette'
  | 'color-roles'
  | 'action-roles'
  | 'tone-roles'
  | 'contrast-pairs'
  | 'font-families'
  | 'type-scale'
  | 'text-styles'
  | 'space-scale'
  | 'layout-vocabulary'
  | 'border-widths'
  | 'border-roles'
  | 'radii'
  | 'radius-mappings'
  | 'elevation-levels'
  | 'motion-durations'
  | 'motion-easings'
  | 'theme-baseline'
  | 'scope-attributes'
  | 'scope-composition'
  | 'conditions'
  | 'layout-roles'
  | 'profiles'
  | 'layout-concerns';

/** Another page summarized as a card: what it covers, the package it is about, and a link to it. */
export interface Card {
  title: string;
  text: string;
  href: string;
  /** The link's text; it names the destination, as several cards share a page. */
  action: string;
  meta?: string;
}

export type Block =
  | { p: Inline[] }
  | { list: Inline[][]; ordered?: true }
  | { code: CodeBlock }
  | { table: { caption: string; head: string[]; rows: Inline[][][] } }
  | { fact: Fact }
  | { note: Inline[] }
  | { cards: Card[] }
  /** A reference colour ramp: each step's swatch, label, and value. */
  | { ramp: { title: string; steps: { label: string; value: string; token: string }[] } }
  /** The same specimen in each mode's scope, side by side. */
  | { modes: { caption: string; modes: Mode[]; specimen: Specimen } }
  /** One alert per tone, as `odd-alert` draws it. */
  | { tones: { tone: string; label: string; token: string }[] }
  /** The same items in a container as wide as each named layout token. */
  | { reflow: { items: string[]; widths: { token: string; caption: string }[] } };

/** What a mode specimen shows. */
export type Specimen =
  /** A primary `odd-button` with this label. */
  | { action: string }
  /** A surface per elevation token. */
  | { elevation: string[] }
  /** A swatch per colour token, with its name. */
  | { roles: string[] };

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

/** Sidebar groups, in order. */
export const groups = ['Start here', 'Build', 'Explore', 'Project'] as const;
export type Group = (typeof groups)[number];

export interface Page {
  /** Route path without a leading slash; '' is the home page. */
  path: string;
  /** Navigation group. */
  group: Group;
  /** Path of the page this one belongs to; the sidebar lists it below that page. */
  parent?: string;
  eyebrow: string;
  title: string;
  /** Navigation label, when shorter than the title. */
  label?: string;
  summary: string;
  /** Paragraphs under the summary, before the sections. */
  intro?: Block[];
  sections: Section[];
  /** The page to read next, linked after the last section. */
  next?: { label: string; href: string };
}

/** A fact rendered as blocks; the server supplies them. */
export type FactBlocks = Readonly<Record<Fact, readonly Block[]>>;

const escapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => escapes[c]!);

/** A token drawn with its own value; the shell sets the property, so the page needs no inline style. */
const preview = (kind: Preview, token: string, content = ''): string =>
  `<span class="token-preview token-preview-${kind}" data-preview="${kind}" data-token="${escapeHtml(
    token,
  )}" aria-hidden="true">${content}</span>`;

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function specimen(content: Specimen): string {
  if ('action' in content)
    return `<odd-button appearance="primary">${escapeHtml(content.action)}</odd-button>`;
  if ('elevation' in content)
    return `<ul class="elevation-tiles odd-cluster" role="list">${content.elevation
      .map(
        (name) =>
          `<li class="elevation-tile token-preview-shadow" data-preview="shadow" data-token="--odd-${escapeHtml(
            name.replace(/\./g, '-'),
          )}"><code>${escapeHtml(name)}</code></li>`,
      )
      .join('')}</ul>`;
  return `<ul class="role-swatches odd-stack" role="list">${content.roles
    .map(
      (name) =>
        `<li class="odd-row">${preview('color', `--odd-${name.replace(/\./g, '-')}`)}<code>${escapeHtml(name)}</code></li>`,
    )
    .join('')}</ul>`;
}

function inline(content: readonly Inline[]): string {
  return content
    .map((part) => {
      if (typeof part === 'string') return escapeHtml(part);
      if ('code' in part) return `<code>${escapeHtml(part.code)}</code>`;
      if ('strong' in part) return `<strong>${escapeHtml(part.strong)}</strong>`;
      if ('preview' in part) {
        const drawn = preview(part.preview, part.token, escapeHtml(part.text ?? ''));
        return part.mode
          ? `<span class="mode-scope" data-odd-mode="${part.mode}">${drawn}</span>`
          : drawn;
      }
      if ('sample' in part)
        return `<span class="type-sample odd-type-${part.role}">${escapeHtml(part.sample)}</span>`;
      if ('meter' in part)
        return `<meter class="duration-meter" min="0" max="${part.max}" value="${part.meter}" aria-label="${escapeHtml(part.label)}"></meter>`;
      return `<a href="${escapeHtml(part.href)}">${escapeHtml(part.link)}</a>`;
    })
    .join('');
}

const languages: Record<CodeBlock['lang'], string> = {
  html: 'HTML',
  js: 'JavaScript',
  ts: 'TypeScript',
  css: 'CSS',
  sh: 'Terminal',
  json: 'JSON',
};

/** A code sample with its language (or file name) and a copy button for the code. */
export function codeSample({ code, lang, caption, file }: CodeBlock, id: string): string {
  return `<figure class="code-block"><div class="code-toolbar odd-row odd-row-between"><span class="code-label">${escapeHtml(
    file ?? languages[lang],
  )}</span><odd-copy-button from="${escapeHtml(id)}"></odd-copy-button></div><pre class="code" id="${escapeHtml(
    id,
  )}" data-lang="${lang}" tabindex="0"><code>${escapeHtml(code)}</code></pre>${
    caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''
  }</figure>`;
}

/** A resource card (Figma Docs/ResourceCard 10:755): the package line and the action share the footer. */
export function resourceCard({ title, text, href, action, meta }: Card): string {
  return `<li><odd-card class="resource-card"><h3 slot="header">${escapeHtml(title)}</h3><p>${escapeHtml(
    text,
  )}</p><div slot="footer" class="card-footer odd-stack">${meta ? `<p class="card-meta odd-type-ui">${escapeHtml(meta)}</p>` : ''}<a class="odd-button" data-full-width href="${escapeHtml(
    href,
  )}">${escapeHtml(action)}</a></div></odd-card></li>`;
}

function block(item: Block, facts: FactBlocks, ids: () => string): string {
  if ('p' in item) return `<p>${inline(item.p)}</p>`;
  if ('note' in item) return `<p class="note">${inline(item.note)}</p>`;
  if ('list' in item) {
    const tag = item.ordered ? 'ol' : 'ul';
    return `<${tag}>${item.list.map((entry) => `<li>${inline(entry)}</li>`).join('')}</${tag}>`;
  }
  if ('code' in item) return codeSample(item.code, ids());
  if ('cards' in item)
    return `<ul class="card-list odd-auto-grid odd-grid-stretch" role="list">${item.cards.map(resourceCard).join('')}</ul>`;
  if ('ramp' in item)
    return `<figure class="ramp"><figcaption>${escapeHtml(item.ramp.title)}</figcaption><ol class="ramp-steps odd-cluster" role="list">${item.ramp.steps
      .map(
        (step) =>
          `<li class="odd-stack">${preview('color', step.token)}<span class="ramp-label">${escapeHtml(step.label)}</span><code>${escapeHtml(step.value)}</code></li>`,
      )
      .join('')}</ol></figure>`;
  if ('modes' in item)
    return `<div class="mode-specimens odd-auto-grid" role="group" aria-label="${escapeHtml(item.modes.caption)}">${item.modes.modes
      .map(
        (mode) =>
          `<figure class="mode-specimen odd-stack" data-odd-mode="${mode}"><figcaption>${capitalized(mode)}</figcaption>${specimen(item.modes.specimen)}</figure>`,
      )
      .join('')}</div>`;
  if ('tones' in item)
    return `<ul class="tone-list odd-stack" role="list">${item.tones
      .map(
        (tone) =>
          `<li><odd-alert tone="${escapeHtml(tone.tone)}" label="${escapeHtml(tone.label)}"><code>${escapeHtml(tone.token)}</code></odd-alert></li>`,
      )
      .join('')}</ul>`;
  if ('reflow' in item)
    return `<div class="reflow-specimens odd-stack">${item.reflow.widths
      .map(
        (width) =>
          `<figure class="reflow-specimen" data-preview="width" data-token="${escapeHtml(width.token)}"><figcaption>${escapeHtml(width.caption)}</figcaption><ul class="odd-auto-grid" role="list">${item.reflow.items
            .map((entry) => `<li><code>${escapeHtml(entry)}</code></li>`)
            .join('')}</ul></figure>`,
      )
      .join('')}</div>`;
  if ('table' in item) {
    const { caption, head, rows } = item.table;
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(caption)}"><table class="odd-table"><caption>${escapeHtml(caption)}</caption><thead><tr>${head
      .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
      .join('')}</tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr>${row.map((cell, i) => (i === 0 ? `<th scope="row">${inline(cell)}</th>` : `<td>${inline(cell)}</td>`)).join('')}</tr>`,
      )
      .join('')}</tbody></table></div>`;
  }
  return facts[item.fact].map((b) => block(b, facts, ids)).join('');
}

/** The page's `<main>` content. */
export function renderPage(page: Page, facts: FactBlocks): string {
  const toc = page.sections.length > 2;
  let count = 0;
  const ids = () => `code-${++count}`;
  return [
    `<header class="page-header"><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1><p class="lede">${escapeHtml(page.summary)}</p>${(
      page.intro ?? []
    )
      .map((b) => block(b, facts, ids))
      .join('')}</header>`,
    toc
      ? `<nav class="toc" aria-label="On this page"><p class="eyebrow">On this page</p><ul class="odd-cluster">${page.sections
          .map((s) => `<li><a href="#${escapeHtml(s.id)}">${escapeHtml(s.title)}</a></li>`)
          .join('')}</ul></nav>`
      : '',
    ...page.sections.map(
      (s) =>
        `<section class="content-section" id="${escapeHtml(s.id)}" aria-labelledby="${escapeHtml(s.id)}-title"><h2 id="${escapeHtml(s.id)}-title">${escapeHtml(s.title)}</h2>${s.blocks
          .map((b) => block(b, facts, ids))
          .join('')}</section>`,
    ),
    page.next
      ? `<div class="page-next"><a class="odd-link" href="${escapeHtml(page.next.href)}">${escapeHtml(page.next.label)}${icons.arrowRight}</a></div>`
      : '',
  ].join('');
}

/** Every code block of a page, with its section, for snippet verification. */
export function codeBlocks(page: Page): { section: string; code: CodeBlock }[] {
  return page.sections.flatMap((s) =>
    s.blocks.flatMap((b) => ('code' in b ? [{ section: s.id, code: b.code }] : [])),
  );
}
