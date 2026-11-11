import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveProjectContext } from '../../packages/analyzer/src/kit/context.js';
import { generateKit } from '../../packages/analyzer/src/kit/kit.js';
import { packageKit } from '../../packages/analyzer/src/kit/package-kit.js';
import {
  RESPONSIVENESS_ASSET,
  RESPONSIVENESS_SOURCE,
  syncResponsiveness,
} from '../../scripts/agent-kit/responsiveness.mjs';
import { acmeWorkspace, repo } from './acme.js';

const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const temporaryRoot = () => {
  const root = mkdtempSync(join(tmpdir(), 'oddkin-responsiveness-'));
  temporary.push(root);
  return root;
};
const write = (root: string, path: string, text: string | object) => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof text === 'string' ? text : JSON.stringify(text));
};

describe('the shared responsiveness contract', () => {
  it('copies one authored source into both packages, while --check makes no writes', async () => {
    const root = temporaryRoot();
    const source =
      '# Responsiveness\n\nThe parent owns capacity; the component preserves meaning.\n';
    write(root, RESPONSIVENESS_SOURCE, source);
    for (const name of ['components', 'ai'])
      write(root, `packages/${name}/package.json`, { name: `@oddkin/${name}` });
    const componentAsset = `packages/components/${RESPONSIVENESS_ASSET}`;
    const aiAsset = `packages/ai/${RESPONSIVENESS_ASSET}`;
    write(root, componentAsset, 'previous guide\n');

    expect(await syncResponsiveness(root, { check: true })).toEqual({
      ok: false,
      changed: [componentAsset, aiAsset],
    });
    expect(readFileSync(join(root, componentAsset), 'utf8')).toBe('previous guide\n');
    expect(existsSync(join(root, aiAsset))).toBe(false);
    expect(readFileSync(join(root, RESPONSIVENESS_SOURCE), 'utf8')).toBe(source);

    expect((await syncResponsiveness(root)).ok).toBe(true);
    const copied = readFileSync(join(root, componentAsset), 'utf8');
    expect(copied).toContain(`Generated from ${RESPONSIVENESS_SOURCE}`);
    expect(copied.endsWith(source)).toBe(true);
    expect(readFileSync(join(root, aiAsset), 'utf8')).toBe(copied);
    expect(await syncResponsiveness(root, { check: true })).toEqual({ ok: true, changed: [] });

    write(root, RESPONSIVENESS_SOURCE, `${source}\nKeep the user's draft.\n`);
    expect((await syncResponsiveness(root, { check: true })).ok).toBe(false);
    expect(readFileSync(join(root, componentAsset), 'utf8')).toBe(copied);
    expect(readFileSync(join(root, aiAsset), 'utf8')).toBe(copied);
  });

  it('leaves unrelated workspaces and third-party package directories untouched', async () => {
    const root = temporaryRoot();
    write(root, 'packages/components/package.json', { name: '@acme/ui' });
    expect(await syncResponsiveness(root)).toEqual({ ok: true, changed: [] });
    write(root, RESPONSIVENESS_SOURCE, '# Local guide\n');
    expect(await syncResponsiveness(root)).toEqual({ ok: true, changed: [] });
    expect(existsSync(join(root, `packages/components/${RESPONSIVENESS_ASSET}`))).toBe(false);
    expect(existsSync(join(root, `packages/ai/${RESPONSIVENESS_ASSET}`))).toBe(false);
  });

  it('includes and fingerprints optional published guidance in project and packaged kits', async () => {
    const root = acmeWorkspace();
    temporary.push(root);
    const manifestPath = 'packages/ui/package.json';
    const manifest = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
    manifest.files = ['custom-elements.json', 'oddkin.metadata.json', RESPONSIVENESS_ASSET];
    write(root, manifestPath, manifest);
    const guide = '# Acme responsiveness\n\nThe host supplies a bounded editing region.\n';
    write(root, `packages/ui/${RESPONSIVENESS_ASSET}`, guide);

    const project = resolveProjectContext(root);
    const library = project.libraries.find((entry) => entry.name === '@acme/ui')!;
    expect(project.inputs.has(`packages/ui/${RESPONSIVENESS_ASSET}`)).toBe(true);
    const local = generateKit(project, library.name);
    const packaged = await packageKit(project, library);
    for (const result of [local, packaged]) {
      expect(result.files.get('references/responsiveness.md')).toBe(guide);
      expect(result.files.get('GUIDE.md')).toContain(
        'Responsiveness and host composition (authored): references/responsiveness.md.',
      );
      expect(result.manifest.entries).toContainEqual({
        id: 'responsiveness',
        path: 'references/responsiveness.md',
        kind: 'task',
        provenance: 'authored',
      });
      // Optional library-authored text is copied as written, not replaced with Oddkin APIs.
      expect(result.files.get('references/responsiveness.md')).not.toContain('odd-container');
    }
    expect(packaged.files.get('llms.txt')).toContain(
      '- [responsiveness](references/responsiveness.md)',
    );

    write(root, `packages/ui/${RESPONSIVENESS_ASSET}`, `${guide}\nPreserve focus.\n`);
    const changed = resolveProjectContext(root);
    const changedLibrary = changed.libraries.find((entry) => entry.name === library.name)!;
    const changedKit = await packageKit(changed, changedLibrary);
    expect(changedKit.manifest.fingerprint.inputs).not.toBe(packaged.manifest.fingerprint.inputs);
    expect(changedKit.files.get('references/responsiveness.md')).toContain('Preserve focus.');
  });

  it('does not invent responsiveness guidance for a package that supplies none', async () => {
    const root = acmeWorkspace();
    temporary.push(root);
    const project = resolveProjectContext(root);
    const library = project.libraries.find((entry) => entry.name === '@acme/ui')!;
    for (const result of [generateKit(project, library.name), await packageKit(project, library)]) {
      expect(result.files.has('references/responsiveness.md')).toBe(false);
      expect(result.manifest.entries.some((entry) => entry.id === 'responsiveness')).toBe(false);
      expect(result.files.get('GUIDE.md')).not.toContain('Responsiveness and host composition');
    }
  });

  it('keeps the canonical guide portable and distinguishes rules from test evidence', () => {
    const text = readFileSync(join(repo, RESPONSIVENESS_SOURCE), 'utf8');
    expect(text).toContain('https://oddkin.dev/foundations/responsive');
    expect(text).toContain('These labels are not a component API');
    expect(text).toContain('There is no universal minimum width');
    expect(text).toContain('A prior lab finding');
    expect(text).not.toMatch(/file:\/\/|C:\\|127\.0\.0\.1|77 components|361 examples/);
  });
});
