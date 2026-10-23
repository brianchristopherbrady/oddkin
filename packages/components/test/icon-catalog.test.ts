import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogValidator, validateCatalog } from '../../../design/icons/catalog-validation.mjs';

const root = new URL('../../../', import.meta.url);
const json = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const base = 'design/icons/';
const domains = ['general', 'gis', 'healthcare'];
const catalogs = domains.map((d) => json(base + d + '-only-icons.json'));
const sourceCatalogs = ['gis', 'healthcare'].map((d) =>
  json(base + 'inventories/reference-catalogs/' + d + '-only-icons.json'),
);
const validate = catalogValidator(json(base + 'icon-catalog.schema.json'));

describe('Oddkin icon catalog contract', () => {
  it('validates all three artwork catalogs and retained reference catalogs, counts, facets and joins', () => {
    for (const catalog of [...catalogs, ...sourceCatalogs]) validateCatalog(catalog, validate);
  });

  it('covers every actual SVG and Figma main component once using stable cross-gallery IDs', () => {
    const actual = json(base + 'catalog.json').icons;
    const all = catalogs.flatMap((c) => c.icons);
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    expect(all.map((i) => i.name).sort()).toEqual(
      actual.map((i: { name: string }) => i.name).sort(),
    );
    for (const icon of all) {
      const asset = actual.find((i: { name: string }) => i.name === icon.name);
      expect(icon.id).toBe('oddkin/' + asset.name);
      expect(icon.gallery).toBe(asset.domain);
      expect(icon.source_metadata.asset_path).toBe(base + asset.file);
      expect(icon.preview.inline_svg).toBe(readFileSync(new URL(base + asset.file, root), 'utf8'));
      expect(icon.source_metadata.figma.node_id).toBe(asset.figma.id);
      expect(icon.source_metadata.figma.component_name).toBe(asset.figma.name);
      expect(icon.preview.component_name).toBe(asset.figma.name);
      expect(icon.available_styles).toEqual(['outline']);
    }
  });

  it('preserves every supplied reference identity and source naming flag without claiming source artwork', () => {
    const reference = json(base + 'reference-map.json').references;
    const ids = catalogs.flatMap((c) =>
      c.icons.flatMap(
        (i: { source_metadata: { reference_ids: string[] } }) => i.source_metadata.reference_ids,
      ),
    );
    expect(ids.sort()).toEqual(reference.map((r: { id: string }) => r.id).sort());
    for (const source of sourceCatalogs.flatMap((c) => c.icons)) {
      expect(ids).toContain(source.id);
      const target = catalogs
        .flatMap((c) => c.icons)
        .find((i) => i.source_metadata.reference_ids.includes(source.id));
      expect(target.aliases).toContain(source.id);
      for (const note of source.review.notes) expect(target.review.notes).toContain(note);
    }
  });

  it('places reusable controls and scientific tools in General and qualified spatial data in GIS', () => {
    const names = (domain: string) =>
      catalogs.find((c) => c.gallery === domain).icons.map((i: { name: string }) => i.name);
    expect(names('general')).toEqual(
      expect.arrayContaining([
        'map',
        'route',
        'location-history',
        'layers-edit',
        'layers-filter',
        'layers-plus',
        'magnet',
        'appointment',
        'heart',
        'wheelchair',
        'lab-flask',
        'microscope',
        'thermometer',
      ]),
    );
    expect(names('gis')).toEqual(
      expect.arrayContaining([
        'database-polygon',
        'database-raster-grid',
        'spatial-join',
        'watershed',
        'map-database',
      ]),
    );
    expect(names('healthcare')).toEqual(
      expect.arrayContaining([
        'heart-organ',
        'rapid-test-positive',
        'blood-type-a-positive',
        'patient-id',
      ]),
    );
  });
});
