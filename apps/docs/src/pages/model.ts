/**
 * Authored documentation pages as plain data: rendered to HTML by the docs server, so each page is
 * readable before JavaScript runs, and by nothing else. Facts (package versions, the browser floor,
 * component counts) are named here and filled in from the published files when the page is served.
 */

import { icons } from './icons.js';

/** Inline content: text, code, a link, or emphasis. */
export type Inline =
  string | { code: string } | { link: string; href: string } | { strong: string };

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

/** Facts generated from the published metadata, manifests, tokens, and compatibility data. */
export type Fact =
  | 'packages'
  | 'browser-floor'
  | 'browser-features'
  | 'component-counts'
  | 'framework-versions'
  | 'decisions'
  | 'milestones'
  | 'examples';

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
  | { cards: Card[] };

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

function inline(content: readonly Inline[]): string {
  return content
    .map((part) => {
      if (typeof part === 'string') return escapeHtml(part);
      if ('code' in part) return `<code>${escapeHtml(part.code)}</code>`;
      if ('strong' in part) return `<strong>${escapeHtml(part.strong)}</strong>`;
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

function card({ title, text, href, action, meta }: Card): string {
  return `<li><odd-card class="resource-card"><h3 slot="header">${escapeHtml(title)}</h3><p>${escapeHtml(
    text,
  )}</p>${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ''}<a slot="footer" class="odd-button" data-full-width href="${escapeHtml(
    href,
  )}">${escapeHtml(action)}</a></odd-card></li>`;
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
    return `<ul class="card-list odd-auto-grid" role="list">${item.cards.map(card).join('')}</ul>`;
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
    `<header class="page-header"><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1><p class="lede">${escapeHtml(page.summary)}</p></header>`,
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
      ? `<p class="page-next"><a class="odd-link" href="${escapeHtml(page.next.href)}">${escapeHtml(page.next.label)}${icons.arrowRight}</a></p>`
      : '',
  ].join('');
}

/** Every code block of a page, with its section, for snippet verification. */
export function codeBlocks(page: Page): { section: string; code: CodeBlock }[] {
  return page.sections.flatMap((s) =>
    s.blocks.flatMap((b) => ('code' in b ? [{ section: s.id, code: b.code }] : [])),
  );
}
