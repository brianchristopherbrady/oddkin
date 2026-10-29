import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../../packages/core/src/internal/version.js';

// One copy of core per install (plan P0.2; release-process.md §1): the runtime packages declare the
// packages whose identity must be shared (core; state for app; components for ai) as peers, so npm
// installs one copy or reports the conflict instead of nesting a second copy.
const manifest = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../packages/${name}/package.json`, import.meta.url), 'utf8'),
  ) as {
    version: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
const shared = {
  components: ['@oddkin/core'],
  state: ['@oddkin/core'],
  app: ['@oddkin/core', '@oddkin/state'],
  ai: ['@oddkin/components', '@oddkin/core'],
};

describe('single core', () => {
  for (const [name, peers] of Object.entries(shared))
    it(`@oddkin/${name} takes ${peers.join(' and ')} as peers, at the release's version`, () => {
      const pkg = manifest(name);
      expect(Object.keys(pkg.peerDependencies ?? {}).sort()).toEqual(peers);
      for (const peer of peers) expect(pkg.dependencies ?? {}).not.toHaveProperty(peer);
      for (const range of Object.values(pkg.peerDependencies ?? {}))
        expect(range).toBe(`^${manifest('core').version}`);
    });

  it("core's VERSION, which names both copies when two meet on a page, is its package version", () => {
    expect(VERSION).toBe(manifest('core').version);
  });
});
