import { describe, expect, it } from 'vitest';
import {
  atLeast,
  ciProblems,
  integrityOf,
  OIDC_DIST_TAG_NPM,
  renderSummary,
  tarballName,
  unverified,
} from '../../scripts/release/publish-ci.mjs';

const github = {
  GITHUB_ACTIONS: 'true',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.example',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token',
};

describe('publishing from the release workflow', () => {
  it('compares npm versions by their numbers', () => {
    expect(atLeast('11.21.0', OIDC_DIST_TAG_NPM)).toBe(true);
    expect(atLeast('11.21.2', '11.21.0')).toBe(true);
    expect(atLeast('12.0.0', '11.21.0')).toBe(true);
    expect(atLeast('11.19.1', '11.21.0')).toBe(false);
    expect(atLeast('11.9.0', '11.21.0')).toBe(false);
  });

  it('publishes only from GitHub Actions, with an npm that moves dist-tags and an OIDC token', () => {
    expect(ciProblems({ env: github, npmVersion: '11.21.2', live: true })).toEqual([]);
    expect(ciProblems({ env: {}, npmVersion: '11.21.2', live: false })).toEqual([
      '--ci runs only in GitHub Actions',
    ]);
    expect(ciProblems({ env: github, npmVersion: '11.19.1', live: false })).toEqual([
      `npm 11.19.1 cannot move dist-tags through trusted publishing; install npm ${OIDC_DIST_TAG_NPM} or later`,
    ]);
    // A dry run needs no token; a publish does.
    const noToken = { GITHUB_ACTIONS: 'true' };
    expect(ciProblems({ env: noToken, npmVersion: '11.21.2', live: false })).toEqual([]);
    expect(ciProblems({ env: noToken, npmVersion: '11.21.2', live: true })).toEqual([
      'no OIDC token: the publishing job needs `permissions: id-token: write`',
    ]);
  });

  it('names tarballs as npm pack does and hashes them as npm records them', () => {
    expect(tarballName('@oddkin/core', '1.0.0-beta.3')).toBe('oddkin-core-1.0.0-beta.3.tgz');
    expect(tarballName('plain', '2.0.0')).toBe('plain-2.0.0.tgz');
    // SHA-512 of no bytes, as npm's integrity strings write it.
    expect(integrityOf(new Uint8Array())).toBe(
      'sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==',
    );
  });

  it('publishes only the tarballs the verified evidence recorded', () => {
    const evidence = {
      packages: [
        { name: '@oddkin/core', version: '1.0.0', integrity: 'sha512-core' },
        { name: '@oddkin/state', version: '1.0.0', integrity: 'sha512-state' },
      ],
    };
    expect(
      unverified(evidence, [
        { spec: '@oddkin/core@1.0.0', integrity: 'sha512-core' },
        { spec: '@oddkin/state@1.0.0', integrity: 'sha512-state' },
      ]),
    ).toEqual([]);
    expect(
      unverified(evidence, [
        { spec: '@oddkin/core@1.0.0', integrity: 'sha512-other' },
        { spec: '@oddkin/app@1.0.0', integrity: 'sha512-app' },
      ]),
    ).toEqual(['@oddkin/core@1.0.0', '@oddkin/app@1.0.0']);
    expect(unverified(undefined, [{ spec: '@oddkin/core@1.0.0', integrity: 'x' }])).toEqual([
      '@oddkin/core@1.0.0',
    ]);
  });

  it('summarizes the run on its page', () => {
    const plan = [
      { name: '@oddkin/core', version: '1.0.0-beta.3', publish: true, latest: true },
      { name: '@oddkin/state', version: '1.0.0-beta.3', publish: false, latest: false },
    ];
    const dry = renderSummary(plan, { live: false });
    expect(dry).toContain('## Dry run');
    expect(dry).toContain('| @oddkin/core | 1.0.0-beta.3 | would publish | would move here |');
    expect(dry).toContain('| @oddkin/state | 1.0.0-beta.3 | already on npm, same contents | — |');
    expect(dry).toContain('Nothing was published.');
    const live = renderSummary(plan, { live: true });
    expect(live).toContain('## Published');
    expect(live).toContain('| @oddkin/core | 1.0.0-beta.3 | published | moved here |');
    expect(live).toContain('provenance');
  });
});
