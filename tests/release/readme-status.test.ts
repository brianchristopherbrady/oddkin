import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkReadme,
  readFacts,
  readmes,
  type ReadmeFacts,
} from '../../scripts/check-readme-status.mjs';

// RF-02 (docs/commercialization/release-foundation-plan.md): README status claims against the
// manifests, the metadata, and the `bin` maps. Stale fixture text fails; current text passes.
const root = fileURLToPath(new URL('../..', import.meta.url));
const version = '1.0.0-beta.1';
const facts: ReadmeFacts = {
  packages: {
    '@oddkin/core': { dir: 'core', version, peers: [] },
    '@oddkin/components': { dir: 'components', version, peers: ['@oddkin/core'] },
    '@oddkin/ai': { dir: 'ai', version, peers: ['@oddkin/components', '@oddkin/core'] },
  },
  bins: ['oddkin', 'oddkin-analyze', 'oddkin-impact', 'oddkin-kit', 'oddkin-tokens'],
  counts: { '@oddkin/components': 54, '@oddkin/ai': 24 },
  floor: { chrome: '130', edge: '130', firefox: '132', safari: '18.2' },
};
const messages = (text: string, name?: string) =>
  checkReadme(text, facts, name).map(({ line, message }) => `${line}: ${message}`);

describe('the README status check', () => {
  it('fails on a milestone status', () => {
    expect(messages('# @oddkin/tokens\n\n**Status:** M2 in progress.', '@oddkin/core')).toEqual([
      '3: says "M2 in progress": a status comes from the manifests and metadata, not from a milestone',
    ]);
  });

  it('fails on a version the manifests do not have, and passes on theirs and on the 1.0.0 line', () => {
    expect(
      messages(
        [
          'The current release is a beta (`1.0.0-beta.0`).',
          'Workbench is versioned `1.0.0` with the other packages.',
          '```sh\nnpm install @oddkin/core@1.0.0\n```',
        ].join('\n'),
        '@oddkin/core',
      ),
    ).toEqual([
      '1: says 1.0.0-beta.0; the manifests are at 1.0.0-beta.1',
      '2: says the package is versioned 1.0.0; its manifest is at 1.0.0-beta.1',
      '4: pins @oddkin/core@1.0.0; its manifest is at 1.0.0-beta.1',
    ]);
    expect(
      messages(
        'The current release is a beta (`1.0.0-beta.1`): contracts may still change before 1.0.0. `npm install @oddkin/core@beta`.',
        '@oddkin/core',
      ),
    ).toEqual([]);
    // The root README documents no single package: its version is the one they share.
    expect(messages('Oddkin `1.0.0-beta.1` is a beta.')).toEqual([]);
  });

  it('fails on an element count the metadata does not have', () => {
    expect(
      messages(
        '**Status:** beta. 53 elements, each in `custom-elements.json`.',
        '@oddkin/components',
      ),
    ).toEqual(['1: says "53 elements"; @oddkin/components\'s metadata lists 54 elements']);
    expect(messages('`@oddkin/components` has 54 elements and `@oddkin/ai` 23.')).toEqual([
      "1: says `@oddkin/ai` 23; @oddkin/ai's metadata lists 24 elements",
    ]);
    expect(messages('24 AI elements and 54 component elements.')).toEqual([]);
  });

  it('fails on a command no bin provides, in prose about commands and in shell blocks', () => {
    expect(
      messages(
        [
          'Command-line tools include `oddkin-tokens` and `oddkin-agent`.',
          'Templates work under Trusted Types (`oddkin-template` policy).',
          '```sh\nnpx oddkin-agent run\noddkin-kit package --check\n```',
          '```text\noddkin-agent is only text here\n```',
          'After a closed block, the CLI `oddkin-agent` is checked again.',
        ].join('\n'),
      ),
    ).toEqual([
      "1: names the command `oddkin-agent`, which no package's `bin` provides (oddkin, oddkin-analyze, oddkin-impact, oddkin-kit, oddkin-tokens)",
      "4: names the command `oddkin-agent`, which no package's `bin` provides (oddkin, oddkin-analyze, oddkin-impact, oddkin-kit, oddkin-tokens)",
      "10: names the command `oddkin-agent`, which no package's `bin` provides (oddkin, oddkin-analyze, oddkin-impact, oddkin-kit, oddkin-tokens)",
    ]);
  });

  it('fails on a peer described as a dependency, and passes on peers named as peers', () => {
    expect(
      messages(
        'Depends on `@oddkin/core`, `@oddkin/tokens`, and `@oddkin/components`.',
        '@oddkin/ai',
      ),
    ).toEqual([
      '1: describes @oddkin/core as a dependency; it is a peer dependency of @oddkin/ai',
      '1: describes @oddkin/components as a dependency; it is a peer dependency of @oddkin/ai',
    ]);
    expect(messages('`@oddkin/core` is a runtime dependency.', '@oddkin/ai')).toEqual([
      '1: describes @oddkin/core as a dependency; it is a peer dependency of @oddkin/ai',
    ]);
    expect(
      messages(
        '`@oddkin/core` and `@oddkin/components` are peer dependencies, which npm installs with it. `@oddkin/tokens` is a dependency. It depends on `@oddkin/core` as a peer.',
        '@oddkin/ai',
      ),
    ).toEqual([]);
  });

  it('fails on a supported browser version that is not the floor (RF-04)', () => {
    expect(
      messages(
        [
          '- Supported browsers: Chrome and Edge 129, Firefox 131, Safari 18.2 and later.',
          '```sh\nnpm run compat:floor   # install Chrome 129 and Firefox 132\n```',
        ].join('\n'),
      ),
    ).toEqual([
      '1: names Chrome 129 as supported; the floor is Chrome 130 (docs/compatibility/features.json)',
      '1: names Edge 129 as supported; the floor is Edge 130 (docs/compatibility/features.json)',
      '1: names Firefox 131 as supported; the floor is Firefox 132 (docs/compatibility/features.json)',
      '3: names Chrome 129 as supported; the floor is Chrome 130 (docs/compatibility/features.json)',
    ]);
    expect(
      messages(
        'Supported browsers: Chrome and Edge 130, Firefox 132, Safari 18.2. The tests ran in Firefox 157.',
      ),
    ).toEqual([]);
  });

  it('fails on an accessibility claim that does not say screen readers are unverified (RF-03)', () => {
    expect(
      messages(
        [
          'Accessible, themed custom elements.',
          'The elements are WCAG 2.2 AA compliant.',
          'Themeable custom elements, tested with keyboard checks and axe-core (screen readers not yet verified).',
          'Accessible components; screen readers are not yet verified.',
          'Each icon button needs an accessible name.',
          'Every element conforms to WCAG 2.2.',
        ].join('\n'),
      ),
    ).toEqual([
      '1: says "Accessible, themed" without saying that screen readers are not yet verified (RF-03; docs/support.md#accessibility)',
      '2: says "WCAG 2.2 AA compliant" without saying that screen readers are not yet verified (RF-03; docs/support.md#accessibility)',
      '6: says "conforms to WCAG" without saying that screen readers are not yet verified (RF-03; docs/support.md#accessibility)',
    ]);
  });

  it("passes on the repository's READMEs, each read with its package's facts", () => {
    const real = readFacts(root);
    const core = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8'));
    expect(real.packages['@oddkin/core']?.version).toBe(core.version);
    expect(real.packages['@oddkin/ai']?.peers).toContain('@oddkin/core');
    expect(real.counts['@oddkin/components']).toBeGreaterThan(0);
    expect(real.counts['@oddkin/ai']).toBeGreaterThan(0);
    expect(real.bins).toContain('oddkin-tokens');
    const features = JSON.parse(
      readFileSync(join(root, 'docs/compatibility/features.json'), 'utf8'),
    );
    expect(real.floor).toEqual(features.floor);
    const files = readmes(root, real);
    expect(files.map(({ name }) => name)).toEqual([undefined, ...Object.keys(real.packages)]);
    expect(files[0]?.path).toBe(join(root, 'README.md'));
    for (const { path, name } of files)
      expect(checkReadme(readFileSync(path, 'utf8'), real, name), path).toEqual([]);
  });
});
