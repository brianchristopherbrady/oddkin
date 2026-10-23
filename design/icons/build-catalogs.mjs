import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { format } from 'prettier';

const root = new URL('./', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const unique = (a) => [...new Set(a.filter((v) => v !== null && v !== undefined && v !== ''))];
const title = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const packageFor = (domain) => `@oddkin/icons-${domain}`;
const fieldNames = [
  'id',
  'name',
  'slug',
  'display_name',
  'tags',
  'aliases',
  'search_terms',
  'search_text',
];

export async function domainCatalogs() {
  const raw = await readFile(new URL('catalog.json', root), 'utf8');
  const catalog = JSON.parse(raw);
  const refs = await read('reference-map.json');
  const sourceCatalogs = await Promise.all(
    ['gis-only-icons.json', 'healthcare-only-icons.json'].map((f) =>
      read('inventories/reference-catalogs/' + f),
    ),
  );
  const original = new Map(sourceCatalogs.flatMap((c) => c.icons).map((i) => [i.id, i]));
  const reference = new Map(refs.references.map((r) => [r.id, r]));
  const results = [];
  for (const domain of ['general', 'gis', 'healthcare']) {
    const assets = catalog.icons.filter((i) => i.domain === domain);
    const icons = await Promise.all(
      assets.map(async (i) => {
        if (!i.figma) throw Error('Missing Figma mapping: ' + i.name);
        const aliases = unique(
          i.references.flatMap((id) => {
            const r = reference.get(id),
              o = original.get(id);
            return [id, r?.name, r?.displayName, ...(o?.aliases || [])];
          }),
        );
        const notes = unique(i.references.flatMap((id) => original.get(id)?.review.notes || []));
        const tags = unique([
          domain,
          i.category.toLowerCase(),
          ...i.references.flatMap((id) => original.get(id)?.tags || []),
        ]);
        const terms = unique(
          [i.name, i.label, i.category, domain, ...tags, ...aliases].flatMap((s) => [
            s.toLowerCase(),
            ...s.toLowerCase().split(/[^a-z0-9]+/),
          ]),
        );
        const url = `https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Untitled?node-id=${i.figma.id.replace(':', '-')}`;
        return {
          id: `oddkin/${i.name}`,
          name: i.name,
          slug: slug(i.name),
          display_name: i.label,
          description: `Original Oddkin ${i.label.toLowerCase()} outline icon.`,
          gallery: domain,
          suggested_package: packageFor(domain),
          category_id: slug(i.category),
          source: 'oddkin',
          source_category: i.category,
          tags,
          aliases,
          search_terms: terms,
          search_text: terms.join(' '),
          available_styles: ['outline'],
          available_color_variants: ['default'],
          is_brand_or_standard_identity: false,
          reference_url: url,
          preview: {
            status: 'inline',
            format: 'svg',
            url: null,
            inline_svg: await readFile(new URL(i.file, root), 'utf8'),
            source_path: `design/icons/${i.file}`,
            bundle_url: null,
            import_path: null,
            component_name: i.figma.name,
            style: 'outline',
            color_variant: 'default',
            view_box: '0 0 20 20',
          },
          source_names: [i.name],
          source_svg_file_count: 1,
          source_notes: [
            'Original Oddkin paths. Reference identities are aliases, not imported artwork or promised source-style variants.',
          ],
          classification: { status: 'assigned', reason: i.classificationReason },
          review: { status: notes.length ? 'needs-review' : 'not-flagged', notes },
          source_metadata: {
            asset_path: `design/icons/${i.file}`,
            figma: {
              file_key: 'E7LfRysny8V3qU24tv082i',
              node_id: i.figma.id,
              component_name: i.figma.name,
              url,
            },
            geometry: {
              width: 20,
              height: 20,
              view_box: '0 0 20 20',
              stroke_width: 1.5,
              stroke_linecap: 'round',
              stroke_linejoin: 'round',
              fill: 'none',
            },
            reference_ids: [...i.references],
            reference_catalogs: unique(
              i.references.map((id) =>
                original.has(id)
                  ? `inventories/reference-catalogs/${original.get(id).gallery === 'gis' ? 'gis' : 'healthcare'}-only-icons.json`
                  : 'inventories/gis.json',
              ),
            ),
          },
        };
      }),
    );
    const categories = unique(assets.map((i) => i.category)).map((label) => ({
      id: slug(label),
      label,
      description: `${label} symbols in the ${title(domain)} gallery.`,
      icon_count: icons.filter((i) => i.category_id === slug(label)).length,
    }));
    const facets = (values, label = title) =>
      unique(values).map((value) => ({
        value,
        label: label(value),
        count: values.filter((v) => v === value).length,
      }));
    results.push({
      $schema: 'icon-catalog.schema.json',
      schema_version: '1.0.0',
      catalog_id: domain,
      title: `Oddkin ${title(domain)} icons`,
      description: `Original Oddkin ${domain} SVG assets and their existing Figma main components. Reference-only source catalogs are retained separately.`,
      gallery: domain,
      suggested_package: packageFor(domain),
      source_inventory_as_of_date: '2026-10-22',
      icon_count: icons.length,
      search_fields: fieldNames,
      categories,
      sources: [
        {
          id: 'oddkin',
          name: 'Oddkin',
          repository_url: null,
          reference_url:
            'https://www.figma.com/design/E7LfRysny8V3qU24tv082i/Untitled?node-id=359-2',
          version: null,
          commit: null,
          inventory_url: null,
          selection:
            'Existing original Oddkin artwork assigned by semantic purpose, independently of reference origin.',
          inventory_icon_count: icons.length,
          inventory_svg_file_count: icons.length,
          catalog_icon_count: icons.length,
          license: { id: 'MIT', url: null },
          source_metadata: {
            artwork_source: 'design/icons/catalog.json',
            native_grid: 20,
            physical_stroke_width: 1.5,
          },
        },
      ],
      facets: {
        categories: facets(
          icons.map((i) => i.category_id),
          (v) => categories.find((c) => c.id === v).label,
        ),
        sources: facets(
          icons.map((i) => i.source),
          () => 'Oddkin',
        ),
        styles: facets(icons.flatMap((i) => i.available_styles)),
        color_variants: facets(icons.flatMap((i) => i.available_color_variants)),
        brand_status: facets(
          icons.map((i) => i.is_brand_or_standard_identity),
          (v) => (v ? 'Brand or standard' : 'Original functional artwork'),
        ),
        review_status: facets(icons.map((i) => i.review.status)),
        preview_status: facets(icons.map((i) => i.preview.status)),
      },
      provenance: {
        input_filename: 'catalog.json',
        input_sha256: createHash('sha256').update(raw).digest('hex'),
        normalization_method:
          'One record per original Oddkin SVG/Figma component. Stable oddkin/name IDs survive gallery changes. Reference identities, naming flags and source metadata remain linked to retained inventories; original source drawing styles are not claimed.',
        original_catalog_metadata: {
          grid: catalog.grid,
          strokeWidth: catalog.strokeWidth,
          license: catalog.license,
          artwork: catalog.artwork,
          sourceEntries: catalog.sourceEntries,
          inventorySnapshots: catalog.inventorySnapshots,
        },
      },
      icons,
    });
  }
  return results;
}

export async function writeDomainCatalogs({ check = false } = {}) {
  for (const data of await domainCatalogs()) {
    const file = `${data.gallery}-only-icons.json`;
    if (check) {
      if (JSON.stringify(await read(file)) !== JSON.stringify(data))
        throw Error('Stale generated catalog: ' + file);
    } else
      await writeFile(
        new URL(file, root),
        await format(JSON.stringify(data), {
          parser: 'json',
          printWidth: 100,
          singleQuote: true,
          trailingComma: 'all',
        }),
      );
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await writeDomainCatalogs({ check: process.argv.includes('--check') });
