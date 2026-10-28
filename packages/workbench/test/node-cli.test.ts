import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { run, type DevServer } from '../src/node/index.js';
import { acmeProject, makeProject, removeProject } from './node-project.js';

const projects: string[] = [];
const track = (dir: string) => (projects.push(dir), dir);
afterAll(() => projects.forEach(removeProject));
const { version } = JSON.parse(readFileSync('packages/workbench/package.json', 'utf8')) as {
  version: string;
};

async function cli(
  args: string[],
  extra: { signal?: AbortSignal; onServer?: (s: DevServer) => void } = {},
) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, { out: (t) => out.push(t), err: (t) => err.push(t), ...extra });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

/** The built command in a real Node process (no Vite transform of TypeScript configs). */
function bin(args: string[]) {
  const child = spawn(process.execPath, ['packages/workbench/dist/node/bin.js', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (err += chunk));
  const exit = new Promise<number | null>((resolve) => child.on('close', resolve));
  return { child, exit, output: () => ({ out, err }) };
}

describe('the oddkin command', { timeout: 60_000 }, () => {
  it('prints usage and its version, and rejects unknown commands with exit code 2', async () => {
    const help = await cli(['--help']);
    expect(help.code).toBe(0);
    expect(help.out).toContain('oddkin workbench dev');
    expect(help.out).toContain('oddkin analyze');
    expect((await cli(['--version'])).out).toBe(version);
    for (const args of [[], ['nope'], ['workbench'], ['workbench', 'serve']]) {
      const result = await cli(args);
      expect(result.code, args.join(' ')).toBe(2);
      expect(result.err, args.join(' ')).toContain('Usage:');
    }
    expect((await cli(['workbench', 'serve'])).err).toContain('Unknown command "workbench serve"');
  });

  it('delegates analyze to @oddkin/analyzer, passing arguments and exit codes through', async () => {
    const help = await cli(['analyze', '--help']);
    expect(help.code).toBe(0);
    expect(help.out).toContain('Usage: oddkin-analyze <tsconfig.json>');
    expect((await cli(['analyze'])).code).toBe(2);
    const missing = await cli(['analyze', 'missing/tsconfig.json']);
    expect(missing.code).toBe(1);
    expect(missing.err).toContain('Cannot read missing/tsconfig.json');

    const out = track(makeProject({ 'keep.txt': '' }));
    const analyzed = await cli(['analyze', 'examples/core-counter/tsconfig.json', '--out', out]);
    expect(analyzed.code, analyzed.err).toBe(0);
    const cem = JSON.parse(readFileSync(join(out, 'custom-elements.json'), 'utf8'));
    expect(JSON.stringify(cem)).toContain('"tagName":"demo-counter"');
    expect(existsSync(join(out, 'oddkin.metadata.json'))).toBe(true);
  });

  it('runs workbench dev until stopped', async () => {
    const dir = track(acmeProject());
    const controller = new AbortController();
    let server: DevServer | undefined;
    const running = cli(['workbench', 'dev', '--config', dir, '--port', '0', '--no-watch'], {
      signal: controller.signal,
      onServer: (s) => (server = s),
    });
    await expect.poll(() => server, { timeout: 20_000 }).toBeDefined();
    const response = await fetch(new URL('_oddkin/index.json', server!.url));
    expect(response.status).toBe(200);
    controller.abort();
    const result = await running;
    expect(result.code).toBe(0);
    expect(result.out).toContain(`Workbench: ${server!.url}`);
    await expect(fetch(new URL('_oddkin/index.json', server!.url))).rejects.toThrow();
  });

  it('reports usage errors, configuration errors, and a busy port', async () => {
    for (const args of [['--port', 'abc'], ['--port', '70000'], ['--port', '-1'], ['--bogus']])
      expect((await cli(['workbench', 'dev', ...args])).code, args.join(' ')).toBe(2);
    const bad = track(makeProject({ 'oddkin.config.json': '{ "library": { "packages": [] } }' }));
    const invalid = await cli(['workbench', 'dev', '--config', bad, '--port', '0']);
    expect(invalid.code).toBe(1);
    expect(invalid.err).toContain('error config.library.missing /library/packages:');

    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, 'localhost', resolve));
    const { port } = blocker.address() as { port: number };
    try {
      const busy = await cli([
        'workbench',
        'dev',
        '--config',
        track(acmeProject()),
        '--port',
        String(port),
      ]);
      expect(busy.code).toBe(1);
      expect(busy.err).toContain(`port ${port} is in use`);
    } finally {
      blocker.close();
    }
  });

  it('loads a TypeScript configuration with Node’s type stripping, and explains what it cannot strip', async () => {
    const dir = track(acmeProject());
    const ok = bin(['workbench', 'dev', '--config', dir, '--port', '0', '--no-watch']);
    await expect
      .poll(() => /Workbench: (\S+)/.exec(ok.output().out)?.[1], { timeout: 30_000 })
      .toBeDefined();
    const url = /Workbench: (\S+)/.exec(ok.output().out)![1]!;
    const index = await (await fetch(new URL('_oddkin/index.json', url))).json();
    expect(index.branding.name).toBe('Acme UI');
    ok.child.kill();
    await ok.exit;

    const enumConfig = track(
      makeProject({
        'package.json': '{ "type": "module" }',
        'oddkin.config.ts':
          "enum Mode { A }\nexport default { library: { packages: ['x'] }, mode: Mode.A };\n",
      }),
    );
    const failed = bin(['workbench', 'dev', '--config', enumConfig, '--port', '0']);
    expect(await failed.exit).toBe(1);
    expect(failed.output().err).toContain('error node.config.load');
    expect(failed.output().err).toContain('erasable syntax only');
  });
});
