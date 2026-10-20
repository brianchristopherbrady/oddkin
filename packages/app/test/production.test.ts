// Production build (dist/prod) of @oddkin/app: same modules and exports as the development build,
// failures keep their stable codes, development explanations are not shipped (ADR 0031).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const dist = join(packageDir, 'dist');
const prod = join(dist, 'prod');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
  exports: Record<string, string | { types: string; development: string; default: string }>;
};

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? entry.name === 'prod' && dir === dist
        ? []
        : files(join(dir, entry.name))
      : entry.name.endsWith('.js')
        ? [join(dir, entry.name)]
        : [],
  );

describe('@oddkin/app production build', { timeout: 60_000 }, () => {
  it('mirrors every development module', () => {
    const dev = files(dist).map((f) => relative(dist, f));
    const production = files(prod).map((f) => relative(prod, f));
    expect(production.sort()).toEqual(dev.sort());
  });

  it('maps "development" to dist/ and "default" to dist/prod/ for every entry', () => {
    for (const [key, target] of Object.entries(manifest.exports)) {
      if (typeof target === 'string') continue;
      expect(Object.keys(target), key).toEqual(['types', 'development', 'default']);
      expect(target.default, key).toBe(target.development.replace('./dist/', './dist/prod/'));
    }
  });

  it('exports the same names from each entry in both builds', async () => {
    for (const target of Object.values(manifest.exports)) {
      if (typeof target === 'string') continue;
      const dev = await import(pathToFileURL(join(packageDir, target.development)).href);
      const production = await import(pathToFileURL(join(packageDir, target.default)).href);
      expect(Object.keys(production).sort(), target.default).toEqual(Object.keys(dev).sort());
    }
  });

  it('keeps stable codes but not development explanations', async () => {
    type AppModule = typeof import('../src/app/index.js');
    const fail = (api: AppModule) => {
      const app = api.createApp({
        name: 'shop',
        setup({ app: self }) {
          self.start();
        },
      });
      try {
        app.start();
      } catch (error) {
        return error as { code: string; message: string; name: string };
      }
      throw new Error('expected a failure');
    };
    const devError = fail(await import(pathToFileURL(join(dist, 'app/index.js')).href));
    const prodError = fail(await import(pathToFileURL(join(prod, 'app/index.js')).href));
    expect(devError.code).toBe('app.lifecycle.reentrant');
    expect(prodError.code).toBe('app.lifecycle.reentrant');
    expect(prodError.name).toBe('OddkinError');
    expect(devError.message).toContain('do not run inside setup()');
    expect(prodError.message).toBe(
      '[app.lifecycle.reentrant] Use the development build (the "development" export condition) for details.',
    );
  });

  it('keeps command codes but not their explanations', async () => {
    type CommandModule = typeof import('../src/command/index.js');
    const failures = (api: CommandModule) => {
      const caught: { code: string; message: string }[] = [];
      for (const attempt of [
        () => api.command({ run: () => 1 }).run(),
        () => api.command({ run: () => 1, retry: { retries: 1 } as never }),
      ]) {
        try {
          attempt();
        } catch (error) {
          caught.push(error as { code: string; message: string });
        }
      }
      return caught;
    };
    const dev = failures(await import(pathToFileURL(join(dist, 'command/index.js')).href));
    const production = failures(await import(pathToFileURL(join(prod, 'command/index.js')).href));
    expect(dev.map((e) => e.code)).toEqual(['app.command.disconnected', 'app.command.options']);
    expect(production.map((e) => e.code)).toEqual(dev.map((e) => e.code));
    expect(dev[0]!.message).toContain('Connect it with scope.use(command) first');
    expect(dev[1]!.message).toContain('which failures are safe to repeat');
    for (const error of production) expect(error.message).toContain('Use the development build');
  });

  it('contains no development messages or DEV references', async () => {
    const source = files(prod)
      .filter((f) => !f.endsWith(join('internal', 'dev.js')))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    for (const fragment of [
      'do not run inside setup()',
      'already belongs to the running application',
      'has no root to provide context',
      'resource() timeout must be',
      'Connect it with scope.use(command) first',
      'which failures are safe to repeat',
      'retry delay must be a number',
      'concurrency must be',
    ]) {
      expect(source).not.toContain(fragment);
    }
    expect(source).not.toMatch(/\bDEV\b/);
    const flag = await import(pathToFileURL(join(prod, 'internal/dev.js')).href);
    expect(flag.DEV).toBe(false);
  });

  it('resolves to production by default and to development with --conditions=development', () => {
    const resolve = (...flags: string[]) =>
      execFileSync(
        process.execPath,
        [
          ...flags,
          '--input-type=module',
          '-e',
          "console.log(import.meta.resolve('@oddkin/app/app'))",
        ],
        { cwd: packageDir, encoding: 'utf8' },
      ).trim();
    expect(resolve()).toMatch(/\/dist\/prod\/app\/index\.js$/);
    expect(resolve('--conditions=development')).toMatch(/\/dist\/app\/index\.js$/);
  });
});
