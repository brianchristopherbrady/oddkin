import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generate } from '../src/index.js';
import { run } from '../src/node/cli.js';
import { loadConfig } from '../src/node/index.js';

// Inside the repository so `@oddkin/tokens` resolves for JS and TS configs.
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

// Loading TypeScript configs starts Node processes; allow for a busy machine.
describe('oddkin-tokens CLI', { timeout: 30_000 }, () => {
  it('init writes a starter config once', async () => {
    expect((await cli('init', at('oddkin.theme.json'))).code).toBe(0);
    const again = await cli('init', at('oddkin.theme.json'));
    expect(again.code).toBe(1);
    expect(again.err).toContain('already exists');
    expect((await cli('check', at('oddkin.theme.json'))).code).toBe(0);
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
    const body = `import { defineTheme } from '@oddkin/tokens/theme';\nexport default defineTheme({ name: 'typed', brand: { primary: '#0f766e' } });\n`;
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

  it('loads JS and TS configs as their JSON model, naming each value JSON cannot hold', async () => {
    await writeFile(
      at('model.mjs'),
      "export default { brand: { primary: '#0f766e', neutral: undefined }, modes: ['light', 'dark'], zero: -0 };\n",
    );
    const loaded = await loadConfig(at('model.mjs'));
    expect(loaded.diagnostics).toEqual([]);
    // What JSON.parse(JSON.stringify(config)) gives: undefined properties dropped, -0 written as 0.
    expect(loaded.config).toStrictEqual({
      brand: { primary: '#0f766e' },
      modes: ['light', 'dark'],
      zero: 0,
    });
    expect(Object.is((loaded.config as { zero: number }).zero, 0)).toBe(true);

    await writeFile(
      at('not-json.mjs'),
      [
        "const config = { brand: { primary: '#0f766e' }, products: new Map(), modes: ['light', , 'dark'],",
        '  density: { compact: { scale: Number.NaN }, tight: { scale: () => 0.5 } },',
        "  overrides: { 'radius.md': 1n }, status: [undefined] };",
        'config.self = { config };',
        'export default config;',
      ].join('\n'),
    );
    const bad = await loadConfig(at('not-json.mjs'));
    expect(bad.config).toBeUndefined();
    expect(bad.diagnostics.map((d) => [d.code, d.severity, d.path])).toEqual([
      ['config.notJson', 'error', '/products'],
      ['config.notJson', 'error', '/modes/1'],
      ['config.notJson', 'error', '/density/compact/scale'],
      ['config.notJson', 'error', '/density/tight/scale'],
      ['config.notJson', 'error', '/overrides/radius.md'],
      ['config.notJson', 'error', '/status/0'],
      ['config.notJson', 'error', '/self/config'],
    ]);
    expect(bad.diagnostics.map((d) => d.message.replace(/^.*?: /, ''))).toEqual([
      'A Map object is not JSON data.',
      'An empty array slot is not JSON data.',
      'The number NaN is not JSON data.',
      'A value of type function is not JSON data.',
      'A value of type bigint is not JSON data.',
      'A value of type undefined is not JSON data.',
      'A reference back to an enclosing value (a cycle) is not JSON data.',
    ]);
    const check = await cli('check', at('not-json.mjs'));
    expect([check.code, check.err.includes('error config.notJson /density/tight/scale')]).toEqual([
      1,
      true,
    ]);

    // A shared (acyclic) value is copied wherever it appears, as JSON does.
    await writeFile(
      at('shared.mjs'),
      "const brand = { primary: '#0f766e' };\nexport default { brand, products: { clinic: { brand } } };\n",
    );
    expect((await loadConfig(at('shared.mjs'))).config).toStrictEqual({
      brand: { primary: '#0f766e' },
      products: { clinic: { brand: { primary: '#0f766e' } } },
    });

    // JSON.parse keeps "__proto__" as an own key; so does the model, and the generator rejects it.
    await writeFile(
      at('proto.json'),
      '{ "brand": { "primary": "#000" }, "__proto__": { "polluted": true } }',
    );
    const proto = await loadConfig(at('proto.json'));
    expect(Object.hasOwn(proto.config as object, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(proto.config)).toBe(Object.prototype);
    expect((await cli('check', at('proto.json'))).err).toContain('config.unknownKey /__proto__');
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

  it('--css-layer chooses the cascade layer or unlayered output', async () => {
    const config = { name: 'layers', brand: { primary: '#5b46e8' } };
    await writeFile(at('layers.json'), JSON.stringify(config));
    const none = await cli(
      'build',
      at('layers.json'),
      '--out',
      at('none'),
      '--format',
      'css',
      '--css-layer',
      'none',
    );
    expect(none.code).toBe(0);
    expect(await readFile(at('none/layers.css'), 'utf8')).toBe(
      generate(config, { css: { layer: false } }).css,
    );
    const vendor = await cli(
      'build',
      at('layers.json'),
      '--out',
      at('vendor'),
      '--format',
      'css',
      '--css-layer',
      'vendor.theme',
    );
    expect(vendor.code).toBe(0);
    expect(await readFile(at('vendor/layers.css'), 'utf8')).toContain('@layer vendor.theme {');
    expect((await cli('build', at('layers.json'), '--css-layer', 'not a layer')).code).toBe(2);
  });
});
