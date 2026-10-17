import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const page = new URL('../../examples/core-counter/index.html', import.meta.url);

describe('core-counter CSP', () => {
  it('allows exactly the inline import map by hash', async () => {
    const html = await readFile(page, 'utf8');
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
