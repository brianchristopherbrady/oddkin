// Facts for the authored docs pages, generated from the repository's published files: package
// manifests, component metadata, the compatibility registry, the framework versions the typing
// fixtures are checked with, and the recorded change-impact run. Nothing here is typed by hand.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { foundationFacts } from './foundation-facts.mjs';

const BROWSERS = {
  chrome: 'Chrome',
  chrome_android: 'Chrome for Android',
  edge: 'Edge',
  firefox: 'Firefox',
  firefox_android: 'Firefox for Android',
  safari: 'Safari',
  safari_ios: 'Safari on iOS',
};
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const cell = (text) => [text];

/**
 * The shell's facts: the release version and license, the source repository, what Oddkin is, and
 * the catalog's reference pages from the Workbench `index` the server builds (the AI elements
 * included, as in the catalog).
 */
export async function siteFacts(root, index) {
  const core = await json(join(root, 'packages/core/package.json'));
  const readme = await readFile(join(root, 'README.md'), 'utf8');
  const intro = readme.split(/\n\s*\n/).find((block) => !block.startsWith('#')) ?? '';
  const { floor } = await json(join(root, 'docs/compatibility/features.json'));
  const desktop = ['chrome', 'edge', 'firefox', 'safari'].map(
    (id) => `${BROWSERS[id]} ${floor[id]}`,
  );
  const metadata = await json(join(root, 'packages/components/oddkin.metadata.json'));
  const packages = {};
  for (const entry of await readdir(join(root, 'packages'), { withFileTypes: true }))
    if (entry.isDirectory()) {
      const manifest = await json(join(root, 'packages', entry.name, 'package.json'));
      packages[manifest.name] = manifest.description ?? '';
    }
  return {
    version: core.version,
    license: core.license,
    repository: core.repository.url.replace(/^git\+/, '').replace(/\.git$/, ''),
    description: intro
      .replace(/\s+/g, ' ')
      .replace(/(\.)\s.*$|: .*$/, '$1')
      .trim(),
    browsers: `${desktop.slice(0, -1).join(', ')}, and ${desktop.at(-1)}`,
    components: Object.keys(metadata.components).length,
    packages,
    catalog: (index?.registry.pages ?? [])
      .filter((page) => page.kind === 'component' && page.visible)
      .map((page) => ({ href: page.route, label: page.title }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en')),
  };
}

/** Markdown inline marks removed, for text that the pages escape and show as is. */
const plain = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim();

async function decisionRows(root, source) {
  const dir = join(root, 'docs/architecture/decisions');
  const rows = [];
  for (const name of (await readdir(dir)).sort()) {
    if (!/^\d{4}-.+\.md$/.test(name) || name.startsWith('0000')) continue;
    const text = await readFile(join(dir, name), 'utf8');
    const [, number = '', title = ''] = /^# (\d{4})\. (.+)$/m.exec(text) ?? [];
    const field = (label) =>
      plain(new RegExp(`^- \\*\\*${label}:\\*\\* (.+)$`, 'm').exec(text)?.[1] ?? '');
    rows.push([
      [number],
      [{ link: plain(title), href: `${source}docs/architecture/decisions/${name}` }],
      [field('Area')],
      [field('Status').replace(/\s*\(.*$/, '')],
    ]);
  }
  return rows;
}

/** Each milestone of the plan with its checklist counted: done, partly done, and open items. */
async function milestoneRows(root) {
  const plan = await readFile(join(root, 'IMPLEMENTATION_PLAN.md'), 'utf8');
  const parts = plan.split(/^### (M\d+) \u2014 (.+)$/m);
  const rows = [];
  for (let i = 1; i < parts.length; i += 3) {
    const body = parts[i + 2].split(/^## /m)[0];
    const count = (mark) => (body.match(new RegExp(`^\\s*- \\[${mark}\\]`, 'gm')) ?? []).length;
    const [done, partly, open] = [count('x'), count('~'), count(' ')];
    const status = partly + open === 0 ? 'Done' : done + partly === 0 ? 'Planned' : 'In progress';
    rows.push([
      [parts[i]],
      [parts[i + 1]],
      [String(done)],
      [String(partly)],
      [String(open)],
      [status],
    ]);
  }
  return rows;
}

/** Example applications in the repository, from each page's own title. */
const EXAMPLES = [
  'app-header',
  'side-nav',
  'forms',
  'editable-list',
  'ai-research',
  'ai-agent',
  'ai-writing',
];

async function exampleCards(root, source) {
  const cards = [];
  for (const dir of EXAMPLES) {
    const html = await readFile(join(root, 'examples', dir, 'index.html'), 'utf8');
    const [title = dir, about = ''] = (/<title>([^<]+)<\/title>/.exec(html)?.[1] ?? dir)
      .split(' \u2014 ')
      .map((part) => part.trim());
    const elements = [...new Set(html.match(/<(odd-[a-z-]+|oddkin-ai-[a-z-]+)/g) ?? [])]
      .map((tag) => tag.slice(1))
      .slice(0, 3);
    cards.push({
      title,
      text: about.charAt(0).toUpperCase() + about.slice(1),
      href: `${source.replace('/blob/', '/tree/')}examples/${dir}`,
      action: `View the ${title.toLowerCase()} source`,
      ...(elements.length ? { meta: elements.join(' \u00b7 ') } : {}),
    });
  }
  return cards;
}

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces as hyphens. */
const anchor = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');

/** Markdown code, bold, and links as page inlines; a relative link resolves against `base`. */
function inlines(text, base) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(/`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push({ code: m[1] });
    else if (m[2] !== undefined) parts.push({ strong: m[2] });
    else parts.push({ link: m[3].replace(/`/g, ''), href: new URL(m[4], base).href });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Markdown paragraphs and bullets as page blocks: plain bullets make a list, and a labelled
 * bullet (`**Evidence:** …`) a paragraph, followed by its own bullets as a list.
 */
function markdownBlocks(markdown, base) {
  const tokens = [];
  for (const line of markdown.split('\n')) {
    const last = tokens.at(-1);
    const nested = /^\s+- (.*)$/.exec(line);
    const item = /^- (.*)$/.exec(line);
    if (!line.trim()) tokens.push({});
    else if (nested && last?.item !== undefined) last.children.push(nested[1]);
    else if (item) tokens.push({ item: item[1], children: [] });
    else if (last?.p !== undefined) last.p += ` ${line.trim()}`;
    else tokens.push({ p: line.trim() });
  }
  const blocks = [];
  let list;
  for (const token of tokens) {
    if (token.item !== undefined && !token.children.length && !/^\*\*[^*]+:\*\*/.test(token.item)) {
      if (!list) blocks.push((list = { list: [] }));
      list.list.push(inlines(token.item, base));
      continue;
    }
    list = undefined;
    if (token.p !== undefined) blocks.push({ p: inlines(token.p, base) });
    if (token.item === undefined) continue;
    blocks.push({ p: inlines(token.item, base) });
    if (token.children.length)
      blocks.push({ list: token.children.map((child) => inlines(child, base)) });
  }
  return blocks;
}

/**
 * docs/support.md as facts: `support-intro`, the opening paragraph after its first sentence (the
 * page's summary), without references to owner decisions; and `support-<anchor>` per section.
 */
async function supportFacts(root, source) {
  const text = await readFile(join(root, 'docs/support.md'), 'utf8');
  const base = `${source}docs/`;
  const [head = '', ...sections] = text.split(/^## /m);
  const intro = head
    .replace(/^# .*$/m, '')
    .trim()
    .replace(/\s*\(owner decision [^)]*\)/g, '');
  const facts = { 'support-intro': markdownBlocks(intro.replace(/^.*?\.\s+/s, ''), base) };
  for (const section of sections) {
    const [heading = '', ...body] = section.split('\n');
    facts[`support-${anchor(heading.trim())}`] = markdownBlocks(body.join('\n'), base);
  }
  return facts;
}

const ENGINES = { chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit' };
const CLASSIFICATIONS = ['incompatible', 'review', 'informational'];
/** `a`, `a and b`, or `a, b, and c`. */
const series = (items) =>
  items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
/** Ids as code, `between` each two. */
const codes = (ids, between) =>
  ids.flatMap((id, i) => (i ? [between, { code: id }] : [{ code: id }]));
const counted = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** Each state with its count: `11 passed, 1 failed`. */
const tally = (checks) => {
  const by = {};
  for (const check of checks) by[check.state] = (by[check.state] ?? 0) + 1;
  return Object.entries(by)
    .map(([state, n]) => `${n} ${state}`)
    .join(', ');
};
/** The browsers the checks ran in, in the order of their runs. */
const engines = (checks) =>
  [
    ...new Set(checks.flatMap((check) => check.conditions?.runs?.map((run) => run.browser) ?? [])),
  ].map((browser) => ENGINES[browser] ?? browser);

/**
 * One file of the kit diff: each changed table cell with its row's first cell, a changed line that
 * is not a table row, and the manifest keys whose values changed.
 */
function kitChange(part) {
  const lines = part.split('\n');
  const removed = lines.filter((line) => /^-(?!--)/.test(line)).map((line) => line.slice(1));
  const added = lines.filter((line) => /^\+(?!\+\+)/.test(line)).map((line) => line.slice(1));
  const cells = (line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/`/g, ''));
  const keys = [];
  const edits = [];
  const edit = (from, to, row) => {
    if (from !== to && !edits.some((e) => e.from === from && e.to === to))
      edits.push({ from, to, row });
  };
  removed.forEach((line, i) => {
    const key = /^\s*"([^"]+)":/.exec(line)?.[1];
    if (key) keys.push(key);
    else if (!line.trim().startsWith('|')) edit(line.trim(), (added[i] ?? '').trim());
    else {
      const [before, after] = [cells(line), cells(added[i] ?? '')];
      before.forEach((cell, j) => edit(cell, after[j] ?? '', j ? before[0] : undefined));
    }
  });
  const shown = edits.map(({ from, to, row }) => [
    ...(row ? [{ code: row }, ': '] : []),
    { code: from },
    ' \u2192 ',
    { code: to },
  ]);
  if (keys.length) shown.push([...codes(keys, ' and '), ' changed']);
  return shown.flatMap((parts, i) => (i ? ['; ', ...parts] : parts));
}

/**
 * The change-impact demonstration recorded in docs/impact-demo (IMPLEMENTATION_PLAN.md CF.2): its
 * commits, the report's changes, the affected components and the checks with their paths, the
 * agent-kit diff, and the commands that reproduce it.
 */
async function impactFacts(root, repository) {
  const dir = join(root, 'docs/impact-demo');
  const readme = await readFile(join(dir, 'README.md'), 'utf8');
  const report = await json(join(dir, 'report.json'));
  const patch = await readFile(join(dir, 'change.patch'), 'utf8');
  const kit = await readFile(join(dir, 'kit.diff'), 'utf8');
  const base = /^- Base: `([0-9a-f]+)`/m.exec(readme)?.[1] ?? 'unknown';
  const commits = patch
    .split(/^(?=From [0-9a-f]{40} )/m)
    .filter((part) => part.startsWith('From '))
    .map((part) => ({
      sha: part.slice(5, 17),
      subject: (/^Subject: (?:\[PATCH[^\]]*\] )?(.+(?:\n .+)*)/m.exec(part)?.[1] ?? 'unknown')
        .replace(/\n /g, ' ')
        .trim(),
      files: [...part.matchAll(/^diff --git a\/(\S+) b\//gm)].map(([, file]) => file),
    }));
  const { changes, checks, coverageGaps } = report;
  const { components, products } = report.affected;
  const rank = (change) => CLASSIFICATIONS.indexOf(change.classification);
  const incompatible = changes.filter((change) => change.classification === 'incompatible');

  const groups = new Map();
  for (const check of checks) {
    // `example:<tag>/<name>` and `suite:<id>#<tag>`.
    const example = /^example:([^/]+)\/(.+)$/.exec(check.id);
    const suite = /^suite:([^#]+)#(.+)$/.exec(check.id);
    const [tag, name] = example
      ? [example[1], example[2]]
      : suite
        ? [suite[2], `suite:${suite[1]}`]
        : [check.id, check.id];
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push({ ...check, name });
  }
  const ran = engines(checks);
  const reproduce = /^## Reproduce\s+```sh\n([\s\S]*?)```/m.exec(readme)?.[1]?.trim();

  return {
    'impact-commits': [
      {
        p: [
          'Base: ',
          { link: base, href: `${repository}/commit/${base}` },
          `. Head: the base and ${counted(commits.length, 'commit')}:`,
        ],
      },
      {
        table: {
          caption: 'The commits of the recorded change',
          head: ['Commit', 'Subject', 'Files'],
          rows: commits.map(({ sha, subject, files }) => [
            [{ code: sha }],
            [subject],
            codes(files, ', '),
          ]),
        },
      },
    ],
    'impact-summary': [
      {
        p: [
          `${counted(changes.length, 'change')}: ${CLASSIFICATIONS.map(
            (c) => `${changes.filter((change) => change.classification === c).length} ${c}`,
          ).join(', ')}. ${counted(components.length, 'component')}${
            products.length ? ` and ${counted(products.length, 'product')}` : ''
          } affected, with ${
            coverageGaps.length ? counted(coverageGaps.length, 'coverage gap') : 'no coverage gaps'
          }. ${counted(checks.length, 'check')} selected: ${tally(checks)}${
            ran.length ? `, in ${series(ran)}` : ''
          }.`,
        ],
      },
    ],
    'impact-changes': [
      {
        table: {
          caption: 'Changes, incompatible first',
          head: ['Item', 'Classification', 'Change', 'Reason'],
          rows: [...changes]
            .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))
            .map((change) => [
              [{ code: change.id }],
              [change.classification],
              [change.change],
              [
                change.reason,
                ...(change.possibleRename
                  ? ['; possible rename to ', { code: change.possibleRename }, ' (unconfirmed)']
                  : []),
              ],
            ]),
        },
      },
    ],
    'impact-affected': [
      {
        table: {
          caption: 'Affected components, each with the path that reaches it',
          head: ['Component', 'Path'],
          rows: components.map((component) => [
            [{ code: component.id.replace(/^component:/, '') }],
            codes(component.via, ' \u2192 '),
          ]),
        },
      },
    ],
    'impact-checks': [
      {
        table: {
          caption: 'Selected checks, by component',
          head: ['Component', 'Examples', 'Result'],
          rows: [...groups].map(([tag, group]) => [
            [{ code: tag }],
            codes(
              group.map((check) => check.name),
              ', ',
            ),
            [`${tally(group)}${engines(group).length ? ` in ${series(engines(group))}` : ''}`],
          ]),
        },
      },
      ...(checks.length && checks.every((check) => check.state === 'passed') && incompatible.length
        ? [
            {
              note: [
                'Every selected check passed, and the report still marks ',
                ...codes(
                  incompatible.map((change) => change.id),
                  ', ',
                ),
                ' incompatible: passing checks do not make a contract change compatible.',
              ],
            },
          ]
        : []),
    ],
    'impact-kit': [
      {
        table: {
          caption: 'Agent-kit files that differ between the revisions',
          head: ['File', 'Change'],
          rows: kit
            .split(/^diff --git /m)
            .slice(1)
            .map((part) => [
              [{ code: / b\/kits\/head\/(\S+)/.exec(part)?.[1] ?? 'unknown' }],
              kitChange(part),
            ]),
        },
      },
    ],
    'impact-reproduce': [{ code: { lang: 'sh', verify: 'none', code: reproduce ?? 'unknown' } }],
  };
}

/** Every fact of the `Fact` union in `src/pages/model.ts`, as page blocks. */
export async function docsFacts(root) {
  const { repository } = await siteFacts(root);
  const source = `${repository}/blob/main/`;
  const manifests = [];
  for (const entry of await readdir(join(root, 'packages'), { withFileTypes: true }))
    if (entry.isDirectory())
      manifests.push({
        dir: entry.name,
        ...(await json(join(root, 'packages', entry.name, 'package.json'))),
      });
  manifests.sort((a, b) => a.name.localeCompare(b.name));

  const counts = [];
  for (const dir of ['components', 'ai']) {
    const metadata = await json(join(root, 'packages', dir, 'oddkin.metadata.json'));
    const byCategory = {};
    for (const component of Object.values(metadata.components)) {
      const label = metadata.categories?.[component.category]?.label ?? 'Uncategorized';
      byCategory[label] = (byCategory[label] ?? 0) + 1;
    }
    counts.push({
      name: `@oddkin/${dir}`,
      total: Object.keys(metadata.components).length,
      byCategory,
    });
  }

  const compatibility = await json(join(root, 'docs/compatibility/features.json'));
  const root_ = await json(join(root, 'package.json'));
  const version = (name) => root_.devDependencies?.[name] ?? root_.dependencies?.[name];

  return {
    ...(await foundationFacts(root)),
    ...(await supportFacts(root, source)),
    ...(await impactFacts(root, repository)),
    decisions: [
      {
        table: {
          caption: 'Architecture decision records',
          head: ['Record', 'Decision', 'Area', 'Status'],
          rows: await decisionRows(root, source),
        },
      },
    ],
    milestones: [
      {
        table: {
          caption: 'Milestones in IMPLEMENTATION_PLAN.md, by checklist item',
          head: ['Milestone', 'Scope', 'Done', 'Partly done', 'Open', 'Status'],
          rows: await milestoneRows(root),
        },
      },
    ],
    examples: [{ cards: await exampleCards(root, source) }],
    packages: [
      {
        table: {
          caption: 'Oddkin packages',
          head: ['Package', 'What it is for'],
          rows: manifests.map((m) => [[{ code: m.name }], cell(m.description ?? '')]),
        },
      },
    ],
    'component-counts': [
      {
        list: counts.map((c) => [
          { code: c.name },
          `: ${c.total} elements (${Object.entries(c.byCategory)
            .map(([label, n]) => `${label} ${n}`)
            .join(', ')})`,
        ]),
      },
    ],
    'browser-floor': [
      {
        table: {
          caption: `Supported browsers (checked ${compatibility.checked})`,
          head: ['Browser', 'Version'],
          rows: Object.entries(compatibility.floor).map(([id, v]) => [
            cell(BROWSERS[id] ?? id),
            cell(`${v} and later`),
          ]),
        },
      },
    ],
    'browser-features': [
      {
        table: {
          caption: 'Platform features by adoption',
          head: ['Feature', 'Kind', 'Adoption', 'Without the feature'],
          rows: compatibility.features
            .filter((f) => f.status === 'implemented')
            .sort((a, b) => a.adoption.localeCompare(b.adoption) || a.id.localeCompare(b.id))
            .map((f) => [
              [{ code: f.id }],
              cell(f.kind),
              cell(f.adoption),
              cell(
                f.adoption === 'enhancement'
                  ? f.baseline
                  : 'Required: every supported browser has it.',
              ),
            ]),
        },
      },
    ],
    'framework-versions': [
      {
        table: {
          caption: 'Framework versions the typings are checked with',
          head: ['Framework', 'Version', 'Checked by'],
          rows: [
            ['React', 'react', 'tests/frameworks/react (tsc)'],
            ['Vue', 'vue', 'tests/frameworks/vue (vue-tsc)'],
            ['Svelte', 'svelte', 'tests/frameworks/svelte (svelte-check)'],
          ].map(([label, name, by]) => [
            cell(label),
            cell(version(name) ?? 'unknown'),
            [{ code: by }],
          ]),
        },
      },
    ],
  };
}
