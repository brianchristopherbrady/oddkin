import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { GeneratedDirectoryError, MARKER, writeGenerated } from '../src/node/index.js';
import { makeProject, removeProject } from './node-project.js';

const projects: string[] = [];
const project = (files: Record<string, string> = {}) => {
  const dir = makeProject({ 'authored.txt': 'mine\n', ...files });
  projects.push(dir);
  return dir;
};
afterAll(() => projects.forEach(removeProject));

const files = (entries: Record<string, string>) => new Map(Object.entries(entries));
const list = (dir: string, prefix = ''): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );

describe('the generated directory', () => {
  it('creates the directory with its marker and the files', async () => {
    const root = project();
    const dir = join(root, '.oddkin', 'workbench');
    const result = await writeGenerated(
      dir,
      files({ 'index.json': '{}\n', 'pages/a/b.json': '1\n' }),
    );
    expect(result).toEqual({ written: ['index.json', 'pages/a/b.json'], removed: [] });
    expect(list(dir).sort()).toEqual(['index.json', MARKER, 'pages/a/b.json']);
    const marker = JSON.parse(readFileSync(join(dir, MARKER), 'utf8'));
    expect(marker.generator).toBe('@oddkin/workbench');
    expect(JSON.stringify(marker)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('mine\n');
  });

  it('rewrites only changed files and removes files a run no longer produces', async () => {
    const dir = join(project(), 'out');
    await writeGenerated(dir, files({ 'a.json': 'a', 'b.json': 'b', 'old/x.json': 'x' }));
    const past = new Date('2020-01-01T00:00:00Z');
    utimesSync(join(dir, 'a.json'), past, past);
    const result = await writeGenerated(
      dir,
      files({ 'a.json': 'a', 'b.json': 'B', 'new.json': 'n' }),
    );
    expect(result).toEqual({ written: ['b.json', 'new.json'], removed: ['old/x.json'] });
    expect(statSync(join(dir, 'a.json')).mtime.getTime()).toBe(past.getTime());
    expect(readFileSync(join(dir, 'b.json'), 'utf8')).toBe('B');
    // Emptied directories go too.
    expect(existsSync(join(dir, 'old'))).toBe(false);
    expect(list(dir).sort()).toEqual(['a.json', 'b.json', MARKER, 'new.json'].sort());
  });

  it('refuses a directory it did not create, and leaves it untouched', async () => {
    const root = project({ 'mine/notes.md': 'keep\n' });
    const dir = join(root, 'mine');
    const error = await writeGenerated(dir, files({ 'index.json': '{}' })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeneratedDirectoryError);
    expect((error as GeneratedDirectoryError).code).toBe('node.generated.unmarked');
    expect(list(dir)).toEqual(['notes.md']);
    // A file in place of the directory is refused too.
    const file = join(root, 'authored.txt');
    await expect(writeGenerated(file, files({ 'a.json': '1' }))).rejects.toMatchObject({
      code: 'node.generated.unmarked',
    });
    expect(readFileSync(file, 'utf8')).toBe('mine\n');
    // An empty directory is adopted.
    mkdirSync(join(root, 'empty'));
    await writeGenerated(join(root, 'empty'), files({ 'a.json': '1' }));
    expect(list(join(root, 'empty')).sort()).toEqual(['a.json', MARKER]);
  });

  it('writes nowhere outside the directory', async () => {
    const root = project();
    const dir = join(root, 'out');
    for (const path of [
      '../escape.json',
      'a/../../escape.json',
      '/abs.json',
      'C:/x.json',
      'a\\b.json',
      'a//b.json',
      './a.json',
      '',
      MARKER,
    ]) {
      await expect(writeGenerated(dir, files({ [path]: 'x' })), path).rejects.toMatchObject({
        code: 'node.generated.path',
      });
    }
    // Nothing was created by the refused calls.
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(join(root, 'escape.json'))).toBe(false);
  });

  it('removes a stale link without following it', async () => {
    const root = project({ 'target/keep.json': 'keep' });
    const dir = join(root, 'out');
    await writeGenerated(dir, files({ 'a.json': '1' }));
    symlinkSync(join(root, 'target'), join(dir, 'linked'), 'junction');
    writeFileSync(join(dir, 'stale.json'), 'old');
    const result = await writeGenerated(dir, files({ 'a.json': '1' }));
    expect(result.removed.sort()).toEqual(['linked', 'stale.json']);
    expect(readFileSync(join(root, 'target', 'keep.json'), 'utf8')).toBe('keep');
    expect(list(dir).sort()).toEqual(['a.json', MARKER]);
  });
});
