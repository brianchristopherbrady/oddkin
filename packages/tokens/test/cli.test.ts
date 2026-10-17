import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generate } from '../src/index.js';
import { run } from '../src/node/cli.js';

// Inside the repository so `@mote/tokens` resolves for JS and TS configs.
const dir = join(process.cwd(), '.tmp', `cli-${process.pid}`);
const at = (file: string) => join(dir, file);

async function cli(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, { out: (t) => out.push(t), err: (t) => err.push(t) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

beforeAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('mote-tokens CLI', () => {
  it('init writes a starter config once', async () => {
    expect((await cli('init', at('mote.theme.json'))).code).toBe(0);
    const again = await cli('init', at('mote.theme.json'));
    expect(again.code).toBe(1);
    expect(again.err).toContain('already exists');
    expect((await cli('check', at('mote.theme.json'))).code).toBe(0);
  });

  it('check reports diagnostics with codes and paths, and --strict fails on warnings', async () => {
    await writeFile(
      at('bad.json'),
      JSON.stringify({ brand: { primary: '#000' }, spacing: { strategy: 'ratio', base: '1rem' } }),
    );
    const bad = await cli('check', at('bad.json'));
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('error number.nonFinite /spacing/ratio');

    await writeFile(
      at('warn.json'),
      JSON.stringify({
        brand: { primary: '#000' },
        spacing: { strategy: 'multiples', unit: '4px', steps: { xs: 1, sm: 2, md: 4, lg: 6 } },
      }),
    );
    const warn = await cli('check', at('warn.json'));
    expect(warn.code).toBe(0);
    expect(warn.err).toContain('warning unit.discouraged /spacing/unit');
    expect((await cli('check', at('warn.json'), '--strict')).code).toBe(1);

    const json = await cli('check', at('bad.json'), '--json');
    expect((JSON.parse(json.out) as Array<{ code: string }>).map((d) => d.code)).toContain(
      'scale.invalidParameter',
    );
  });

  it('build writes the generator output byte for byte', async () => {
    const config = { name: 'acme', brand: { primary: '#5b46e8' } };
    await writeFile(at('acme.json'), JSON.stringify(config));
    const result = await cli('build', at('acme.json'), '--out', at('out'));
    expect(result.code).toBe(0);
    expect(await readFile(at('out/acme.css'), 'utf8')).toBe(generate(config).css);
    expect(await readFile(at('out/acme.refs.ts'), 'utf8')).toContain(
      'export function token(name: TokenName',
    );
    expect(await readFile(at('out/acme.values.ts'), 'utf8')).toContain('export const values = {');
    expect(JSON.parse(await readFile(at('out/acme.inspect.json'), 'utf8'))).toHaveProperty(
      'theme',
      'acme',
    );
  });

  it('loads ESM JavaScript and TypeScript configs (type stripping) identically to JSON', async () => {
    const body = `import { defineTheme } from '@mote/tokens/theme';\nexport default defineTheme({ name: 'typed', brand: { primary: '#0f766e' } });\n`;
    await writeFile(at('typed.mjs'), body);
    await writeFile(
      at('typed.ts'),
      body.replace('defineTheme({', "defineTheme({ modes: ['light', 'dark'] as const,"),
    );
    expect((await cli('build', at('typed.mjs'), '--out', at('js'), '--format', 'css')).code).toBe(
      0,
    );
    expect((await cli('build', at('typed.ts'), '--out', at('ts'), '--format', 'css')).code).toBe(0);
    const expected = generate({ name: 'typed', brand: { primary: '#0f766e' } }).css;
    expect(await readFile(at('js/typed.css'), 'utf8')).toBe(expected);
    expect(await readFile(at('ts/typed.css'), 'utf8')).toBe(expected);
  });

  it('reports load failures and usage errors with distinct exit codes', async () => {
    const missing = await cli('check', at('nope.json'));
    expect([missing.code, missing.err.includes('config.load')]).toEqual([1, true]);
    await writeFile(at('broken.json'), '{ "brand": ');
    expect((await cli('check', at('broken.json'))).err).toContain('config.load');
    expect((await cli('frobnicate')).code).toBe(2);
    expect((await cli('build')).code).toBe(2);
    expect((await cli('build', at('acme.json'), '--format', 'scss')).code).toBe(2);
    expect((await cli('--help')).code).toBe(0);
  });
});
