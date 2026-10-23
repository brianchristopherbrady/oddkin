import { mkdir, writeFile, readFile, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { format } from 'prettier';
import { catalog as originals } from './catalog.mjs';
import { resolveGlyph } from './reference-art.mjs';
import { resolveHealthcare } from './healthcare-art.mjs';
import { classifyArtwork } from './classification.mjs';
import { writeDomainCatalogs } from './build-catalogs.mjs';
import { get, normalized, path, circle, line, enclosure } from './outline-art.mjs';

const root = new URL('./', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('./inventories/gis.json', root), 'utf8'));
const healthcareInventory = JSON.parse(
  await readFile(new URL('./inventories/healthcare.json', root), 'utf8'),
);
const inventoryFiles = ['gis-icons.json', 'healthcare-only-icons.json'];
const inventorySnapshots = [
  {
    source: 'gis-icons.json',
    path: 'design/icons/inventories/gis.json',
    entries: inventory.icons.length,
  },
  {
    source: 'healthcare-only-icons.json',
    path: 'design/icons/inventories/healthcare.json',
    entries: healthcareInventory.icons.length,
  },
];
const icons = new Map(),
  coverage = [];
const title = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const manualCategories = {
  general: 'Interface',
  gis: 'Spatial tools',
  healthcare: 'Care & health',
};
function ensure(g, domain, category, label) {
  if (!g) throw Error('Missing glyph');
  if (!icons.has(g.key))
    icons.set(g.key, {
      name: g.key,
      domain,
      category,
      label: label || title(g.key),
      body: g.body,
      references: [],
    });
  return icons.get(g.key);
}
for (const i of originals) ensure(get(normalized(i.name)), i.domain, i.category, i.label);
const coreAliases = {
  user: 'person',
  settings: 'gear',
  info: 'information',
  sort: 'sort-ascending',
  eye: 'visibility-eye',
  checkCircle: 'check-circle',
};
const visibility = {
  key: 'visibility-eye',
  body: path('M 1.5 10 Q 10 -2 18.5 10 Q 10 22 1.5 10 Z') + path(circle(10, 10, 3)),
  category: 'Controls & status',
};
const checkCircle = { ...enclosure(get('check')), key: 'check-circle' };
const coreNames =
  'chevronDown chevronRight chevronUp arrowRight arrowLeft home external search grid settings bold user filter sort check close plus minus more info warning checkCircle eye spinner lock folder file download trash mail upload copy calendar clock'.split(
    ' ',
  );
for (const last of coreNames) {
  const name = coreAliases[last] || normalized(last);
  const g =
    name === 'visibility-eye'
      ? visibility
      : name === 'check-circle'
        ? checkCircle
        : resolveGlyph(name);
  ensure(g, 'general', 'Core controls');
}
const generalRoots =
  /^(?:direction|arrow|chevron|caret|align|text|original-application-mark|file|folder|grid|chart|number|sort|panel|list|form|font|paragraph|heading|table|calendar|clock|date|time|speech|message|person|people|user|home|building|school|shop|bank|money|credit|car|truck|bus|train|bicycle|motorcycle|boat|airplane|door|rocket|phone|mobile|monitor|computer|camera|video|image|play|pause|stop|volume|microphone|music|cloud|sun|moon|snow|rain|wind|leaf|tree|plant|flower|paw|dog|cat|bird|fish|bear|horse|cow|deer|mosquito|turtle|frog|crab|snake|alligator|elephant|mushroom|coral|ball|baseball|basketball|rugby|volleyball|racket|golf|swimming|skiing|skating|running|walking|beach|carousel|dice|thumb|star|square|circle|triangle|rectangle|diamond|pentagon|hexagon|octagon|ellipse|cube|crosshair|compass|map-pin|globe|layers|layer-add|layer-visibility|bounding-box|attribute-table|information|warning|question|check|close|plus|minus|more|search|gear|filter|lock|unlock|bell|bookmark|link|share|external|save|copy|download|upload|trash|mail|refresh|undo|redo|pencil|brush|palette|scissors|print|tag|certificate|paperclip|calculator|banana|beaker|braces|brackets|asterisk|puzzle|cursor|crop|pin|desk|bug|robot|toggle|hourglass|translate|fingerprint|face-id|touch|contrast|spinner|expand|contract|rotate|flip|recurrence|resize|separator|grip|road|fence|barrier|yield|shield|scales|podium|hand|box|package|ribbon|medal|trophy|flag|battery|lightning|magnifier|mortar|terminal|code|network|server|database|plug|speed|gauge|magnet|chain|infinity|water|fire|flame|skull|gun|knife|handcuffs|recycle|toilet|bed|lamp|stair|ramp|parking|legend|dimension|rings|braille|compare)(?:-|$)/;
