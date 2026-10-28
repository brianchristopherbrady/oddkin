/**
 * Authored documentation pages as plain data: rendered to HTML by the docs server, so each page is
 * readable before JavaScript runs, and by nothing else. Facts (package versions, the browser floor,
 * component counts) are named here and filled in from the published files when the page is served.
 */

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
  'packages' | 'browser-floor' | 'browser-features' | 'component-counts' | 'framework-versions';

export type Block =
  | { p: Inline[] }
  | { list: Inline[][]; ordered?: true }
  | { code: CodeBlock }
  | { table: { caption: string; head: string[]; rows: Inline[][][] } }
  | { fact: Fact }
  | { note: Inline[] };

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export interface Page {
  /** Route path without a leading slash; '' is the home page. */
  path: string;
  /** Navigation group. */
  group: 'Start' | 'Guides' | 'Reference';
  eyebrow: string;
  title: string;
  /** Navigation label, when shorter than the title. */
  label?: string;
  summary: string;
  sections: Section[];
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

function block(item: Block, facts: FactBlocks): string {
  if ('p' in item) return `<p>${inline(item.p)}</p>`;
  if ('note' in item) return `<p class="note">${inline(item.note)}</p>`;
  if ('list' in item) {
    const tag = item.ordered ? 'ol' : 'ul';
    return `<${tag}>${item.list.map((entry) => `<li>${inline(entry)}</li>`).join('')}</${tag}>`;
  }
  if ('code' in item) {
    const { code, lang, caption } = item.code;
    const figure = `<pre class="code" data-lang="${lang}" tabindex="0"><code>${escapeHtml(code)}</code></pre>`;
    return caption
      ? `<figure class="code-sample"><figcaption>${escapeHtml(caption)}</figcaption>${figure}</figure>`
      : figure;
  }
  if ('table' in item) {
    const { caption, head, rows } = item.table;
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(caption)}"><table><caption>${escapeHtml(caption)}</caption><thead><tr>${head
      .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
      .join('')}</tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr>${row.map((cell, i) => (i === 0 ? `<th scope="row">${inline(cell)}</th>` : `<td>${inline(cell)}</td>`)).join('')}</tr>`,
      )
      .join('')}</tbody></table></div>`;
  }
  return facts[item.fact].map((b) => block(b, facts)).join('');
}

/** The page's `<main>` content. */
export function renderPage(page: Page, facts: FactBlocks): string {
  const toc = page.sections.length > 2;
  return [
    `<header class="page-header"><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1><p class="lede">${escapeHtml(page.summary)}</p></header>`,
    toc
      ? `<nav class="toc" aria-label="On this page"><p class="eyebrow">On this page</p><ul>${page.sections
          .map((s) => `<li><a href="#${escapeHtml(s.id)}">${escapeHtml(s.title)}</a></li>`)
          .join('')}</ul></nav>`
      : '',
    ...page.sections.map(
      (s) =>
        `<section class="content-section" id="${escapeHtml(s.id)}" aria-labelledby="${escapeHtml(s.id)}-title"><h2 id="${escapeHtml(s.id)}-title">${escapeHtml(s.title)}</h2>${s.blocks
          .map((b) => block(b, facts))
          .join('')}</section>`,
    ),
  ].join('');
}

/** Every code block of a page, with its section, for snippet verification. */
export function codeBlocks(page: Page): { section: string; code: CodeBlock }[] {
  return page.sections.flatMap((s) =>
    s.blocks.flatMap((b) => ('code' in b ? [{ section: s.id, code: b.code }] : [])),
  );
}
