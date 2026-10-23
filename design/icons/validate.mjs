import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { catalogValidator, validateCatalog } from './catalog-validation.mjs';
import { writeDomainCatalogs } from './build-catalogs.mjs';
const root = new URL('./', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
const reference = JSON.parse(await readFile(new URL('reference-map.json', root), 'utf8'));
const schema = JSON.parse(await readFile(new URL('icon-catalog.schema.json', root), 'utf8'));
const validate = catalogValidator(schema);
for (const file of [
  'general-only-icons.json',
  'gis-only-icons.json',
  'healthcare-only-icons.json',
  'inventories/reference-catalogs/gis-only-icons.json',
  'inventories/reference-catalogs/healthcare-only-icons.json',
])
  validateCatalog(JSON.parse(await readFile(new URL(file, root), 'utf8')), validate);
await writeDomainCatalogs({ check: true });
const inventories = await Promise.all(
  reference.inventorySnapshots.map(async ({ path }) =>
    JSON.parse(await readFile(new URL('../../' + path, root), 'utf8')),
  ),
);
const inventory = { icons: inventories.flatMap((i) => i.icons) };
assert.equal(
  new Set(catalog.icons.map((i) => i.name)).size,
  catalog.icons.length,
  'Duplicate canonical names',
);
assert.equal(
  new Set(catalog.icons.map((i) => i.file.toLowerCase())).size,
  catalog.icons.length,
  'Case-insensitive filename collision',
);
assert.equal(reference.references.length, inventory.icons.length, 'Reference count');
assert.deepEqual(
  reference.references.map((i) => i.id).sort(),
  inventory.icons.map((i) => i.id).sort(),
  'Every source ID must appear exactly once',
);
assert.equal(reference.unmapped.length, 0, 'Unmapped reference entries');
for (const row of reference.references)
  assert(
    catalog.icons.some((i) => i.name === row.icon && i.domain === row.domain),
    `Missing target ${row.id}`,
  );
const svgs = [];
for (const i of catalog.icons) {
  const svg = await readFile(new URL(i.file, root), 'utf8');
  assert(svg.includes('stroke="currentColor"'), i.name + ' does not inherit color');
  assert(
    !/https?:\/\/(?!www\.w3\.org)|<script|<image|<text\b/.test(svg),
    i.name + ' has external or font dependencies',
  );
  svgs.push({ name: i.name, svg });
}
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = await page.evaluate((rows) => {
  const errors = [];
  for (const i of rows) {
    const parsed = new DOMParser().parseFromString(i.svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) {
      errors.push(i.name + ': invalid XML');
      continue;
    }
    const svg = document.importNode(parsed.documentElement, true);
    document.body.appendChild(svg);
    if (svg.getAttribute('viewBox') !== '0 0 20 20') errors.push(i.name + ': canvas');
    const g = svg.querySelector('g'),
      b = g.getBBox(),
      m = g.getCTM();
    if (!b.width && !b.height) errors.push(i.name + ': empty artwork');
    const x = m.a * b.x + m.e,
      y = m.d * b.y + m.f,
      w = m.a * b.width,
      h = m.d * b.height;
    if (x < 0.74 || y < 0.74 || x + w > 19.26 || y + h > 19.26) errors.push(i.name + ': clipping');
    if (Math.abs(x + w / 2 - 10) > 0.002 || Math.abs(y + h / 2 - 10) > 0.002)
      errors.push(i.name + ': off-center artwork');
    if (Math.max(w, h) > 17.002) errors.push(i.name + ': artwork exceeds the 17 px safe area');
    for (const p of g.querySelectorAll('path')) {
      const style = getComputedStyle(p);
      if (style.strokeLinecap !== 'round' || style.strokeLinejoin !== 'round')
        errors.push(i.name + ': inconsistent cap/join');
      if (style.fill !== 'none') errors.push(i.name + ': opaque path');
      if (!p.getAttribute('d')?.trim().startsWith('M')) errors.push(i.name + ': malformed path');
      const t = p.getCTM(),
        weight =
          Number(getComputedStyle(p).strokeWidth.replace('px', '')) *
          Math.sqrt(Math.abs(t.a * t.d - t.b * t.c));
      if (Math.abs(weight - 1.5) > 0.002) errors.push(i.name + ': inconsistent stroke ' + weight);
    }
    svg.remove();
  }
  return errors;
}, svgs);
await browser.close();
assert.deepEqual(errors, [], 'Vector validation errors');
const expected = new Set(catalog.icons.map((i) => i.file));
const extras = [];
for (const d of ['general', 'gis', 'healthcare'])
  for (const f of await readdir(new URL(d + '/', root)))
    if (f.endsWith('.svg') && !expected.has(d + '/' + f)) extras.push(d + '/' + f);
assert.deepEqual(extras, [], 'Stale SVG assets');
console.log(
  JSON.stringify(
    {
      icons: catalog.icons.length,
      sourceEntries: reference.references.length,
      checks: [
        'three fresh schema-valid Oddkin catalogs and two retained reference catalogs',
        'catalog IDs, joins, counts and facets',
        'complete reference coverage',
        'unique names and paths',
        'valid editable SVG geometry',
        '20 px canvas',
        'uniform 1.5 px physical strokes',
        'centered artwork and 17 px safe area',
        'rounded caps and joins',
        'no clipping',
        'currentColor',
        'no font or network dependencies',
        'no stale assets',
      ],
    },
    null,
    2,
  ),
);
