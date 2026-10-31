#!/usr/bin/env node
// The change-impact demonstration (IMPLEMENTATION_PLAN.md CF.2; the technical plan's §7): a real
// change between two commits, scripted, and what the tools report about it.
//
//   node scripts/impact-demo.mjs [--base <ref>] [--out <dir>] [--run] [--record <dir>]
//
// The head is the base (default HEAD) with the commits in CHANGE, made in a temporary worktree with
// a fixed author and date, so one base always gives one head commit. Both revisions are built with
// their own build steps and read with this checkout's tools: oddkin-impact snapshots and compares
// them, and oddkin-kit packages each one's agent kits. <out> (default .oddkin/impact/demo) receives
// change.patch, base.json and head.json (the snapshots), report.json and report.md (the changes,
// the affected components, and the selected checks with their reason paths), kit.diff (the change
// to the agent context), and README.md, which presents them. With --run, the selected checks run
// on the head's build in Chromium, Firefox, and WebKit, and the report holds their results.
// --record copies the files README.md presents (not the snapshots or kits) to <dir>, for the docs.
// Exit code 1 when a selected check failed, 2 when the demonstration could not run.
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIR,
  ROOT,
  cli,
  commitOf,
  run,
  runSelected,
  snapshot,
  withBuiltRevision,
} from './impact.mjs';

/**
 * The change: two commits a library team could make. The first renames a styling contract (a
 * consumer's `odd-menu::part(item)` rule stops matching, and no test notices); the second changes a
 * theme value. Each edit's `find` must occur exactly once in its file.
 */
export const CHANGE = [
  {
    message: 'Menu: name the item part after its role, menuitem',
    edits: [
      {
        file: 'packages/components/src/menu/menu.ts',
        find: '@csspart item - Each menu item.',
        replace: '@csspart menuitem - Each menu item.',
      },
      {
        file: 'packages/components/src/menu/menu.template.ts',
        find: '`menuitem` (`part="item"`,',
        replace: '`menuitem` (`part="menuitem"`,',
      },
      {
        file: 'packages/components/src/menu/menu.template.ts',
        find: 'role="menuitem"\n      part="item"',
        replace: 'role="menuitem"\n      part="menuitem"',
      },
    ],
  },
  {
    message: 'Theme: a lighter specimen surface',
    edits: [
      {
        file: 'packages/tokens/themes/default.theme.json',
        find: '"color.surface.specimen": { "light": "#efedfc"',
        replace: '"color.surface.specimen": { "light": "#f3f1fd"',
      },
    ],
  },
];

/**
 * Apply `edits` to the texts `read(file)` returns; the edited texts by file. Throws when an edit's
 * `find` does not occur exactly once.
 */
export function applyEdits(read, edits) {
  const texts = new Map();
  for (const { file, find, replace } of edits) {
    const text = texts.get(file) ?? read(file);
    const count = text.split(find).length - 1;
    if (count !== 1)
      throw new Error(
        `The demonstration's change does not apply: ${file} holds ${count} copies of ${JSON.stringify(find)}, not 1.`,
      );
    texts.set(
      file,
      text.replace(find, () => replace),
    );
  }
  return texts;
}

