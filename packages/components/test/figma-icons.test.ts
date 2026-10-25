import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
interface Layer {
  path: string[];
  types: string[];
  bound?: Record<string, unknown[]>;
  literals?: Record<string, unknown[]>;
}
interface Family {
  id: string;
  name: string;
  page: string;
  layers: Layer[];
}
const families = (json('design/figma/components.json').families as Family[]).filter(
  (f) => f.page === '359:2',
);
const catalog = json('design/icons/catalog.json');
const map = json('design/icons/figma-map.json');
const layout = json('design/figma/icon-layouts.json');

describe('Figma icon library', () => {
  it('scales shared artwork and centers compact icons with their labels', () => {
    expect([...layout.sources.sourceIds].sort()).toEqual(
      map.icons.map((i: { id: string }) => i.id).sort(),
    );
    expect(layout.sources.constraints).toEqual({ horizontal: 'SCALE', vertical: 'SCALE' });
    expect(layout.sources.issues).toEqual([]);
    for (const page of layout.pages) {
      expect(page.counts.scalingIssues, page.page).toBe(0);
      expect(page.counts.alignmentCandidates, page.page).toBe(0);
    }
    for (const sample of layout.samples) {
      expect(sample.artwork.width, sample.id).toBe(sample.canvas.width);
      expect(sample.artwork.height, sample.id).toBe(sample.canvas.height);
      expect(sample.artwork.x, sample.id).toBe(0);
      expect(sample.artwork.y, sample.id).toBe(0);
      expect(sample.centers.icon, sample.id).toBe(sample.centers.reference);
      if (sample.labelForeground)
        expect(sample.strokeForegrounds, sample.id).toEqual([sample.labelForeground]);
    }
    for (const row of layout.rows) {
      for (const child of row.children) {
        expect(Math.abs(child.y + child.height / 2 - row.height / 2), child.id).toBeLessThanOrEqual(
          0.5,
        );
        expect(child.x, child.id).toBeGreaterThanOrEqual(0);
        expect(child.x + child.width, child.id).toBeLessThanOrEqual(row.width + 0.5);
      }
    }
  });

  it('maps every SVG asset to exactly one existing main component', () => {
    expect(new Set(map.icons.map((i: { id: string }) => i.id)).size).toBe(map.icons.length);
    expect(map.icons.map((i: { icon: string }) => i.icon).sort()).toEqual(
      catalog.icons.map((i: { name: string }) => i.name).sort(),
    );
    expect(map.icons.map((i: { id: string; name: string }) => `${i.id} ${i.name}`).sort()).toEqual(
      families.map((f) => `${f.id} ${f.name}`).sort(),
    );
  });

  it('keeps SVG containers transparent so they cannot cover the glyph with a square', () => {
    const opaque: string[] = [];
    for (const f of families) {
      for (const layer of f.layers) {
        if (!layer.types.some((t) => ['COMPONENT', 'FRAME', 'VECTOR'].includes(t))) continue;
        const fields = [...Object.keys(layer.bound ?? {}), ...Object.keys(layer.literals ?? {})];
        if (fields.some((k) => k === 'fills' || k === 'fillStyle'))
          opaque.push(`${f.name}/${layer.path.join('/')}`);
      }
      expect(
        f.layers.some((l) => l.types.includes('VECTOR')),
        f.name,
      ).toBe(true);
    }
    expect(opaque).toEqual([]);
  });

  it('accounts for every source reference without missing or duplicate IDs', () => {
    const reference = json('design/icons/reference-map.json');
    const source = {
      icons: reference.inventorySnapshots.flatMap(
        (inventory: { path: string }) => json(inventory.path).icons,
      ),
    };
    expect(reference.unmapped).toEqual([]);
    expect(reference.references.map((r: { id: string }) => r.id).sort()).toEqual(
      source.icons.map((i: { id: string }) => i.id).sort(),
    );
    const assets = new Set(catalog.icons.map((i: { name: string }) => i.name));
    expect(reference.references.filter((r: { icon: string }) => !assets.has(r.icon))).toEqual([]);
  });
});
