import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { docsFacts, siteFacts } from '../../apps/docs/facts.mjs';
import {
  clientPages,
  codeBlocks,
  navigation,
  pages,
  renderDocument,
  renderPage,
} from '../../apps/docs/src/pages/index.js';
import { previewExample } from '../../apps/docs/src/reference.js';

// The authored docs pages (apps/docs/src/pages) as the docs server renders them: every internal
// link reaches a page, every fact is generated, and every code sample says how it is verified
// (apps/docs/snippets/verify.mjs checks them against packed packages).
const root = fileURLToPath(new URL('../../', import.meta.url));
const clientRoutes = [
  /^\/components(\/[a-z0-9-]+)?$/,
  /^\/ai$/,
  /^\/layout\/side-nav$/,
  /^\/architecture\/scope-ownership$/,
  /^\/search$/,
];

/** A rendered page's text, as a reader sees it. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** A line of Markdown as text: no bullet, emphasis, code marks, link targets, or decision ids. */
const plain = (markdown: string) =>
  markdown
    .replace(/^\s*- /, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/\s*\(owner decision [^)]*\)/g, '')
    .trim();

describe('authored docs pages', async () => {
  const facts = await docsFacts(root);

  it('have unique paths, and the navigation lists each one once', () => {
    const paths = pages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    const links = navigation().flatMap((group) => group.links.map((link) => link.href));
    for (const path of paths) expect(links.filter((href) => href === `/${path}`)).toHaveLength(1);
  });

  it('link only to pages that exist', () => {
    const known = new Set(pages.map((page) => `/${page.path}`));
    for (const page of pages) {
      const html = renderPage(page, facts);
      for (const [, href = ''] of html.matchAll(/href="([^"]+)"/g)) {
        if (href.startsWith('#')) {
          expect(html, `${page.path} ${href}`).toContain(`id="${href.slice(1)}"`);
          continue;
        }
        if (/^https:\/\//.test(href)) continue;
        const [path = '', hash] = href.split('#');
        expect(
          known.has(path) || clientRoutes.some((route) => route.test(path)),
          `${page.path} → ${href}`,
        ).toBe(true);
        const target = pages.find((other) => `/${other.path}` === path);
        if (hash && target)
          expect(renderPage(target, facts), `${page.path} → ${href}`).toContain(`id="${hash}"`);
      }
    }
  });

  it('render every fact from the published files', () => {
    for (const [name, blocks] of Object.entries(facts)) {
      expect(blocks.length, name).toBeGreaterThan(0);
      expect(JSON.stringify(blocks), name).not.toMatch(/unknown/);
    }
    const html = renderPage(
      pages.find((page) => page.path === 'support/browsers')!,
      facts,
    );
    expect(html).toContain('Firefox');
    expect(html).toContain('<code>custom-properties</code>');
  });

  it('show the default theme’s tokens as the inspection and the contrast report give them', () => {
    interface Token {
      name: string;
      cssVariable: string;
      category: string;
      value: string | Record<string, string>;
    }
    const read = (file: string) =>
      JSON.parse(readFileSync(`${root}packages/tokens/dist/inspect/${file}`, 'utf8')) as {
        tokens: Token[];
        modes: string[];
        conditions: { atRule: string }[];
        summary: { pass: number };
      };
    const inspection = read('default.inspect.json');
    const contrast = read('default.contrast.json');
    const html = (path: string) =>
      renderPage(
        pages.find((page) => page.path === path)!,
        facts,
      );
    const color = html('foundations/color');
    for (const token of inspection.tokens.filter((t) => t.category === 'reference')) {
      expect(color, token.name).toContain(`data-token="${token.cssVariable}"`);
      expect(color, token.name).toContain(`<code>${String(token.value)}</code>`);
    }
    // Each role is drawn in each mode's scope, beside that mode's value.
    const canvas = inspection.tokens.find((t) => t.name === 'color.canvas')!;
    for (const mode of inspection.modes)
      expect(color).toContain(
        `<span class="mode-scope" data-odd-mode="${mode}"><span class="token-preview token-preview-color" data-preview="color" data-token="--odd-color-canvas" aria-hidden="true"></span></span> <code>${(canvas.value as Record<string, string>)[mode]}</code>`,
      );
    expect(color).toContain(`${contrast.summary.pass} pairs pass`);
    const families: Record<string, string> = {
      'font.size.': 'foundations/typography',
      'space.': 'foundations/spacing',
      'radius.': 'foundations/borders-and-radii',
      'elevation.': 'foundations/elevation',
      'motion.': 'foundations/motion',
      'layout.': 'foundations/responsive',
    };
    for (const [prefix, path] of Object.entries(families)) {
      const page = html(path);
      for (const token of inspection.tokens.filter((t) => t.name.startsWith(prefix)))
        expect(page, token.name).toContain(`<code>${token.name}</code>`);
    }
    for (const condition of inspection.conditions)
      expect(html('foundations/responsive')).toContain(`<code>${condition.atRule}</code>`);
  });

  it('say how each code sample is verified', () => {
    for (const page of pages)
      for (const { section, code } of codeBlocks(page))
        expect(['module', 'markup', 'css', 'none'], `${page.path} #${section}`).toContain(
          code.verify,
        );
  });

  it('show the support policy as docs/support.md says it, section by section', async () => {
    const policy = readFileSync(`${root}docs/support.md`, 'utf8');
    const page = pages.find((p) => p.path === 'support/policy')!;
    const html = renderPage(page, facts);
    const shown = text(html);
    // The policy's sections, in order, at the anchors GitHub gives them.
    expect(page.sections.map((s) => s.title)).toEqual(
      [...policy.matchAll(/^## (.+)$/gm)].map(([, heading]) => heading),
    );
    for (const { title, id } of page.sections)
      expect(id).toBe(
        title
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, '')
          .replace(/ /g, '-'),
      );
    // The summary is its first sentence; the rest of the opening follows, without decision ids.
    const [opening = '', ...lines] = policy
      .split('\n')
      .filter((line) => /^[^#\s]|^\s+-/.test(line));
    const [first = '', rest = ''] = plain(opening).split(/(?<=\.)\s+(.*)/s);
    expect(page.summary.replace(/’/g, "'")).toBe(first);
    expect(shown).toContain(rest);
    expect(shown).not.toContain('owner decision');
    // Every line of every section, and every link, resolved in the repository.
    for (const line of lines) expect(shown).toContain(plain(line));
    const { repository } = await siteFacts(root);
    for (const [, href = ''] of policy.matchAll(/\]\(([^)]+)\)/g))
      expect(html).toContain(`href="${new URL(href, `${repository}/blob/main/docs/`).href}"`);
  });

  it('name the evidence for accessibility, and that screen readers are not yet verified', () => {
    const policy = readFileSync(`${root}docs/support.md`, 'utf8');
    const accessibility = policy.split(/^## /m).find((part) => part.startsWith('Accessibility'))!;
    const guide = pages.find((p) => p.path === 'guides/forms-accessibility')!;
    const shown = text(renderPage(guide, facts));
    for (const line of accessibility
      .split('\n')
      .slice(1)
      .filter((l) => l.trim()))
      expect(shown).toContain(plain(line));
    expect(guide.summary).toContain('screen readers are not yet verified');
  });

  it('escape authored text', () => {
    const html = renderPage(
      {
        path: 'x',
        group: 'Start here',
        eyebrow: '<b>',
        title: 'a & b',
        summary: '"q"',
        sections: [],
      },
      facts,
    );
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('&quot;q&quot;');
  });

  it('give each code sample an id that its copy button names', () => {
    for (const page of pages) {
      const html = renderPage(page, facts);
      const ids = [...html.matchAll(/<pre class="code" id="([^"]+)"/g)].map(([, id]) => id);
      expect(new Set(ids).size, page.path).toBe(ids.length);
      expect(ids.length, page.path).toBe(codeBlocks(page).length);
      for (const id of ids) expect(html, page.path).toContain(`<odd-copy-button from="${id}">`);
    }
  });
});

describe('the docs shell', async () => {
  const facts = await docsFacts(root);
  // The catalog comes from the Workbench reference index the server builds; one page stands in.
  const release = await siteFacts(root, {
    registry: {
      pages: [
        { kind: 'component', route: '/components/odd-button', title: 'Button', visible: true },
        {
          kind: 'component',
          route: '/components/odd-conversation',
          title: 'Conversation',
          group: 'AI',
          visible: true,
        },
      ],
    },
  });
  const template = readFileSync(`${root}apps/docs/index.html`, 'utf8');
  const shell = (path: string) => renderDocument(template, path, facts, release);
  const sidebar = (html: string) =>
    html.slice(html.indexOf('<odd-side-nav'), html.indexOf('</odd-side-nav>'));
  /** The shown section's links (the others are `hidden`), as label, href, and aria-current. */
  const sectionNav = (html: string) =>
    [...sidebar(html).matchAll(/<a class="nav-section" href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)]
      .filter(([, , attributes = '']) => !/ hidden\b/.test(attributes))
      .map(([, href, attributes = '', label]) => {
        const current = /aria-current="([a-z]+)"/.exec(attributes)?.[1];
        return `${label} ${href}${current ? ` [${current}]` : ''}`;
      });
  /** The shown section's note under the divider. */
  const note = (html: string, section: string) =>
    new RegExp(
      `<div slot="footer" class="nav-footer nav-section odd-stack" data-section="${section}">(.*?)</div>`,
    ).exec(sidebar(html))?.[1];

  it('fills every part of the template but the policy, which the server or the build adds', () => {
    const html = shell('/installation');
    expect(html.match(/<!-- docs:[a-z]+ -->/g)).toEqual(['<!-- docs:csp -->']);
    expect(html).toContain('<title>Installation · Oddkin</title>');
    expect(html).toContain(
      '<main id="main" tabindex="-1" class="odd-box" data-page="installation">',
    );
  });

  it('names the release from the manifests and Oddkin from the README', () => {
    const core = JSON.parse(readFileSync(`${root}packages/core/package.json`, 'utf8'));
    expect(release.version).toBe(core.version);
    expect(shell('/')).toContain(`v${core.version}`);
    expect(release.description).toMatch(/^Oddkin is .+\.$/);
    expect(release.repository).toMatch(/^https:\/\/github\.com\/[^/]+\/oddkin$/);
  });

  it('marks the current page and its section in the site map, which shows only the open page’s children', () => {
    const html = shell('/getting-started/tokens');
    expect(sidebar(html)).toContain(
      '<a class="nav-global nav-child" href="/getting-started/tokens" data-parent="/getting-started" aria-current="page">',
    );
    expect(sidebar(html)).toContain(
      '<a class="nav-global" href="/getting-started" aria-current="true">',
    );
    expect(html).toContain('<a href="/getting-started" aria-current="true">Learn</a>');
    expect(sidebar(html)).toContain(
      '<a class="nav-global nav-child" href="/guides/theming" data-parent="/guides" hidden>',
    );
    expect(sidebar(shell('/guides'))).toContain(
      '<a class="nav-global nav-child" href="/guides/theming" data-parent="/guides">',
    );
    expect(sidebar(shell('/components/odd-button'))).toContain(
      '<a class="nav-global" href="/components" aria-current="true">',
    );
  });

  it('shows the section’s sidebar: its heading, its pages as the design lists them, and its note', () => {
    const learn = shell('/getting-started');
    expect(sidebar(learn)).toMatch(
      /^<odd-side-nav id="docs-nav" class="side-nav" data-section="learn"/,
    );
    expect(sidebar(learn)).toContain(
      '<p slot="header" class="nav-heading nav-section" data-section="learn">Learn</p>',
    );
    // Every section is in the document, so the client can show another without loading one.
    expect(sidebar(learn)).toContain(
      '<p slot="header" class="nav-heading nav-section" data-section="components" hidden>Components</p>',
    );
    expect(sectionNav(learn)).toEqual([
      'Getting started /getting-started [page]',
      'Installation /installation',
      'Core and state /core',
      'Guides /guides',
      'Recipes /recipes',
    ]);
    expect(note(learn, 'learn')).toBe('<p>Oddkin docs</p>');
    // A page under a listed one marks it; its own pages are linked from its content.
    expect(sectionNav(shell('/getting-started/tokens'))[0]).toBe(
      'Getting started /getting-started [true]',
    );
    expect(sectionNav(shell('/layout/side-nav'))).toContain('Guides /guides');

    // Browse all and Overview list pages under them, so they are current on their own page only.
    expect(sectionNav(shell('/components/odd-button'))).toEqual([
      'Browse all /components',
      'Button /components/odd-button [page]',
    ]);
    expect(sectionNav(shell('/components'))[0]).toBe('Browse all /components [page]');
    expect(note(shell('/components'), 'components')).toBe('<p>@oddkin/components</p>');
    const color = sectionNav(shell('/foundations/color'));
    expect(color[0]).toBe('Overview /foundations');
    expect(color).toContain('Color /foundations/color [page]');
    expect(note(shell('/foundations'), 'foundations')).toBe(
      '<p>@oddkin/tokens</p><p>Default theme baseline</p>',
    );
    expect(sectionNav(shell('/ai'))).toEqual([
      'Analyzer and agents /tooling',
      'AI interfaces /ai [page]',
    ]);
    expect(sectionNav(shell('/architecture/scope-ownership'))).toEqual([
      'Architecture /architecture [true]',
      'Roadmap /roadmap',
      'Help and releases /support',
    ]);
  });

  it('links the header destinations that exist: Tools goes to its first page until /workbench exists', () => {
    const html = shell('/ai');
    const start = html.indexOf('<nav class="primary-nav');
    const header = html.slice(start, html.indexOf('</nav>', start));
    expect(
      [...header.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(
        ([, href, label]) => `${label} ${href}`,
      ),
    ).toEqual([
      'Learn /getting-started',
      'Components /components',
      'Foundations /foundations',
      'Tools /tooling',
    ]);
    expect(header).toContain('<a href="/tooling" aria-current="true">Tools</a>');
  });

  it('gives every page but Home a section, and Home and search the site map alone', () => {
    const opening = (html: string) => sidebar(html).slice(0, sidebar(html).indexOf('>') + 1);
    for (const path of [...pages, ...clientPages].map((page) => page.path).filter(Boolean)) {
      expect(opening(shell(`/${path}`)), path).toMatch(/ data-section="[a-z]+" /);
      expect(sectionNav(shell(`/${path}`)).length, path).toBeGreaterThan(0);
    }
    for (const path of ['/', '/search', '/404']) {
      expect(opening(shell(path)), path).not.toContain('data-section');
      expect(sectionNav(shell(path)), path).toEqual([]);
    }
  });

  it('links only to pages that exist', () => {
    for (const path of ['/', '/getting-started', '/components', '/404']) {
      const html = shell(path);
      // The home page's own content is checked here too; other pages' content is checked above.
      const checked =
        path === '/'
          ? html
          : html.slice(0, html.indexOf('<main')) + html.slice(html.indexOf('</main>'));
      for (const [, href = ''] of checked.matchAll(/href="(\/[^"]*)"/g)) {
        if (/\.(?:css|js)$/.test(href) || href.startsWith('/public/')) continue;
        const known = pages.some((page) => `/${page.path}` === href);
        expect(known || clientRoutes.some((route) => route.test(href)), `${path} → ${href}`).toBe(
          true,
        );
      }
    }
  });

  it('renders the home page from the pages, manifests, and registry, without the sidebar column', () => {
    const html = shell('/');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(html).toContain('<div class="site-layout odd-split" data-home>');
    expect(main).toContain(`Oddkin ${release.version}`);
    expect(main).toContain(`Supported browsers: ${release.browsers}, and later.`);
    expect(main).toContain(`${release.components} elements`);
    for (const page of pages.filter((p) => p.parent === 'getting-started'))
      expect(main).toContain(`href="/${page.path}"`);
    expect(main).not.toContain('undefined');
  });
});

describe('catalog previews', () => {
  const example = (name: string, definition: Record<string, unknown>) => ({ name, definition });
  const page = (...examples: ReturnType<typeof example>[]) =>
    ({ examples }) as unknown as Parameters<typeof previewExample>[0];

  it('use the default example, or else the first correct one that opens nothing, fixture or not', () => {
    const options = { props: { options: [{ value: 'a', label: 'A' }] } };
    expect(previewExample(page(example('default', { props: { label: 'Role' } })))).toEqual({
      name: 'default',
      values: { attributes: {}, properties: { label: 'Role' }, slots: {} },
      fixture: false,
    });
    expect(previewExample(page(example('default', { hasFixture: true })))).toMatchObject({
      name: 'default',
      fixture: true,
    });
    const fallback = previewExample(
      page(
        example('default', { props: { open: true } }),
        example('wrong', { ...options, incorrect: { explanation: 'No.' } }),
        example('fromData', { ...options, hasFixture: true }),
      ),
    );
    expect(fallback).toMatchObject({ name: 'fromData', fixture: true });
    expect(fallback?.values.properties).toEqual(options.props);
    expect(previewExample(page(example('open', { props: { open: true } })))).toBeUndefined();
  });
});
