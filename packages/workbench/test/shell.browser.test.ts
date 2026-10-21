import { afterEach, describe, expect, it } from 'vitest';
import { settled } from '@oddkin/core/reactive';
import { scopeStats } from '@oddkin/core/scope';
import '../src/app/define.js';
import type { OddkinWorkbench, WorkbenchSource } from '../src/app/index.js';
import { buildWorkbenchData, type WorkbenchData } from '../src/data/index.js';
import type { CemPackage, OddkinMetadataLike } from '../src/pages/index.js';

// The shell over the Acme fixture library, in hash mode so the test page's own path is left
// alone. Data comes from an injected source; the dev server and real HTTP are e2e territory.

const fixture = async (name: string) =>
  (await fetch(new URL(`./fixtures/${name}`, import.meta.url))).json() as Promise<unknown>;

async function acmeData(): Promise<WorkbenchData> {
  const { data, diagnostics } = buildWorkbenchData({
    config: {
      library: { packages: ['@acme/ui'] },
      branding: { name: 'Acme UI' },
      hosting: { routing: 'hash' },
    },
    libraries: [
      {
        name: '@acme/ui',
        version: '1.4.0',
        cem: (await fixture('acme.custom-elements.json')) as CemPackage,
        metadata: (await fixture('acme.oddkin.metadata.json')) as OddkinMetadataLike,
      },
    ],
  });
  if (!data) throw new Error(JSON.stringify(diagnostics));
  return data;
}

function sourceFor(data: WorkbenchData, overrides: Partial<WorkbenchSource> = {}): WorkbenchSource {
  const byFile = new Map(Object.entries(data.index.pages).map(([id, file]) => [file, id]));
  return {
    index: async () => data.index,
    page: async (file) => data.pages[byFile.get(file)!],
    ...overrides,
  };
}

const shells: OddkinWorkbench[] = [];
afterEach(async () => {
  for (const shell of shells.splice(0)) shell.remove();
  await settled();
  history.replaceState(null, '', location.pathname + location.search);
});

async function mount(source: WorkbenchSource): Promise<OddkinWorkbench> {
  const shell = document.createElement('oddkin-workbench');
  shell.source = source;
  shells.push(shell);
  document.body.append(shell);
  return shell;
}

const heading = (shell: Element) => shell.querySelector('main h1')?.textContent;
async function until(check: () => boolean, what: string) {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  if (!check()) throw new Error(`timed out waiting for ${what}`);
}

describe('<oddkin-workbench>', () => {
  it('renders navigation from the registry and follows links', async () => {
    const shell = await mount(sourceFor(await acmeData()));
    await until(() => heading(shell) === 'Foundations', 'the first destination');
    expect(location.hash).toBe('#/foundations');
    const primary = [...shell.querySelectorAll<HTMLAnchorElement>('.wb-primary a')];
    expect(primary.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Foundations', '#/foundations'],
      ['Components', '#/components'],
      ['Theme Studio', '#/theme-studio'],
    ]);
    expect(primary[0]!.getAttribute('aria-current')).toBe('page');
    // Landmarks and the skip link come first.
    expect(shell.firstElementChild?.matches('a.wb-skip[href="#main"]')).toBe(true);
    expect(
      shell.querySelectorAll('header.wb-header, nav[aria-label="Primary"], main#main'),
    ).toHaveLength(3);

    primary[1]!.click();
    await until(() => heading(shell) === 'Components', 'Components');
    expect(document.title).toBe('Components · Acme UI');
    expect(primary[1]!.getAttribute('aria-current')).toBe('page');
    expect(primary[0]!.hasAttribute('aria-current')).toBe(false);
    const cards = [...shell.querySelectorAll('odd-card.wb-card a')].map((a) => a.textContent);
    // Card has a known category (Layout); the others fall back to "Other components".
    expect(cards).toEqual(['Card', 'Button', 'Side nav']);
    expect([...shell.querySelectorAll('.wb-group h2')].map((h) => h.textContent)).toEqual([
      'Layout (1)',
      'Other components (2)',
    ]);

    [...shell.querySelectorAll<HTMLAnchorElement>('odd-card.wb-card a')]
      .find((a) => a.textContent === 'Button')!
      .click();
    await until(() => heading(shell) === 'Button', 'Button');
    await settled();
    expect(document.activeElement).toBe(shell.querySelector('main h1'));
    expect(primary[1]!.getAttribute('aria-current')).toBe('true');
    expect(shell.querySelector('.wb-sidebar a[aria-current="page"]')?.textContent?.trim()).toBe(
      'Button',
    );
    expect(shell.querySelector('.wb-back')?.textContent).toBe('All components');
    const toc = [...shell.querySelectorAll<HTMLAnchorElement>('.wb-toc a')];
    expect(toc[0]?.getAttribute('href')).toBe('#/components/acme-button#overview');
    for (const link of toc)
      expect(shell.querySelector(`section#${link.hash.split('#').pop()}`)).not.toBeNull();
  });

  it('releases everything it owned when removed', async () => {
    const before = scopeStats();
    const shell = await mount(sourceFor(await acmeData()));
    await until(() => heading(shell) === 'Foundations', 'the first destination');
    shell.querySelector<HTMLAnchorElement>('.wb-primary a[href="#/components"]')!.click();
    await until(() => heading(shell) === 'Components', 'Components');
    expect(scopeStats().listeners).toBeGreaterThan(before.listeners);
    shell.remove();
    shells.length = 0;
    await settled();
    expect(scopeStats()).toEqual(before);
    // The router no longer follows the URL.
    location.hash = '#/theme-studio';
    await new Promise((r) => setTimeout(r, 50));
    expect(heading(shell)).toBe('Components');
  });

  it('explains an index it cannot load or read, and a page that fails', async () => {
    const failing = await mount({
      index: async () => {
        throw new Error('offline');
      },
      page: async () => undefined,
    });
    await until(() => !!failing.querySelector('[role="alert"]'), 'the failure');
    expect(failing.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be loaded: offline',
    );

    const other = await mount({
      index: async () => ({ format: 'other', version: 9 }),
      page: async () => undefined,
    });
    await until(() => !!other.querySelector('[role="alert"]'), 'the version message');
    expect(other.querySelector('[role="alert"]')?.textContent).toContain(
      'different Workbench version (other 9)',
    );
    failing.remove();
    other.remove();

    const data = await acmeData();
    const broken = await mount(
      sourceFor(data, {
        page: async (file) => {
          if (file.includes('foundations')) throw new Error('page gone');
          return undefined;
        },
      }),
    );
    await until(() => heading(broken) === 'This page could not be loaded', 'the page failure');
    expect(broken.querySelector('main .wb-summary')?.textContent).toBe('page gone');
    // Navigation still works.
    broken.querySelector<HTMLAnchorElement>('.wb-primary a[href="#/theme-studio"]')!.click();
    await until(() => heading(broken) === 'Theme Studio', 'Theme Studio');
  });
});
