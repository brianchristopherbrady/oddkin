import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { main } from '../../packages/analyzer/src/kit/cli.js';
import { repo } from './acme.js';

// `oddkin-kit llms`: a documentation site's llms.txt (llmstxt.org), indexing the kits it serves.
vi.setConfig({ testTimeout: 60_000 });

const out = mkdtempSync(join(tmpdir(), 'oddkin-llms-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

function sink() {
  const lines: string[] = [];
  return { lines, io: { out: (t: string) => lines.push(t), err: (t: string) => lines.push(t) } };
}

describe('oddkin-kit llms', () => {
  it('indexes the kits the site serves, each link a file it wrote', async () => {
    const base = 'https://oddkin.test/docs/';
    const args = ['llms', '--root', repo, '--base', base, '--out', out, '--title', 'Oddkin'];
    expect(await main([...args, '--summary', 'Web components and tokens.'], sink().io)).toBe(0);
    const text = readFileSync(join(out, 'llms.txt'), 'utf8');
    const lines = text.split('\n');
    // An H1, a blockquote, then H2 sections of link lists, "Optional" last (llmstxt.org).
    expect(lines[0]).toBe('# Oddkin');
    expect(lines[2]).toBe('> Web components and tokens.');
    expect(lines.filter((line) => line.startsWith('## '))).toEqual([
      expect.stringMatching(/^## @oddkin\/ai \d/),
      expect.stringMatching(/^## @oddkin\/components \d/),
      '## Optional',
    ]);
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map(([, url]) => url!);
    expect(links.length).toBeGreaterThan(80);
    for (const url of links) {
      expect(url.startsWith(base), url).toBe(true);
      expect(existsSync(join(out, ...url.slice(base.length).split('/'))), url).toBe(true);
    }
    const kit = `${base}agent/oddkin-components/`;
    expect(text).toContain(`- [@oddkin/components guide](${kit}GUIDE.md): `);
    expect(text).toMatch(
      new RegExp(`- \\[odd-button\\]\\(${kit}references/components/odd-button\\.md\\): \\S`),
    );
    // The site serves the kit the package ships.
    expect(readFileSync(join(out, 'agent/oddkin-components/GUIDE.md'), 'utf8')).toBe(
      readFileSync(join(repo, 'packages/components/agent/GUIDE.md'), 'utf8'),
    );
  });

  it('needs an absolute base URL and an output directory', async () => {
    const { lines, io } = sink();
    expect(await main(['llms', '--root', repo, '--out', out], io)).toBe(2);
    expect(await main(['llms', '--root', repo, '--base', '/docs/', '--out', out], io)).toBe(2);
    expect(await main(['llms', '--root', repo, '--base', 'file:///site/', '--out', out], io)).toBe(
      2,
    );
    expect(await main(['llms', '--root', repo, '--base', 'https://oddkin.test/'], io)).toBe(2);
    expect(lines.filter((line) => line.startsWith('llms needs --base'))).toHaveLength(4);
  });
});
