// Facts for the authored docs pages, generated from the repository's published files: package
// manifests, component metadata, the compatibility registry, and the framework versions the
// typing fixtures are checked with. Nothing here is typed by hand.
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
 * have their own page, /ai, as in the catalog).
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
      .filter((page) => page.kind === 'component' && page.visible && page.group !== 'AI')
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
