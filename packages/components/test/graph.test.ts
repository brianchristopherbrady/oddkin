import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';
import { describe, expect, it } from 'vitest';

// Import graphs of the built entries (run after `npm run build`), independent of how a bundler
// would tree-shake: these are the modules a browser loads.
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

async function graph(entry: string): Promise<{ files: string[]; packages: string[] }> {
  await init;
  const files = new Set<string>();
  const packages = new Set<string>();
  const visit = async (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    const [imports] = parse(await readFile(file, 'utf8'));
    for (const record of imports) {
      const specifier = record.specifier;
      if (!specifier) continue;
      if (specifier.startsWith('.')) await visit(resolve(dirname(file), specifier));
      else packages.add(specifier);
    }
  };
  await visit(resolve(dist, entry));
  return {
    files: [...files].map((f) => f.slice(dist.length + 1).replaceAll('\\', '/')).sort(),
    packages: [...packages].sort(),
  };
}

describe('@mote/components/button import graphs', () => {
  it('the foundation entry loads no default skin, tokens, or registration', async () => {
    const { files, packages } = await graph('button/foundation.js');
    expect(files).toEqual([
      'button/button.js',
      'button/button.structural.styles.js',
      'button/button.template.js',
      'button/foundation.js',
    ]);
    expect(packages).toEqual([
      '@mote/core/element',
      '@mote/core/reactive',
      '@mote/core/styles',
      '@mote/core/template',
    ]);
  });

  it('the component entry adds the default skin but still registers nothing', async () => {
    const { files, packages } = await graph('button/index.js');
    expect(files).toContain('button/button.styles.js');
    expect(files.some((f) => f.endsWith('.define.js'))).toBe(false);
    expect(packages).toContain('@mote/tokens/refs');
  });
});

describe('@mote/components/card import graphs', () => {
  it('the foundation entry loads no default skin, tokens, or registration', async () => {
    const { files, packages } = await graph('card/foundation.js');
    expect(files).toEqual([
      'card/card.js',
      'card/card.structural.styles.js',
      'card/card.template.js',
      'card/foundation.js',
    ]);
    expect(packages.every((p) => p.startsWith('@mote/core/'))).toBe(true);
  });

  it('the component entry adds the default skin but still registers nothing', async () => {
    const { files, packages } = await graph('card/index.js');
    expect(files).toContain('card/card.styles.js');
    expect(files.some((f) => f.endsWith('.define.js'))).toBe(false);
    expect(packages).toContain('@mote/tokens/refs');
  });
});
