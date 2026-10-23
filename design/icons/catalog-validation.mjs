import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function catalogValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function validateCatalog(data, validate) {
  assert(validate(data), JSON.stringify(validate.errors));
  const unique = (rows, key) =>
    assert.equal(new Set(rows.map((r) => r[key])).size, rows.length, `Duplicate ${key}`);
  unique(data.icons, 'id');
  unique(data.categories, 'id');
  unique(data.sources, 'id');
  assert.equal(data.icon_count, data.icons.length);
  for (const icon of data.icons) {
    assert.equal(icon.gallery, data.gallery, icon.id);
    assert.equal(icon.suggested_package, data.suggested_package, icon.id);
    assert(
      data.categories.some((c) => c.id === icon.category_id),
      'Category foreign key: ' + icon.id,
    );
    assert(
      data.sources.some((s) => s.id === icon.source),
      'Source foreign key: ' + icon.id,
    );
    assert.equal(icon.search_text, icon.search_text.toLowerCase(), icon.id);
    assert(
      icon.search_terms.every((s) => s === s.toLowerCase()),
      icon.id,
    );
  }
  for (const c of data.categories)
    assert.equal(c.icon_count, data.icons.filter((i) => i.category_id === c.id).length, c.id);
  for (const s of data.sources)
    assert.equal(s.catalog_icon_count, data.icons.filter((i) => i.source === s.id).length, s.id);
  const fields = {
    categories: 'category_id',
    sources: 'source',
    styles: 'available_styles',
    color_variants: 'available_color_variants',
    brand_status: 'is_brand_or_standard_identity',
    review_status: 'review.status',
    preview_status: 'preview.status',
  };
  for (const [key, field] of Object.entries(fields)) {
    const values = data.icons.flatMap((i) => field.split('.').reduce((v, k) => v[k], i));
    assert.deepEqual(
      new Set(data.facets[key].map((f) => f.value)),
      new Set(values),
      'Facet values: ' + key,
    );
    for (const f of data.facets[key])
      assert.equal(f.count, values.filter((v) => v === f.value).length, 'Facet count: ' + key);
  }
}