const healthRoots =
  /^(?:hospital|clinic|emergency|ambulance|medical|first-aid|home-care|telehealth|clinician|nurse|patient|care-team|appointment|consultation|heart|blood|thermometer|pulse|respiration|weight|height-measure|pill|capsule|syringe|vaccine|prescription|medication|iv-bag|infusion|brain|lungs|eye|ear|tooth|bone|kidney|liver|test-tube|lab-flask|microscope|petri|dna|x-ray|ultrasound|scan$|bandage|wheelchair|crutches|rehabilitation|mental-health|nutrition|maternity|pediatrics|shield-health|hygiene|mask|biohazard|allergy|organ-donation|health-analytics)(?:-|$)/;
function classify(g, entry) {
  if (icons.has(g.key)) return icons.get(g.key).domain;
  if (healthRoots.test(g.key)) return 'healthcare';
  if (/^(layers-|grid-(?:raster|classify|multidimensional|snap-to-pixel))/.test(g.key))
    return 'gis';
  if (generalRoots.test(g.key)) return 'general';
  return /GIS|Geometry|Layers|Raster|Template Group|Public Works|Knowledge Graph/i.test(
    entry.category,
  )
    ? 'gis'
    : 'general';
}
function category(g, domain, entry) {
  const k = g.key;
  if (domain === 'healthcare')
    return /heart|blood|pulse|thermo|respirat|weight/.test(k)
      ? 'Vitals'
      : /pill|syringe|medic|iv-|infusion/.test(k)
        ? 'Medicines & equipment'
        : /eye|ear|tooth|bone|brain|lung|kidney|liver|dna/.test(k)
          ? 'Anatomy'
          : 'Care & health';
  if (domain === 'gis')
    return /pipe|pump|valve|tank|meter|transformer|hydrant|electrical|gas|sewer|fitting|anomaly|solar|windmill/.test(
      k,
    )
      ? 'Utilities & infrastructure'
      : /raster|mosaic|terrain|contour|hillshade|satellite|watershed|heatmap|elevation/.test(k)
        ? 'Terrain, raster & analysis'
        : /polygon|point|line|vertex|geometry|intersection|parcel|buffer|lasso|curve|arc|midpoint/.test(
              k,
            )
          ? 'Geometry & editing'
          : 'Mapping, survey & analysis';
  if (/direction|arrow|chevron|caret|compass|map-pin|globe/.test(k)) return 'Navigation & location';
  if (/text|font|heading|paragraph|bold|italic|underline|brackets|braces/.test(k))
    return 'Typography & formatting';
  if (/file|folder|print|mail|clipboard|paperclip|tag|certificate/.test(k))
    return 'Files & documents';
  if (
    /chart|grid|network|server|database|layer|table|panel|list|layout|border|align|resize|dimension/.test(
      k,
    )
  )
    return 'Data & layout';
  if (/car|truck|bus|train|bicycle|motorcycle|airplane|boat|road|parking|walking|running/.test(k))
    return 'Transport & mobility';
  if (
    /animal|paw|dog|cat|bird|fish|bear|horse|cow|deer|mosquito|turtle|frog|crab|snake|alligator|elephant|plant|leaf|tree|flower|mushroom|coral|sun|moon|cloud|rain|snow|wind/.test(
      k,
    )
  )
    return 'Nature & weather';
  if (/sport|ball|golf|swim|ski|skat|beach|carousel|dice/.test(k)) return 'Recreation & places';
  if (/calendar|clock|date|hourglass|recurrence/.test(k)) return 'Date & time';
  return 'Controls, objects & actions';
}
for (const entry of inventory.icons) {
  const slug = normalized(entry.name.split('/').at(-1));
  const g = resolveGlyph(slug, entry);
  if (!g) throw Error(`Unmapped reference ${entry.id}`);
  const domain = classify(g, entry);
  const icon = ensure(g, domain, category(g, domain, entry));
  icon.references.push(entry.id);
  coverage.push({
    id: entry.id,
    name: entry.name,
    collection: entry.collection,
    category: entry.category,
    sourceStyle: entry.style,
    icon: g.key,
    domain: icon.domain,
    artworkStyle: 'oddkin-outline',
    referenceUrl: entry.reference_url,
  });
}
function healthcareCategory(entry, g) {
  const c = entry.source_category || '';
  if (
    entry.is_brand_or_standard_identity ||
    /icd|loinc|hl7|fhir|clinical|health-data|healthcare-it/.test(g.key)
  )
    return 'Records & health informatics';
  if (entry.source === 'carbon') return 'Clinical imaging & studies';
  if (c === 'blood') return 'Blood & transfusion';
  if (c === 'body') return 'Clinical anatomy';
  if (c === 'conditions' || c === 'emotions' || c === 'symptoms') return 'Conditions & symptoms';
  if (
    c === 'contraceptives' ||
    /gestation|fetus|pregnan|maternal|neonatal|antenatal|delivery|lactation|contracept/.test(g.key)
  )
    return 'Reproductive & maternal care';
  if (c === 'diagnostics') return 'Diagnostics & tests';
  if (c === 'devices') return 'Clinical devices & equipment';
  if (c === 'medications' || /pill|medicine|vaccine|medication|prescription/.test(g.key))
    return 'Medicines & treatment';
  if (c === 'specialties' || c === 'Hospital signage') return 'Departments & care services';
  if (c === 'people' || c === 'forms_tasks_targets' || c === 'specific_usecase')
    return 'People & community care';
  if (c === 'places' || c === 'vehicles') return 'Facilities & care transport';
  if (c === 'ppe' || c === 'personal-hygiene' || c === 'vaccine-protection')
    return 'Infection control & PPE';
  if (c === 'graphs' || c === 'graph') return 'Public health & reporting';
  if (c === 'quarantine' || c === 'social-distancing') return 'Quarantine & distancing';
  if (entry.source === 'covid') return 'Infection & transmission';
  return 'Clinical care & procedures';
}
for (const entry of healthcareInventory.icons) {
  const g = resolveHealthcare(entry);
  if (!g) throw Error('Unmapped healthcare reference ' + entry.id);
  const existing = icons.get(g.key);
  const icon = ensure(
    g,
    existing?.domain || 'healthcare',
    existing?.category || healthcareCategory(entry, g),
  );
  icon.references.push(entry.id);
  coverage.push({
    id: entry.id,
    name: entry.name,
    displayName: entry.display_name,
    collection: entry.source,
    category: entry.source_category,
    sourceStyle: entry.available_styles,
    icon: g.key,
    domain: icon.domain,
    artworkStyle: 'oddkin-outline',
    referenceUrl: entry.reference_url,
    inventory: 'healthcare-only-icons.json',
    isBrandOrStandardIdentity: entry.is_brand_or_standard_identity,
  });
}
for (const icon of icons.values()) {
  if (icon.domain !== 'healthcare') continue;
  const groups = {
    Anatomy: 'Clinical anatomy',
    'Care pathways': 'Clinical care & procedures',
    'Care settings': 'Facilities & care transport',
    'Health operations': 'Clinical care & procedures',
    'Labs & imaging': 'Diagnostics & tests',
    'Medicines & equipment': 'Medicines & treatment',
    'People & records': 'People & community care',
  };
  icon.category = groups[icon.category] || icon.category;
  if (['x-ray', 'ultrasound', 'scan'].includes(icon.name))
    icon.category = 'Clinical imaging & studies';
  if (['iv-bag', 'infusion-pump', 'pulse-oximeter', 'blood-pressure'].includes(icon.name))
    icon.category = 'Clinical devices & equipment';
  if (['medical-record', 'patient-id'].includes(icon.name))
    icon.category = 'Records & health informatics';
}
let figmaMap = [];
try {
  figmaMap = JSON.parse(await readFile(new URL('figma-map.json', root), 'utf8')).icons;
} catch {}
for (const row of figmaMap) {
  const i = icons.get(row.icon);
  if (i) i.figma = { id: row.id, name: row.name };
}
for (const i of icons.values()) {
  if (
    /^(?:air-conditioning|binoculars|fan|mountain|pie-chart-section|switch-multiple|eye-check|eye-search|clipboard-)/.test(
      i.name,
    )
  ) {
    i.domain = 'general';
    i.category = category({ key: i.name }, 'general', {});
  }
  if (i.domain === 'general' && i.category === 'Navigation') i.category = 'Navigation & location';
  if (i.domain === 'general' && ['Geometry', 'Layers & data'].includes(i.category))
    i.category = 'Data & layout';
  if (i.domain === 'gis' && i.category === 'Geometry') i.category = 'Geometry & editing';
  if (i.domain === 'gis' && i.category === 'Terrain & imagery')
    i.category = 'Terrain, raster & analysis';
  if (i.name === 'scan-perimeter') i.category = 'Mapping, survey & analysis';
  if (i.figma && i.figma.name.split('/').length === 4)
    i.figma.name = i.figma.name.replace(
      /\/(General|GIS|Healthcare)\//,
      '/' +
        (i.domain === 'gis' ? 'GIS' : i.domain === 'healthcare' ? 'Healthcare' : 'General') +
        '/',
    );
}
for (const i of icons.values()) {
  const classification = classifyArtwork(i);
  i.domain = classification.domain;
  i.category = classification.category;
  i.classificationReason = classification.reason;
  if (i.figma && i.figma.name.split('/').length === 4)
    i.figma.name = i.figma.name.replace(
      /\/(General|GIS|Healthcare)\//,
      `/${i.domain === 'gis' ? 'GIS' : i.domain === 'healthcare' ? 'Healthcare' : 'General'}/`,
    );
}
for (const r of coverage) r.domain = icons.get(r.icon).domain;
const data = [...icons.values()].sort(
  (a, b) =>
    a.domain.localeCompare(b.domain) ||
    a.category.localeCompare(b.category) ||
    a.name.localeCompare(b.name),
);
// Measure real vector geometry, then fit it inside the native 20 px canvas.
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const invalid = await page.evaluate(
  (rows) =>
    rows.flatMap((i) => {
      const d = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${i.body}</svg>`,
        'image/svg+xml',
      );
      return d.querySelector('parsererror') ? [i.name] : [];
    }),
  data,
);
if (invalid.length) {
  await browser.close();
  throw Error('Invalid SVG: ' + invalid.join(', '));
}
await page.setContent(
  '<!doctype html><body>' +
    data
      .map(
        (i) =>
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g>${i.body}</g></svg>`,
      )
      .join(''),
);
const normalizedBodies = await page.evaluate(() =>
  [...document.querySelectorAll('svg')].map((svg) => {
    const g = svg.firstElementChild,
      b = g.getBBox();
    const s = Math.min(1, 17 / b.width, 17 / b.height),
      x = 10 - s * (b.x + b.width / 2),
      y = 10 - s * (b.y + b.height / 2);
    g.setAttribute(
      'transform',
      `translate(${x.toFixed(4)} ${y.toFixed(4)}) scale(${s.toFixed(6)})`,
    );
    for (const p of g.querySelectorAll('path')) {
      const t = p.getCTM();
      p.setAttribute('stroke-width', (1.5 / Math.sqrt(Math.abs(t.a * t.d - t.b * t.c))).toFixed(5));
    }
    return {
      body: g.outerHTML,
      bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
      fit: { scale: s, x, y },
    };
  }),
);
await browser.close();
const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const svg = (i) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${escape(i.label)}"><title>${escape(i.label)}</title>${i.body}</svg>\n`;
for (const domain of ['general', 'gis', 'healthcare'])
  await mkdir(new URL(domain + '/', root), { recursive: true });
for (let n = 0; n < data.length; n++) {
  const i = data[n];
  i.body = normalizedBodies[n].body;
  i.file = `${i.domain}/${i.name}.svg`;
  i.referenceCount = i.references.length;
  i.svg = svg(i);
  const assetUrl = new URL(i.file, root);
  let previous;
  try {
    previous = await readFile(assetUrl, 'utf8');
  } catch {}
  if (previous !== i.svg) await writeFile(assetUrl, i.svg);
}
const expectedFiles = new Set(data.map((i) => i.file));
for (const domain of ['general', 'gis', 'healthcare'])
  for (const file of await readdir(new URL(domain + '/', root))) {
    const relative = domain + '/' + file;
    if (file.endsWith('.svg') && !expectedFiles.has(relative))
      await unlink(new URL(relative, root));
  }
await writeFile(
  new URL('catalog.json', root),
  await format(
    JSON.stringify({
      grid: 20,
      strokeWidth: 1.5,
      license: 'MIT',
      artwork: 'Original Oddkin paths; inventory names and categories are references only.',
      sourceInventory: 'gis-icons.json',
      sourceInventories: inventoryFiles,
      inventorySnapshots,
      sourceEntries: inventory.icons.length + healthcareInventory.icons.length,
      sourceStylePolicy:
        'Filled and outlined source entries map to the corresponding Oddkin outline concept. This is not a reproduction of source visual variants.',
      icons: data.map(({ svg, ...i }) => i),
    }),
    { parser: 'json', printWidth: 100, singleQuote: true, trailingComma: 'all' },
  ),
);
await writeFile(
  new URL('reference-map.json', root),
  await format(
    JSON.stringify({
      inventory: 'gis-icons.json',
      inventories: inventoryFiles,
      inventorySnapshots,
      entries: coverage.length,
      canonicalIcons: data.length,
      unmapped: [],
      references: coverage,
    }),
    { parser: 'json', printWidth: 100, singleQuote: true, trailingComma: 'all' },
  ),
);
await writeFile(new URL('../../.tmp/icons-figma-import.json', root), JSON.stringify(data));
const sections = ['general', 'gis', 'healthcare']
  .map((domain) => {
    const items = data.filter((i) => i.domain === domain);
    const categories = [...new Set(items.map((i) => i.category))];
    return `<section id="${domain}"><h2>${title(domain)} · ${items.length}</h2>${categories
      .map(
        (c) =>
          `<h3>${escape(c)}</h3><div class="grid">${items
            .filter((i) => i.category === c)
            .map(
              (i) =>
                `<article><div>${i.svg}</div><b>${escape(i.label)}</b><small>${i.name}</small><span>${i.referenceCount} reference aliases</span></article>`,
            )
            .join('')}</div>`,
      )
      .join('')}</section>`;
  })
  .join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Oddkin icons</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f6f3;color:#242529;font:14px system-ui;padding:32px}h1{margin:0 0 12px}p{color:#626472}nav{position:sticky;top:0;background:#f7f6f3;padding:16px 0;display:flex;gap:24px}a{color:#624cf2}.grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:12px}article{display:flex;flex-direction:column;align-items:center;min-height:140px;background:white;border:1px solid #dadbe1;border-radius:8px;gap:6px;text-align:center;padding:12px;overflow-wrap:anywhere}article div{height:42px;display:flex;align-items:center}svg{width:20px;height:20px}b{font-size:12px}small,span{color:#626472;font-size:10px}section{margin:48px 0}h3{margin:32px 0 16px}</style><h1>Oddkin · Icon library</h1><p>${data.length} original outline assets · ${coverage.length} reference IDs covered · 20 px / 1.5 px rounded strokes</p><nav><a href="#general">General</a><a href="#gis">GIS</a><a href="#healthcare">Healthcare</a></nav>${sections}</html>`;
await writeFile(
  new URL('preview.html', root),
  await format(html, { parser: 'html', printWidth: 100, singleQuote: true, trailingComma: 'all' }),
);
await writeDomainCatalogs();
console.log(
  JSON.stringify(
    {
      generated: data.length,
      references: coverage.length,
      domains: Object.fromEntries(
        ['general', 'gis', 'healthcare'].map((d) => [d, data.filter((i) => i.domain === d).length]),
      ),
      existing: data.filter((i) => i.figma).length,
      folder: fileURLToPath(root),
    },
    null,
    2,
  ),
);