// The commits are local and temporary, and the same on every run: a fixed author and date, and no
// signature (a signature differs each time).
const IDENTITY = [
  '-c',
  'user.name=Oddkin demonstration',
  '-c',
  'user.email=demonstration@oddkin.invalid',
  '-c',
  'commit.gpgsign=false',
];
const DATES = {
  GIT_AUTHOR_DATE: '2026-10-30T12:00:00Z',
  GIT_COMMITTER_DATE: '2026-10-30T12:00:00Z',
};
const git = (args, cwd) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 && !(args[0] === 'diff' && result.status === 1))
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${result.stderr}`);
  return result.stdout;
};

/** Commit CHANGE on the checkout at `worktree`. */
function commitChange(worktree) {
  for (const { message, edits } of CHANGE) {
    const texts = applyEdits((file) => readFileSync(join(worktree, file), 'utf8'), edits);
    for (const [file, text] of texts) writeFileSync(join(worktree, file), text);
    run('git', ['add', ...texts.keys()], worktree);
    run('git', [...IDENTITY, 'commit', '--quiet', '-m', message], worktree, DATES);
  }
}

/** This checkout's oddkin-kit packages the agent kits of `worktree`; copy them to `to`. */
function packageKits(worktree, to) {
  run(
    process.execPath,
    [join(ROOT, 'packages/analyzer/dist/kit-bin.js'), 'package', '--root', worktree],
    worktree,
  );
  rmSync(to, { recursive: true, force: true });
  for (const pkg of ['components', 'ai'])
    cpSync(join(worktree, 'packages', pkg, 'agent'), join(to, pkg), { recursive: true });
}

/** The README that presents the outputs. */
function presentation({ base, head, commits, run: ran, stat, report, markdown, kitStat }) {
  const short = (sha) => `\`${sha.slice(0, 12)}\``;
  const checks = report.checks;
  const engines = [
    ...new Set(
      checks.flatMap((c) => (c.conditions?.runs ?? []).map((r) => r.browser).filter(Boolean)),
    ),
  ];
  const states = Object.entries(
    checks.reduce((counts, c) => ({ ...counts, [c.state]: (counts[c.state] ?? 0) + 1 }), {}),
  ).map(([state, n]) => `${n} ${state}`);
  const incompatible = report.changes.filter((c) => c.classification === 'incompatible');
  const allPassed = checks.length > 0 && checks.every((c) => c.state === 'passed');
  return [
    '# Change-impact demonstration',
    '',
    `\`node scripts/impact-demo.mjs${ran ? ' --run' : ''}\` wrote this from a real change between two commits (IMPLEMENTATION_PLAN.md CF.2). Both revisions were built with their own build steps; this checkout's \`oddkin-impact\` snapshotted and compared them, and its \`oddkin-kit\` packaged both revisions' agent kits.`,
    '',
    `- Base: ${short(base.sha)}, ${base.subject}`,
    `- Head: ${short(head)}, the base and ${commits.length} commits:`,
    ...commits.map((c, i) => `  ${i + 1}. ${short(c.sha)}, ${c.subject}`),
    '',
    'Files: [change.patch](./change.patch) (the commits), [report.md](./report.md) and [report.json](./report.json) (the comparison), and [kit.diff](./kit.diff) (the agent-context change).',
    '',
    '## The change',
    '',
    '```text',
    stat.trimEnd(),
    '```',
    '',
    '## What it affects',
    '',
    `${report.changes.length} changes: ${['incompatible', 'review', 'informational'].map((k) => `${report.changes.filter((c) => c.classification === k).length} ${k}`).join(', ')}. ${report.affected.components.length} components affected:`,
    '',
    ...report.affected.components.map(
      (a) =>
        `- \`${a.id}\`${a.via.length > 1 ? `, via ${a.via.map((v) => `\`${v}\``).join(' → ')}` : ''}`,
    ),
    '',
    `${checks.length} checks: ${states.join(', ')}${engines.length ? `, in ${engines.join(', ')}` : ''}. Each check's reason path is in the report below.`,
    '',
    ...(allPassed && incompatible.length
      ? [
          `Every selected check passed, and the report still marks ${incompatible.map((c) => `\`${c.id}\``).join(', ')} incompatible: passing checks do not make a contract change compatible.`,
          '',
        ]
      : []),
    ...(report.fallback
      ? [`Full verification instead of a selection: ${report.fallback.reasons.join('; ')}.`, '']
      : []),
    markdown.replace(/^#/gm, '##').trimEnd(),
    '',
    '## The agent-context change',
    '',
    'The packaged agent kits of both revisions, generated with the same `oddkin-kit`. The full diff is [kit.diff](./kit.diff).',
    '',
    '```text',
    kitStat.trimEnd() || 'No change.',
    '```',
    '',
    '## Reproduce',
    '',
    '```sh',
    'npm install',
    'npm run build',
    `node scripts/impact-demo.mjs --base ${base.sha.slice(0, 12)}${ran ? ' --run' : ''}`,
    '```',
    '',
    'The same base gives the same head commits. Check results name the browsers that ran them.',
    '',
  ].join('\n');
}

async function demonstrate(args) {
  const option = (name) => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const baseSha = commitOf(option('--base') ?? 'HEAD');
  const out = resolve(option('--out') ?? join(DIR, 'demo'));
  const runChecks = args.includes('--run');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const files = {
    base: join(out, 'base.json'),
    head: join(out, 'head.json'),
    report: join(out, 'report.json'),
    markdown: join(out, 'report.md'),
  };
  // The kits need the composition schemas, built after the metadata.
  const through = 'scripts/build-ai-schemas.mjs';

  await withBuiltRevision(
    baseSha,
    async (worktree) => {
      await snapshot(worktree, files.base);
      packageKits(worktree, join(out, 'kits/base'));
    },
    { name: 'demo-base', through },
  );

  let head = '';
  let commits = [];
  let stat = '';
  let status = 0;
  await withBuiltRevision(
    baseSha,
    async (worktree) => {
      head = git(['rev-parse', 'HEAD'], worktree).trim();
      commits = git(['log', '--reverse', '--format=%H %s', `${baseSha}..${head}`], worktree)
        .trim()
        .split('\n')
        .map((line) => ({ sha: line.slice(0, 40), subject: line.slice(41) }));
      stat = git(['diff', '--stat', baseSha, head], worktree);
      writeFileSync(
        join(out, 'change.patch'),
        git(['format-patch', '--stdout', '--no-signature', `${baseSha}..${head}`], worktree),
      );
      await snapshot(worktree, files.head);
      packageKits(worktree, join(out, 'kits/head'));
      const compare = (results = []) =>
        cli([
          'compare',
          files.base,
          files.head,
          ...results.flatMap((file) => ['--results', file]),
          '--json',
          files.report,
          '--markdown',
          files.markdown,
        ]);
      let result = compare();
      if (runChecks) result = compare(runSelected(worktree, files.report, join(out, 'results')));
      status = result.status ?? 0;
    },
    { name: 'demo-head', prepare: commitChange, through },
  );

  writeFileSync(
    join(out, 'kit.diff'),
    git(['diff', '--no-index', '--no-color', 'kits/base', 'kits/head'], out),
  );
  const subject = git(['log', '-1', '--format=%s', baseSha], ROOT).trim();
  writeFileSync(
    join(out, 'README.md'),
    presentation({
      base: { sha: baseSha, subject },
      head,
      commits,
      run: runChecks,
      stat,
      report: JSON.parse(readFileSync(files.report, 'utf8')),
      markdown: readFileSync(files.markdown, 'utf8'),
      kitStat: git(['diff', '--no-index', '--stat', 'kits/base', 'kits/head'], out),
    }),
  );
  console.log(`Demonstration: ${relative(ROOT, join(out, 'README.md'))}`);
  const record = option('--record');
  if (record) {
    const to = resolve(record);
    mkdirSync(to, { recursive: true });
    for (const file of ['README.md', 'report.md', 'report.json', 'change.patch', 'kit.diff'])
      copyFileSync(join(out, file), join(to, file));
    console.log(`Recorded: ${relative(ROOT, to)}`);
  }
  return status;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await demonstrate(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}
