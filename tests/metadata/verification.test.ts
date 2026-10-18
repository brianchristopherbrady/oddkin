import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { implementationHash } from '../../scripts/verification.mjs';

// The Node-side hash must change with every file the contract test runs, and only with those.
const root = mkdtempSync(join(tmpdir(), 'oddkin-verification-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const write = (path: string, text: string) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
};
write('packages/components/src/button/button.ts', 'export class A {}');
write('packages/core/dist/element/index.js', 'export const core = 1;');
write('packages/core/dist/prod/element/index.js', 'export const prod = 1;');
write('packages/tokens/dist/refs/index.js', 'export const refs = 1;');
write('packages/components/README.md', 'docs');
const hash = () => implementationHash(root, join(root, 'packages/components'));

describe('implementationHash', () => {
  it('changes with component sources and the core and tokens development builds', () => {
    const base = hash();
    expect(base).toMatch(/^sha256-[0-9a-f]{64}$/);
    for (const [path, text] of [
      ['packages/components/src/button/button.ts', 'export class B {}'],
      ['packages/core/dist/element/index.js', 'export const core = 2;'],
      ['packages/tokens/dist/refs/index.js', 'export const refs = 2;'],
      ['packages/components/src/card/card.ts', 'export class C {}'],
    ] as const) {
      const before = hash();
      write(path, text);
      expect(hash(), path).not.toBe(before);
    }
  });

  it('ignores files the contract test does not run', () => {
    const before = hash();
    write('packages/core/dist/prod/element/index.js', 'export const prod = 2;');
    write('packages/components/README.md', 'changed');
    write('packages/core/dist/element/index.d.ts', 'export {};');
    expect(hash()).toBe(before);
  });

  it('covers exactly the dependency builds a package declares', () => {
    const ai = join(root, 'packages/ai');
    write('packages/ai/src/response/response.ts', 'export class R {}');
    const withComponents = () => implementationHash(root, ai, ['core', 'tokens', 'components']);
    const before = [implementationHash(root, ai), withComponents()];
    write('packages/components/dist/button/index.js', 'export const button = 1;');
    expect([implementationHash(root, ai), withComponents()]).toEqual([
      before[0],
      expect.not.stringMatching(before[1] as string),
    ]);
  });
});
