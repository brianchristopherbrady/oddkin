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

describe('@oddkin/components/button import graphs', () => {
  it('the foundation entry loads no default skin, tokens, or registration', async () => {
    const { files, packages } = await graph('button/foundation.js');
    expect(files).toEqual([
      'button/button.js',
      'button/button.structural.styles.js',
      'button/button.template.js',
      'button/foundation.js',
      'form-control/description.js',
      'styles/host.styles.js',
      'styles/spinner.styles.js',
    ]);
    expect(packages).toEqual([
      '@oddkin/core/element',
      '@oddkin/core/reactive',
      '@oddkin/core/styles',
      '@oddkin/core/template',
    ]);
  });

  it('the component entry adds the default skin but still registers nothing', async () => {
    const { files, packages } = await graph('button/index.js');
    expect(files).toContain('button/button.styles.js');
    expect(files.some((f) => f.endsWith('.define.js'))).toBe(false);
    expect(packages).toContain('@oddkin/tokens/refs');
  });
});

describe('@oddkin/components/card import graphs', () => {
  it('the foundation entry loads no default skin, tokens, or registration', async () => {
    const { files, packages } = await graph('card/foundation.js');
    expect(files).toEqual([
      'card/card.js',
      'card/card.structural.styles.js',
      'card/card.template.js',
      'card/foundation.js',
      'styles/host.styles.js',
    ]);
    expect(packages.every((p) => p.startsWith('@oddkin/core/'))).toBe(true);
  });

  it('the component entry adds the default skin but still registers nothing', async () => {
    const { files, packages } = await graph('card/index.js');
    expect(files).toContain('card/card.styles.js');
    expect(files.some((f) => f.endsWith('.define.js'))).toBe(false);
    expect(packages).toContain('@oddkin/tokens/refs');
  });
});

describe('@oddkin/components/input import graphs', () => {
  it('the foundation entry loads no default skin, tokens, or registration', async () => {
    const { files, packages } = await graph('input/foundation.js');
    expect(files).toEqual([
      'form-control/description.js',
      'form-control/form-control.js',
      'input/foundation.js',
      'input/input.js',
      'input/input.structural.styles.js',
      'input/input.template.js',
      'styles/field.structural.styles.js',
      'styles/host.styles.js',
    ]);
    expect(packages.every((p) => p.startsWith('@oddkin/core/'))).toBe(true);
  });
});

describe('@oddkin/components/side-nav import graphs', () => {
  it('the foundation loads no skin, recipe engine, tokens, validators, or registration', async () => {
    const { files, packages } = await graph('side-nav/foundation.js');
    expect(files).toEqual([
      'side-nav/foundation.js',
      // The kinds registry: the element checks `.kinds` against it; no model builder at runtime.
      'side-nav/kinds.js',
      'side-nav/side-nav.js',
      'side-nav/side-nav.recipe.styles.js',
      'side-nav/side-nav.structural.styles.js',
      'side-nav/side-nav.template.js',
      'styles/host.styles.js',
      // The shared navigation rows' structure (no tokens), also used by odd-tree.
      'styles/nav-row.structural.styles.js',
    ]);
    expect(packages).toEqual([
      '@oddkin/core/controllers/focus',
      '@oddkin/core/diagnostics',
      '@oddkin/core/element',
      '@oddkin/core/reactive',
      '@oddkin/core/styles',
      '@oddkin/core/template',
    ]);
  });

  it('the registration entry loads neither the recipe engine nor the model validators', async () => {
    const { files, packages } = await graph('side-nav/side-nav.define.js');
    expect(files.some((f) => f.startsWith('models/') || f.startsWith('layout/'))).toBe(false);
    expect(packages).not.toContain('@oddkin/core/layout');
    expect(packages).not.toContain('@oddkin/core/model');
    expect(packages).not.toContain('@oddkin/core/model/schema');
  });
});
