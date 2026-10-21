import { describe, expect, it, vi } from 'vitest';
import { categoryRecords } from '../src/emit.js';
import type { Extraction } from '../src/extract.js';
import { analyze } from '../src/index.js';

// Category labels from `@category` (metadata-and-analyzer.md §3), on a minimal extraction.
vi.setConfig({ testTimeout: 30_000 });
const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const component = (name: string, category?: string) => ({
  file: `src/${name}.ts`,
  name,
  tags:
    category === undefined
      ? {}
      : {
          category: [{ value: category, location: { file: `src/${name}.ts`, line: 3, column: 4 } }],
        },
});
const registration = (tag: string, className: string) => ({
  tag,
  className,
  classFile: `src/${className}.ts`,
  file: 'src/define.ts',
});
const extraction = (
  components: ReturnType<typeof component>[],
  registrations: ReturnType<typeof registration>[],
) => ({ components, registrations }) as unknown as Extraction;

describe('categoryRecords', () => {
  it('labels each category with its first spelling in tag order and reports other spellings', () => {
    const { categories, diagnostics } = categoryRecords(
      extraction(
        [
          component('Panel', 'containers'),
          component('Card', 'Containers'),
          component('Box', '  Layout   tools '),
          component('Blank', '   '),
          component('Plain'),
          component('Hidden', 'Hidden'),
        ],
        [
          registration('c-panel', 'Panel'),
          registration('b-card', 'Card'),
          registration('a-box', 'Box'),
          registration('d-blank', 'Blank'),
          registration('e-plain', 'Plain'),
        ],
      ),
    );
    expect(categories).toEqual({
      'category:containers': { label: 'Containers' },
      'category:layout-tools': { label: 'Layout   tools' },
    });
    expect(Object.keys(categories)).toEqual(['category:containers', 'category:layout-tools']);
    expect(diagnostics).toEqual([
      {
        code: 'analyzer.category.conflict',
        severity: 'warning',
        message:
          '<c-panel> writes @category "containers", but <b-card> writes the same category as "Containers"; the label "Containers" is used.',
        source: { file: 'src/Panel.ts', line: 3, column: 4 },
        suggestion: 'Write @category Containers.',
      },
    ]);
  });

  it('records nothing without authored categories', () => {
    expect(
      categoryRecords(extraction([component('Plain')], [registration('a-plain', 'Plain')])),
    ).toEqual({ categories: {}, diagnostics: [] });
  });
});

describe('analyze() with two spellings of one category', () => {
  const result = analyze({ project: path('tests/fixtures/analyzer-categories/tsconfig.json') });

  it('publishes one record and reports the other spelling with its source', () => {
    expect(result.metadata['categories']).toEqual({
      'category:layout-tools': { label: 'Layout tools' },
    });
    const components = result.metadata['components'] as Record<string, { category?: string }>;
    expect(components['component:acme-stack']?.category).toBe('category:layout-tools');
    const conflict = expect.objectContaining({
      code: 'analyzer.category.conflict',
      severity: 'warning',
      source: expect.objectContaining({ file: 'src/index.ts', line: 13 }),
    });
    expect(result.diagnostics).toEqual([conflict]);
    expect(result.metadata['diagnostics']).toEqual([conflict]);
  });
});
