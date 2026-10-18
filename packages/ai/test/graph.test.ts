import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';
import { describe, expect, it } from 'vitest';

// Import graphs of the built entries (run after `npm run build`): the modules a browser loads.
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const specifiers = new Map<string, Promise<string[]>>();
const importsOf = (file: string) => {
  let found = specifiers.get(file);
  if (!found) {
    found = readFile(file, 'utf8').then((source) =>
      parse(source)[0].flatMap((record) => (record.specifier ? [record.specifier] : [])),
    );
    specifiers.set(file, found);
  }
  return found;
};

async function graph(entry: string): Promise<{ files: string[]; packages: string[] }> {
  await init;
  const files = new Set<string>();
  const packages = new Set<string>();
  const visit = async (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    for (const specifier of await importsOf(file)) {
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

const OPTIONAL = /^(highlight|stream|voice)\//;
const ELEMENT_FOLDER =
  /^(?!contracts|controllers|internal|markdown|highlight|stream|voice)[a-z-]+\//;

// Parsing a few hundred modules can exceed the default 5 s while three browser projects run.
describe('@oddkin/ai import graphs', { timeout: 30_000 }, () => {
  it('the root entry is the DOM-free contracts only', async () => {
    const { files, packages } = await graph('index.js');
    expect(files.every((f) => f === 'index.js' || f.startsWith('contracts/'))).toBe(true);
    expect(packages).toEqual(['@oddkin/core/model']);
  });

  it('controllers load no elements, templates, Markdown, adapters, or frameworks', async () => {
    const { files, packages } = await graph('controllers/index.js');
    expect(
      files.filter((f) => ELEMENT_FOLDER.test(f) || f.startsWith('markdown/') || OPTIONAL.test(f)),
    ).toEqual([]);
    expect(
      packages.every((p) =>
        [
          '@oddkin/core/model',
          '@oddkin/core/reactive',
          '@oddkin/core/element',
          '@oddkin/core/i18n',
        ].includes(p),
      ),
      packages.join(),
    ).toBe(true);
  });

  it('the conversation registration loads neither highlighting, voice, nor stream adapters', async () => {
    const { files, packages } = await graph('conversation/conversation.define.js');
    expect(files.filter((f) => OPTIONAL.test(f))).toEqual([]);
    expect(packages.filter((p) => !p.startsWith('@oddkin/'))).toEqual([]);
    expect(
      packages.filter((p) => /^@oddkin\/(state|app|analyzer|workbench|agent)/.test(p)),
    ).toEqual([]);
  });

  it('element entries register nothing; only define entries do', async () => {
    for (const name of ['conversation', 'prompt-input', 'response', 'voice-input']) {
      const { files } = await graph(`${name}/index.js`);
      expect(
        files.some((f) => f.endsWith('.define.js')),
        name,
      ).toBe(false);
    }
  });

  it('the stream adapters and Markdown renderer do not load elements', async () => {
    for (const entry of ['stream/index.js', 'markdown/index.js']) {
      const { files, packages } = await graph(entry);
      expect(
        files.filter((f) => ELEMENT_FOLDER.test(f)),
        entry,
      ).toEqual([]);
      expect(
        packages.some((p) => p.startsWith('@oddkin/components')),
        entry,
      ).toBe(false);
    }
  });
});
