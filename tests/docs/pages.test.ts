import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { docsFacts } from '../../apps/docs/facts.mjs';
import { codeBlocks, navigation, pages, renderPage } from '../../apps/docs/src/pages/index.js';

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
      pages.find((page) => page.path === 'browser-support')!,
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
      { path: 'x', group: 'Start', eyebrow: '<b>', title: 'a & b', summary: '"q"', sections: [] },
      facts,
    );
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('&quot;q&quot;');
  });
});
