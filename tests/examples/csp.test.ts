import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// Example pages that run under a strict CSP. After editing an import map, run
// `node scripts/update-csp-hash.mjs <page>` (after formatting, which changes the hashed text).
const pages = [
  'core-counter',
  'components-only',
  'css-gallery',
  'side-nav',
  'editable-list',
  'composite-roles',
];

describe.each(pages)('%s CSP', (name) => {
  it('allows exactly the inline import map by hash', async () => {
    const html = await readFile(
      new URL(`../../examples/${name}/index.html`, import.meta.url),
      'utf8',
    );
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
      (m) => m[1] ?? '',
    );
    expect(inline).toHaveLength(1);
    const hash = createHash('sha256')
      .update(inline[0] ?? '')
      .digest('base64');
    const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(policy).toContain(`'sha256-${hash}'`);
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).toContain("require-trusted-types-for 'script'");
  });
});
