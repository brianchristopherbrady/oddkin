/**
 * `oddkin-kit` commands, kept free of a shebang so tests can import them.
 *
 *   oddkin-kit [--root <dir>] [--package <name>]... [--out <dir>] [--theme-config <file>] [--check]
 *   oddkin-kit package [--root <dir>] [--package <name>]... [--check]
 *   oddkin-kit agents-md [--root <dir>] [--write | --check]
 *   oddkin-kit llms --base <url> --out <dir> [--root <dir>] [--package <name>]... [--title <text>]
 *                   [--summary <text>]
 *
 * Exit codes: 0 success; 1 a stale, missing, or over-budget kit, or a stale AGENTS.md section;
 * 2 usage error.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { lineDiff, renderSection, updateAgentsMd } from './agents-md.js';
import { resolveProjectContext, type Project } from './context.js';
import { checkKit, generateKit, kitDirName, refreshCommand, writeKit } from './kit.js';
import { siteLlmsText, type SiteKit } from './llms.js';
import { packageKit } from './package-kit.js';

export const USAGE = `Usage:
  oddkin-kit [--root <dir>] [--package <name>]... [--out <dir>] [--theme-config <file>] [--check]
      Write each library's agent kit into <out>/<name>/ (default .oddkin/agent-kit): the
      workspace's own libraries, or those named with --package. --check reports stale or
      missing kits instead.
  oddkin-kit package [--root <dir>] [--package <name>]... [--check]
      Write the kit each component package ships into <package>/agent/: the workspace's own
      packages, or those named with --package. --check regenerates each kit and compares it
      with the files there, installed packages included.
  oddkin-kit agents-md [--root <dir>] [--write | --check]
      Show, write, or check the managed section of the workspace's AGENTS.md.
  oddkin-kit llms --base <url> --out <dir> [--root <dir>] [--package <name>]... [--title <text>] [--summary <text>]
      Write a documentation site's llms.txt into <dir>: an index of the packages' kits, linked
      under <url>, and the kit files it links, in <dir>/agent/<name>/.`;

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

const COMMANDS = new Set(['package', 'agents-md', 'llms']);

/** Run one command; resolves with the exit code. */
export async function main(argv: readonly string[], io: Io): Promise<number> {
  const [first, ...rest] = argv;
  const command = first !== undefined && COMMANDS.has(first) ? first : 'kit';
  const args = command === 'kit' ? [...argv] : rest;
  let values;
  try {
    ({ values } = parseArgs({
      args,
      options: {
        root: { type: 'string', default: '.' },
        package: { type: 'string', multiple: true },
        out: { type: 'string', default: '.oddkin/agent-kit' },
        'theme-config': { type: 'string' },
        check: { type: 'boolean', default: false },
        write: { type: 'boolean', default: false },
        base: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
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
  let base: URL | undefined;
  if (command === 'llms') {
    try {
      base = new URL(values.base ?? '');
    } catch {
      base = undefined;
    }
    const out = args.some((arg) => arg === '--out' || arg.startsWith('--out='));
    if (!base || !/^https?:$/.test(base.protocol) || !out) {
      io.err(`llms needs --base <absolute http(s) URL> and --out <dir>.\n${USAGE}`);
      return 2;
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
  }
  if (command === 'agents-md') {
    if (values.write && values.check) {
      io.err(USAGE);
      return 2;
    }
    return agentsMd(values.root, values.check, values.write, io);
  }
  const project = resolveProjectContext(values.root, {
    ...(values['theme-config'] ? { themeConfig: values['theme-config'] } : {}),
  });
  for (const d of project.diagnostics) io.err(`${d.severity} ${d.code}: ${d.message}`);
  const names = values.package ?? project.libraries.filter((l) => l.owned).map((l) => l.name);
  if (!names.length) {
    io.err(
      'No package of this workspace publishes oddkin.metadata.json; name installed ones with --package.',
    );
    return 1;
  }
  for (const name of names)
    if (!project.libraries.some((l) => l.name === name)) {
      io.err(`error agent.kit.unknownPackage: ${name} publishes no oddkin.metadata.json here.`);
      return 1;
    }
  if (command === 'llms' && base) {
    const title =
      values.title ??
      (JSON.parse(readFileSync(join(project.root, 'package.json'), 'utf8')) as { name?: string })
        .name ??
      'Agent kits';
    return llms(project, names, resolve(values.root, values.out), base, title, values.summary, io);
  }
  return command === 'package'
    ? packaged(project, names, values.check, io)
    : kits(project, names, values.root, values.out, values.check, io);
}

async function llms(
  project: Project,
  names: string[],
  out: string,
  base: URL,
  title: string,
  summary: string | undefined,
  io: Io,
): Promise<number> {
  const site: SiteKit[] = [];
  for (const name of names) {
    const library = project.libraries.find((l) => l.name === name)!;
    const { files, manifest } = await packageKit(project, library);
    const path = `agent/${kitDirName(name)}/`;
    writeKit(join(out, path), files);
    site.push({ library, manifest, url: new URL(path, base).href });
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, 'llms.txt'),
    siteLlmsText({ title, ...(summary ? { summary } : {}), kits: site }),
  );
  io.out(`llms.txt and ${site.length} kits in ${out}, linked under ${base.href}`);
  return 0;
}

function kits(
  project: Project,
  names: string[],
  root: string,
  out: string,
  check: boolean,
  io: Io,
): number {
  let failed = false;
  for (const name of names) {
    const dir = resolve(root, out, kitDirName(name));
    if (check) {
      const { status, changed } = checkKit(dir, project, name);
      if (status === 'current') io.out(`${name}: current (${dir})`);
      else {
        failed = true;
        io.err(
          `${status === 'stale' ? 'error agent.kit.stale' : 'error agent.kit.missing'}: ${name} at ${dir}${changed.length ? `\n  ${changed.join('\n  ')}` : ''}\n  → ${refreshCommand(name, out)}`,
        );
      }
      continue;
    }
    const { files, manifest } = generateKit(project, name);
    writeKit(dir, files);
    io.out(
      `${name}: ${files.size} files in ${dir}; GUIDE.md ${manifest.guide.bytes} of ${manifest.guide.budgetBytes} bytes`,
    );
    if (manifest.guide.bytes > manifest.guide.budgetBytes) {
      failed = true;
      io.err(`error agent.kit.guideBudget: ${name}'s GUIDE.md exceeds its budget.`);
    }
  }
  return failed ? 1 : 0;
}

async function packaged(
  project: Project,
  names: string[],
  check: boolean,
  io: Io,
): Promise<number> {
  let failed = false;
  for (const name of names) {
    const library = project.libraries.find((l) => l.name === name)!;
    const { dir, files, manifest } = await packageKit(project, library);
    const where = relative(project.root, dir).split('\\').join('/');
    if (manifest.guide.bytes > manifest.guide.budgetBytes) {
      failed = true;
      io.err(`error agent.kit.guideBudget: ${name}'s GUIDE.md exceeds its budget.`);
    }
    if (check) {
      const stale = [...files].filter(
        ([path, text]) =>
          !existsSync(join(dir, path)) || readFileSync(join(dir, path), 'utf8') !== text,
      );
      if (!stale.length) {
        io.out(`${name}: current (${where})`);
        continue;
      }
      failed = true;
      const shipped = existsSync(join(dir, 'kit.json'))
        ? (JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8')) as {
            fingerprint?: { generator?: { version?: string } };
          })
        : undefined;
      const generator = shipped?.fingerprint?.generator?.version;
      io.err(
        `error agent.kit.stale: ${where} (${stale.length} of ${files.size} files differ: ${stale
          .slice(0, 5)
          .map(([path]) => path)
          .join(', ')}${stale.length > 5 ? ', …' : ''})${
          generator && generator !== manifest.fingerprint.generator.version
            ? `\n  generated by ${generator}; this is ${manifest.fingerprint.generator.version}`
            : ''
        }${library.owned ? '\n  → oddkin-kit package' : ''}`,
      );
      continue;
    }
    if (!library.owned) {
      failed = true;
      io.err(
        `error agent.kit.installed: ${name} is installed, not part of this workspace; its kit ships with it (use --check).`,
      );
      continue;
    }
    writeKit(dir, files);
    io.out(
      `${name}: ${files.size} files in ${where}; GUIDE.md ${manifest.guide.bytes} of ${manifest.guide.budgetBytes} bytes`,
    );
  }
  return failed ? 1 : 0;
}

function agentsMd(root: string, check: boolean, write: boolean, io: Io): number {
  const file = join(resolve(root), 'AGENTS.md');
  const before = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const after = updateAgentsMd(before, renderSection(resolveProjectContext(root)));
  if (after === before) {
    io.out('AGENTS.md: managed section current.');
    return 0;
  }
  io.out(`AGENTS.md${before ? '' : ' (new file)'}:\n${lineDiff(before, after).join('\n')}`);
  if (check) {
    io.err('error agent.agentsMd.stale: run oddkin-kit agents-md --write');
    return 1;
  }
  if (write) {
    writeFileSync(file, after);
    io.out('AGENTS.md written.');
  } else io.out('Dry run: add --write to apply.');
  return 0;
}
