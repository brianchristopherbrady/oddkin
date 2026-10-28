import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { docsFacts, siteFacts } from '../../apps/docs/facts.mjs';
import {
  codeBlocks,
  navigation,
  pages,
  renderDocument,
  renderPage,
} from '../../apps/docs/src/pages/index.js';

// The authored docs pages (apps/docs/src/pages) as the docs server renders them: every internal
// link reaches a page, every fact is generated, and every code sample says how it is verified
// (apps/docs/snippets/verify.mjs checks them against packed packages).
const root = fileURLToPath(new URL('../../', import.meta.url));
const clientRoutes = [
  /^\/components(\/[a-z0-9-]+)?$/,
  /^\/layout\/side-nav$/,
  /^\/architecture\/scope-ownership$/,
  /^\/search$/,
];

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
        expect(
          known.has(href) || clientRoutes.some((route) => route.test(href)),
          `${page.path} → ${href}`,
        ).toBe(true);
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
  const release = await siteFacts(root);
  const template = readFileSync(`${root}apps/docs/index.html`, 'utf8');
  const shell = (path: string) => renderDocument(template, path, facts, release);

  it('fills every part of the template but the policy, which the server or the build adds', () => {
    const html = shell('/installation');
    expect(html.match(/<!-- docs:[a-z]+ -->/g)).toEqual(['<!-- docs:csp -->']);
    expect(html).toContain('<title>Installation · Oddkin</title>');
    expect(html).toContain('<main id="main" tabindex="-1" data-page="installation">');
  });

  it('names the release from the manifests and Oddkin from the README', () => {
    const core = JSON.parse(readFileSync(`${root}packages/core/package.json`, 'utf8'));
    expect(release.version).toBe(core.version);
    expect(shell('/')).toContain(`v${core.version}`);
    expect(release.description).toMatch(/^Oddkin is .+\.$/);
    expect(release.repository).toMatch(/^https:\/\/github\.com\/[^/]+\/oddkin$/);
  });

  it('marks the current page, its section, and lists only that section’s children', () => {
    const sidebar = (html: string) =>
      html.slice(html.indexOf('<odd-side-nav'), html.indexOf('</odd-side-nav>'));
    const html = shell('/getting-started/tokens');
    expect(html).toContain(
      '<a class="nav-child" href="/getting-started/tokens" aria-current="page">',
    );
    expect(html).toContain('<a href="/getting-started" aria-current="true">');
    expect(html).toContain('<a href="/getting-started" aria-current="true">Learn</a>');
    expect(sidebar(html)).not.toContain('href="/guides/theming"');
    expect(sidebar(shell('/guides'))).toContain('<a class="nav-child" href="/guides/theming">');
    expect(shell('/components/odd-button')).toContain('<a href="/components" aria-current="true">');
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
