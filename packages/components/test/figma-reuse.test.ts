import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BEGIN, END, renderReuse } from '../../../design/figma/reuse.render.mjs';

// The Figma components snapshot and the reuse map (design/figma/, read-only exports; never Figma live):
// both match their schemas, every nested-instance reference in the snapshot has exactly one class,
// the catalog's tables are rendered from the map, and the element dependencies the published
// definitions declare equal the map's element edges, no more and no fewer.

const root = new URL('../../../', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

interface Reference {
  consumer: string;
  consumerId: string;
  source: string;
  sourceId: string;
  count: number;
  class: string;
}
interface Family {
  id: string;
  name: string;
  instances: { source: string; sourceId: string; count: number }[];
}

const snapshot = json('design/figma/components.json') as { families: Family[] };
const map = json('design/figma/reuse.json') as {
  counts: Record<string, number>;
  references: Reference[];
  elements: Record<string, { dependencies: string[] }>;
};

describe('design/figma snapshot and reuse map', () => {
  it('match their schemas', () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    for (const [file, schema] of [
      ['design/figma/components.json', 'design/figma/components.schema.json'],
      ['design/figma/reuse.json', 'design/figma/reuse.schema.json'],
    ] as const) {
      ajv.validate(json(schema), json(file));
      expect(ajv.errors ?? [], file).toEqual([]);
    }
  });

  it('classify every nested-instance reference once, with the snapshot count', () => {
    const inSnapshot = snapshot.families.flatMap((f) =>
      f.instances.map((r) => `${f.id} ${f.name} -> ${r.sourceId} ${r.source} x${r.count}`),
    );
    const inMap = map.references.map(
      (r) => `${r.consumerId} ${r.consumer} -> ${r.sourceId} ${r.source} x${r.count}`,
    );
    expect(inMap.sort()).toEqual(inSnapshot.sort());
    const counts: Record<string, number> = {};
    for (const r of map.references) counts[r.class] = (counts[r.class] ?? 0) + 1;
    expect(counts).toEqual(map.counts);
  });

  it('is rendered into component-catalog.md (node design/figma/reuse.render.mjs --write)', () => {
    const doc = readFileSync(new URL('docs/architecture/component-catalog.md', root), 'utf8');
    const section = doc.slice(doc.indexOf(BEGIN) + BEGIN.length, doc.indexOf(END));
    expect(section.trim()).toBe(renderReuse(map));
  });

  it('element dependencies equal the dependencies the published definitions declare', () => {
    const declared: Record<string, string[]> = {};
    for (const pkg of ['components', 'ai']) {
      const metadata = json(`packages/${pkg}/oddkin.metadata.json`);
      for (const c of Object.values(metadata['components']) as any[])
        declared[c.tag] = Object.values<string>(c.definition?.dependencies ?? {})
          .map((id) => id.replace(/^component:/, ''))
          .sort();
    }
    const mapped = Object.fromEntries(
      Object.entries(map.elements).map(([tag, e]) => [tag, [...e.dependencies].sort()]),
    );
    expect(mapped).toEqual(declared);
  });
});
