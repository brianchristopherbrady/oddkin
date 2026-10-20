/**
 * The `oddkin` command (workbench.md §10): `analyze` runs `@oddkin/analyzer`'s own command with
 * the same arguments, and `workbench dev` serves the Workbench with live updates.
 * Exit codes: 0 success, 1 errors, 2 usage errors.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { GeneratedDirectoryError } from './generated.js';
import { DEFAULT_PORT, DevServerError, startDevServer, type DevServer } from './server.js';
import { formatDiagnostic, WORKBENCH_DIR } from './workbench.js';

export interface CliIO {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  /** Ends a long-running command (`workbench dev`); the bin aborts it on SIGINT and SIGTERM. */
  readonly signal?: AbortSignal;
  /** Let delegated commands write to this process's terminal directly (the bin sets it). */
  readonly inherit?: boolean;
  /** Receives the dev server once it listens. */
  readonly onServer?: (server: DevServer) => void;
}

export const USAGE = `Usage:
  oddkin analyze <tsconfig.json> [options]   Analyze a component library with @oddkin/analyzer
                                             (the options of oddkin-analyze; "oddkin analyze --help")
  oddkin workbench dev [--config <file or directory>] [--port <number>] [--host <name>] [--no-watch]
                                             Serve the Workbench with live updates (port ${DEFAULT_PORT})
  oddkin --help | --version`;

const version = () =>
  (JSON.parse(readFileSync(join(WORKBENCH_DIR, 'package.json'), 'utf8')) as { version: string })
    .version;

/** The analyzer's command, resolved from this package like any dependency. */
export function analyzerBin(): string {
  const require = createRequire(join(WORKBENCH_DIR, 'package.json'));
  const manifest = require.resolve('@oddkin/analyzer/package.json');
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8')) as { bin: Record<string, string> };
  return join(dirname(manifest), bin['oddkin-analyze'] as string);
}

function analyze(args: readonly string[], io: CliIO): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [analyzerBin(), ...args], {
      stdio: io.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    const stop = () => child.kill();
    io.signal?.addEventListener('abort', stop, { once: true });
    child.on('close', (code) => {
      io.signal?.removeEventListener('abort', stop);
      if (stdout.trim()) io.out(stdout.trimEnd());
      if (stderr.trim()) io.err(stderr.trimEnd());
      resolve(code ?? 1);
    });
  });
}

async function dev(args: readonly string[], io: CliIO): Promise<number> {
  let values: {
    config?: string;
    port?: string;
    host?: string;
    'no-watch'?: boolean;
    help?: boolean;
  };
  try {
    ({ values } = parseArgs({
      args: [...args],
      options: {
        config: { type: 'string' },
        port: { type: 'string' },
        host: { type: 'string' },
        'no-watch': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    return 2;
  }
  if (values.help) {
    io.out(USAGE);
    return 0;
  }
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!/^\d+$/.test(values.port ?? '0') || port > 65535) {
    io.err(`--port must be a whole number from 0 to 65535.\n${USAGE}`);
    return 2;
  }
  let server: DevServer;
  try {
    server = await startDevServer({
      ...(values.config ? { config: values.config } : {}),
      port,
      ...(values.host ? { host: values.host } : {}),
      watch: !values['no-watch'],
      log: (line) => io.out(line),
    });
  } catch (error) {
    if (error instanceof DevServerError) {
      for (const d of error.diagnostics) io.err(formatDiagnostic(d));
      io.err(error.message);
      return 1;
    }
    if (error instanceof GeneratedDirectoryError) {
      io.err(`error ${error.code}: ${error.message}`);
      return 1;
    }
    if ((error as { code?: unknown }).code === 'EADDRINUSE') {
      io.err(`error: port ${port} is in use; choose another with --port.`);
      return 1;
    }
    throw error;
  }
  for (const d of server.build.diagnostics)
    (d.severity === 'error' ? io.err : io.out)(formatDiagnostic(d));
  io.out(`Workbench: ${server.url}`);
  io.onServer?.(server);
  await new Promise<void>((resolve) => {
    if (io.signal?.aborted) resolve();
    else io.signal?.addEventListener('abort', () => resolve(), { once: true });
  });
  await server.close();
  return 0;
}

/** Run `oddkin` with `args`; resolves with the exit code. */
export async function run(args: readonly string[], io: CliIO): Promise<number> {
  const [command, ...rest] = args;
  if (command === '--help' || command === '-h') {
    io.out(USAGE);
    return 0;
  }
  if (command === '--version') {
    io.out(version());
    return 0;
  }
  if (command === 'analyze') return analyze(rest, io);
  if (command === 'workbench' && rest[0] === 'dev') return dev(rest.slice(1), io);
  io.err(
    command === undefined
      ? USAGE
      : `Unknown command "${[command, ...(command === 'workbench' ? rest.slice(0, 1) : [])].join(' ')}".\n${USAGE}`,
  );
  return 2;
}
