// Facts for the authored docs pages, generated from the repository's published files: package
// manifests, component metadata, the compatibility registry, and the framework versions the
// typing fixtures are checked with. Nothing here is typed by hand.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

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

/** Every fact of the `Fact` union in `src/pages/model.ts`, as page blocks. */
export async function docsFacts(root) {
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
