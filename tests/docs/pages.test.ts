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
  /^\/foundations(\/[a-z-]+)?$/,
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
      const shellOnly = html.slice(0, html.indexOf('<main')) + html.slice(html.indexOf('</main>'));
      for (const [, href = ''] of shellOnly.matchAll(/href="(\/[^"]*)"/g)) {
        if (/\.(?:css|js)$/.test(href) || href.startsWith('/public/')) continue;
        const known = pages.some((page) => `/${page.path}` === href);
        expect(known || clientRoutes.some((route) => route.test(href)), `${path} → ${href}`).toBe(
          true,
        );
      }
    }
  });
});
