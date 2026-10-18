// Compatibility check for Oddkin's platform feature registry and shipped CSS (ADR 0038).
//
// 1. Validates docs/compatibility/features.json against its schema, the pinned data versions,
//    and @mdn/browser-compat-data: foundations must be fully supported by every floor browser
//    (or list a documented floor exception), enhancements must actually exceed the floor and
//    name their gate, and every cited test must exist.
// 2. Verifies the token generator's above-floor syntax list against the same data.
// 3. Lints shipped and example CSS: every property, value function, keyword, unit, selector,
//    and at-rule that some floor browser lacks must be a registered enhancement, applied only
//    behind a matching @supports gate or as a literal parse-time fallback (never through var()).
// 4. Generates docs/compatibility/matrix.md; without --write, fails when it is out of date.
//
// Usage: node scripts/compat/check-css.mjs [--write]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import * as csstree from 'css-tree';
import {
  BROWSERS,
  baselineOf,
  children,
  compareVersions,
  dataVersions,
  DESKTOP,
  firstSupport,
  floorSupport,
  lookup,
  releaseDate,
  root,
  supportAt,
  webFeatures,
  widelyAvailableVersions,
} from './data.mjs';

const REGISTRY = join(root, 'docs/compatibility/features.json');
const SCHEMA = join(root, 'docs/schemas/compatibility.v1.schema.json');
const MATRIX = join(root, 'docs/compatibility/matrix.md');
const MOBILE = { chrome: 'chrome_android', firefox: 'firefox_android', safari: 'safari_ios' };

export function loadRegistry() {
  return JSON.parse(readFileSync(REGISTRY, 'utf8'));
}

// ---------------------------------------------------------------------------------------------
// Registry checks

/** Problems with the registry itself, as readable strings. */
export function checkRegistry(registry, { tokensFloor } = {}) {
  const problems = [];
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    allowUnionTypes: true,
  });
  addFormats.default(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA, 'utf8')));
  if (!validate(registry))
    for (const e of validate.errors ?? []) problems.push(`schema: ${e.instancePath} ${e.message}`);

  if (registry.data?.['@mdn/browser-compat-data'] !== dataVersions.bcd)
    problems.push(
      `data: registry pins @mdn/browser-compat-data ${registry.data?.['@mdn/browser-compat-data']}, installed ${dataVersions.bcd}; re-resolve the floor and update "checked".`,
    );
  if (registry.data?.['web-features'] !== dataVersions.webFeatures)
    problems.push(
      `data: registry pins web-features ${registry.data?.['web-features']}, installed ${dataVersions.webFeatures}.`,
    );
  if (tokensFloor)
    for (const [browser, version] of Object.entries(tokensFloor))
      if (registry.floor[browser] !== version)
        problems.push(
          `floor: @oddkin/tokens BROWSER_FLOOR.${browser} is ${version}, registry says ${registry.floor[browser]}.`,
        );

  const ids = new Set();
  for (const feature of registry.features ?? []) {
    const at = `feature "${feature.id}"`;
    if (ids.has(feature.id)) problems.push(`${at}: duplicate id`);
    ids.add(feature.id);
    if (feature.webFeature && !webFeatures[feature.webFeature])
      problems.push(`${at}: unknown web-features id "${feature.webFeature}"`);
    const failing = new Map();
    for (const key of feature.bcd ?? []) {
      if (!lookup(key)) {
        problems.push(`${at}: unknown BCD key ${key}`);
        continue;
      }
      for (const [browser, support] of Object.entries(floorSupport(key, registry.floor)))
        if (support.status !== 'full')
          failing.set(browser, [...(failing.get(browser) ?? []), `${key} (${support.status})`]);
    }
    const exceptions = feature.floorExceptions ?? {};
    if (feature.adoption === 'foundation') {
      for (const [browser, keys] of failing)
        if (!exceptions[browser])
          problems.push(
            `${at}: foundation feature not fully supported by ${BROWSERS[browser]} ${registry.floor[browser]}: ${keys.join(', ')}. Gate it as an enhancement, raise the floor, or document a floor exception.`,
          );
      for (const browser of Object.keys(exceptions))
        if (!failing.has(browser))
          problems.push(
            `${at}: stale floor exception for ${BROWSERS[browser]}; the data shows full support.`,
          );
    }
    if (feature.adoption === 'enhancement' && failing.size === 0)
      problems.push(`${at}: every floor browser fully supports it; reclassify it as a foundation.`);
    for (const test of feature.tests ?? []) {
      const file = join(root, test.file);
      if (!existsSync(file)) problems.push(`${at}: cited test file ${test.file} does not exist`);
      else if (!readFileSync(file, 'utf8').includes(test.name))
        problems.push(`${at}: ${test.file} has no test named "${test.name}"`);
    }
  }
  return problems;
}

/** Problems with the token generator's list of value syntax outside the floor. */
export function checkTokenSyntax(entries, floor) {
  const problems = [];
  for (const entry of entries) {
    if (!lookup(entry.bcd)) {
      problems.push(`token syntax ${entry.syntax}: unknown BCD key ${entry.bcd}`);
      continue;
    }
    const unsupported = DESKTOP.filter((b) => supportAt(entry.bcd, b, floor[b]) !== 'full');
    if (
      unsupported.join() !==
      [...entry.unsupported].sort((a, b) => DESKTOP.indexOf(a) - DESKTOP.indexOf(b)).join()
    )
      problems.push(
        `token syntax ${entry.syntax}: data says unsupported by [${unsupported.join(', ')}], floor.ts says [${entry.unsupported.join(', ')}]`,
      );
    for (const [desktop, mobile] of Object.entries(MOBILE)) {
      const a = supportAt(entry.bcd, desktop, floor[desktop]) === 'full';
      const b = supportAt(entry.bcd, mobile, floor[mobile]) === 'full';
      if (a !== b)
        problems.push(
          `token syntax ${entry.syntax}: ${BROWSERS[mobile]} differs from ${BROWSERS[desktop]}; list the mobile browser explicitly.`,
        );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// CSS lint

const SKIP_FUNCTIONS = new Set(['var', 'env', 'attr', 'url', 'format', 'local']);
const FORGIVING = new Set(['is', 'where']);
const SYSTEM_COLORS = new Set(
  [
    'AccentColor',
    'AccentColorText',
    'ActiveText',
    'ButtonBorder',
    'ButtonFace',
    'ButtonText',
    'Canvas',
    'CanvasText',
    'Field',
    'FieldText',
    'GrayText',
    'Highlight',
    'HighlightText',
    'LinkText',
    'Mark',
    'MarkText',
    'SelectedItem',
    'SelectedItemText',
    'VisitedText',
  ].map((c) => c.toLowerCase()),
);

function unitKey(unit) {
  const u = unit.toLowerCase();
  if (/^cq(w|h|i|b|min|max)$/.test(u)) return 'css.types.length.container_query_length_units';
  const viewport = /^(d|s|l)v(w|h|i|b|min|max)$/.exec(u);
  if (viewport)
    return `css.types.length.viewport_percentage_units_${{ d: 'dynamic', s: 'small', l: 'large' }[viewport[1]]}`;
  return lookup(`css.types.length.${u}`) ? `css.types.length.${u}` : undefined;
}

function functionKeys(name, property, node) {
  const fn = name.toLowerCase();
  if (SKIP_FUNCTIONS.has(fn)) return [];
  const keys = [];
  const base = [
    `css.types.${fn}`,
    `css.types.color.${fn}`,
    `css.types.gradient.${fn}`,
    `css.types.transform-function.${fn}`,
    `css.types.easing-function.${fn}`,
    `css.types.filter-function.${fn}`,
    `css.types.basic-shape.${fn}`,
    `css.properties.${property}.${fn}`,
  ].find((key) => lookup(key));
  if (base) keys.push(base);
  const first = node.children?.first;
  if (first?.type === 'Identifier' && first.name.toLowerCase() === 'from') {
    const relative = `css.types.color.${fn}.relative_syntax`;
    if (lookup(relative)) keys.push(relative);
  }
  if (['rgb', 'rgba', 'hsl', 'hsla'].includes(fn)) {
    const commas = node.children?.some((c) => c.type === 'Operator' && c.value === ',');
    const space = `css.types.color.${fn.replace('a', '')}.space_separated_parameters`;
    if (!commas && lookup(space)) keys.push(space);
  }
  return keys;
}

function normalize(text) {
  return text.replace(/\s+/g, '').toLowerCase();
}

/**
 * Lint one stylesheet. Returns { problems, uses } where uses maps BCD keys to occurrence
 * counts and problems lists unregistered or ungated features outside the floor.
 */
export function lintCss(text, { file, registry }) {
  const floor = registry.floor;
  const problems = [];
  const uses = new Map();
  const statusCache = new Map();
  const failingAt = (key) => {
    if (!statusCache.has(key)) {
      const failing = Object.entries(floorSupport(key, floor))
        .filter(([, s]) => s.status !== 'full')
        .map(([b]) => b);
      statusCache.set(key, failing);
    }
    return statusCache.get(key);
  };
  const registered = (key) => registry.features.filter((f) => f.bcd.includes(key));
  const where = (node) => `${file}:${node.loc?.start.line ?? '?'}`;

  let ast;
  try {
    ast = csstree.parse(text, {
      positions: true,
      filename: file,
      onParseError: (error) =>
        problems.push(`${file}:${error.line ?? '?'}: CSS parse error: ${error.message}`),
    });
  } catch (error) {
    return { problems: [`${file}: ${error.message}`], uses };
  }

  /**
   * Record a feature use. `gateTokens` are the texts that must appear in an enclosing
   * @supports gate for this use to count as gated; `literalFallback` marks a value that an
   * earlier floor-safe declaration of the same property backs up at parse time.
   */
  const use = (key, node, ctx, what, { gateTokens = [], literalFallback = false } = {}) => {
    if (!lookup(key)) return;
    uses.set(key, (uses.get(key) ?? 0) + 1);
    const failing = failingAt(key);
    if (failing.length === 0) return;
    const entries = registered(key);
    const exception = entries.find(
      (f) => f.adoption === 'foundation' && failing.every((b) => f.floorExceptions?.[b]),
    );
    if (exception) return;
    const enhancement = entries.find((f) => f.adoption === 'enhancement');
    const browsers = failing.map((b) => `${BROWSERS[b]} ${floor[b]}`).join(', ');
    if (!enhancement) {
      problems.push(
        `${where(node)}: ${what} (${key}) is not supported by ${browsers} and is not a registered enhancement.`,
      );
      return;
    }
    const gated = ctx.gates.some((gate) =>
      gateTokens.some((token) => gate.includes(normalize(token))),
    );
    if (!gated && !literalFallback)
      problems.push(
        `${where(node)}: ${what} is the registered enhancement "${enhancement.id}" but is not gated: wrap it in @supports (${gateTokens[0] ?? '…'}) or give the property a floor-safe literal value first (not through var()).`,
      );
  };

  const visitSelector = (selectorList, ctx) => {
    const selectors =
      selectorList.type === 'SelectorList' ? [...selectorList.children] : [selectorList];
    for (const selector of selectors) {
      const forgiving = [];
      csstree.walk(selector, {
        enter(node) {
          if (node.type === 'PseudoClassSelector' && FORGIVING.has(node.name)) forgiving.push(node);
          if (node.type === 'PseudoClassSelector' || node.type === 'PseudoElementSelector') {
            const prefix = node.type === 'PseudoClassSelector' ? ':' : '::';
            const key = `css.selectors.${node.name.toLowerCase()}`;
            const insideForgiving =
              forgiving.length > 0 && !(forgiving.length === 1 && forgiving[0] === node);
            const failing = lookup(key) ? failingAt(key) : [];
            if (
              failing.length &&
              selectors.length > 1 &&
              !insideForgiving &&
              !ctx.gates.some((g) => g.includes('selector('))
            )
              problems.push(
                `${where(node)}: ${prefix}${node.name} is outside the floor and shares a selector list, which invalidates the whole rule where unsupported; move it to its own rule behind @supports selector(${prefix}${node.name}…).`,
              );
            use(key, node, ctx, `${prefix}${node.name}`, {
              gateTokens: [`selector(${prefix}${node.name}`],
            });
          }
          if (node.type === 'NestingSelector')
            use('css.selectors.nesting', node, ctx, '& (nesting)');
        },
        leave(node) {
          if (forgiving.at(-1) === node) forgiving.pop();
        },
      });
    }
  };

  const visitDeclaration = (decl, ctx, earlier) => {
    const property = decl.property.toLowerCase();
    if (property.startsWith('--')) {
      use('css.properties.custom-property', decl, ctx, 'custom property');
      // A defined custom property is accepted whatever it holds; its readers fail instead
      // (F02). Above-floor syntax in the value therefore needs a gate: var() readers make a
      // literal parse-time fallback impossible.
      const raw = decl.value.type === 'Raw' ? decl.value.value : csstree.generate(decl.value);
      let value;
      try {
        value = csstree.parse(raw, { context: 'value', positions: true });
      } catch {
        return;
      }
      csstree.walk(value, (node) => {
        const at = { loc: decl.loc };
        if (node.type === 'Function')
          for (const key of functionKeys(node.name, '', node))
            use(key, at, ctx, `${node.name}() in ${property}`, { gateTokens: [`${node.name}(`] });
        else if (node.type === 'Dimension') {
          const key = unitKey(node.unit);
          if (key)
            use(key, at, ctx, `unit ${node.unit} in ${property}`, { gateTokens: [node.unit] });
        }
      });
      return;
    }
    const value = csstree.generate(decl.value);
    const hasVar = /var\(/i.test(value);
    const literalFallback = !hasVar && earlier.some((d) => d.property === property && !d.hasVar);
    const opts = (token) => ({ gateTokens: [`${property}:`, token], literalFallback });
    use(`css.properties.${property}`, decl, ctx, `property ${property}`, opts(`${property}:`));
    if (decl.value.type !== 'Value') return;
    csstree.walk(decl.value, (node) => {
      if (node.type === 'Function') {
        for (const key of functionKeys(node.name, property, node))
          use(key, node, ctx, `${node.name}()`, opts(`${node.name}(`));
      } else if (node.type === 'Identifier') {
        const ident = node.name.toLowerCase();
        if (SYSTEM_COLORS.has(ident)) {
          const sub = `css.types.color.system-color.${ident}`;
          use(
            lookup(sub) ? sub : 'css.types.color.system-color',
            node,
            ctx,
            `system colour ${node.name}`,
          );
        } else if (children(`css.properties.${property}`).includes(ident))
          use(
            `css.properties.${property}.${ident}`,
            node,
            ctx,
            `${property}: ${ident}`,
            opts(ident),
          );
      } else if (node.type === 'Dimension') {
        const key = unitKey(node.unit);
        if (key) use(key, node, ctx, `unit ${node.unit}`, opts(node.unit));
      }
    });
    earlier.push({ property, hasVar });
  };

  const visitBlock = (block, ctx) => {
    const earlier = [];
    for (const node of block.children) {
      if (node.type === 'Declaration') visitDeclaration(node, ctx, earlier);
      else visit(node, ctx);
    }
  };

  const visit = (node, ctx) => {
    if (node.type === 'StyleSheet') {
      for (const child of node.children) visit(child, ctx);
    } else if (node.type === 'Atrule') {
      const name = node.name.toLowerCase();
      use(`css.at-rules.${name}`, node, ctx, `@${name}`, { gateTokens: [`@${name}`] });
      let gates = ctx.gates;
      if (node.prelude && node.prelude.type !== 'Raw') {
        if (name === 'supports') {
          gates = [...gates, normalize(csstree.generate(node.prelude))];
          csstree.walk(node.prelude, (n) => {
            if (n.type === 'FeatureFunction' && n.feature === 'selector')
              use('css.at-rules.supports.selector', n, ctx, '@supports selector()');
          });
        } else if (name === 'media' || name === 'container') {
          gates = [...gates, normalize(csstree.generate(node.prelude))];
          csstree.walk(node.prelude, (n) => {
            if (n.type === 'Feature' && name === 'media') {
              const feature = n.name.toLowerCase().replace(/^(min|max)-/, '');
              use(`css.at-rules.media.${feature}`, n, ctx, `@media (${feature})`);
            } else if (n.type === 'FeatureRange' && name === 'media') {
              use('css.at-rules.media.range_syntax', n, ctx, '@media range syntax');
            } else if (n.type === 'FeatureFunction' && name === 'container') {
              const key =
                n.feature === 'style'
                  ? 'css.at-rules.container.style_queries_for_custom_properties'
                  : `css.at-rules.container.${n.feature}_queries`;
              use(key, n, ctx, `@container ${n.feature}()`);
            }
          });
        }
      }
      if (node.block) {
        if (name === 'keyframes') {
          for (const frame of node.block.children)
            if (frame.block) visitBlock(frame.block, { ...ctx, gates });
        } else visitBlock(node.block, { ...ctx, gates });
      }
    } else if (node.type === 'Rule') {
      if (node.prelude.type !== 'Raw') visitSelector(node.prelude, ctx);
      visitBlock(node.block, ctx);
    }
  };

  visit(ast, { gates: [] });
  return { problems, uses };
}

// ---------------------------------------------------------------------------------------------
// Sources

async function componentStyles() {
  const out = [];
  for (const pkg of ['components', 'ai']) out.push(...(await packageStyles(pkg)));
  return out;
}

async function packageStyles(pkg) {
  const out = [];
  const dist = join(root, `packages/${pkg}/dist`);
  if (!existsSync(dist)) return out;
  for (const name of readdirSync(dist).sort()) {
    const dir = join(dist, name);
    if (!existsSync(dir) || name === 'prod') continue;
    let files;
    try {
      files = readdirSync(dir)
        .filter((f) => f.endsWith('.styles.js'))
        .sort();
    } catch {
      continue;
    }
    for (const file of files) {
      const module = await import(pathToFileURL(join(dir, file)).href);
      for (const [exportName, value] of Object.entries(module))
        if (typeof value?.cssText === 'string')
          out.push({
            file: `packages/${pkg}/dist/${name}/${file} (${exportName})`,
            text: value.cssText,
            shipped: true,
          });
    }
  }
  return out;
}

export async function cssSources() {
  const sources = [];
  const add = (file, shipped) => {
    const path = join(root, file);
    if (existsSync(path)) sources.push({ file, text: readFileSync(path, 'utf8'), shipped });
  };
  add('packages/tokens/dist/css/default.css', true);
  for (const sheet of ['reset', 'base', 'utilities'])
    add(`packages/components/dist/css/${sheet}.css`, true);
  sources.push(...(await componentStyles()));
  for (const fixture of ['side-nav', 'page'])
    add(`packages/core/test/fixtures/${fixture}.recipe.css.txt`, true);
  const examples = join(root, 'examples');
  for (const example of readdirSync(examples).sort()) {
    const dir = join(examples, example);
    for (const sub of ['', 'generated']) {
      const folder = join(dir, sub);
      if (!existsSync(folder)) continue;
      for (const file of readdirSync(folder).sort())
        if (file.endsWith('.css'))
          add(relative(root, join(folder, file)).replace(/\\/g, '/'), false);
    }
  }
  return sources;
}

// ---------------------------------------------------------------------------------------------
// Matrix

const cell = (text) =>
  String(text ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');

function supportCell(keys, browser, floor) {
  let worst = 'full';
  let needs;
  for (const key of keys) {
    const status = supportAt(key, browser, floor[browser]);
    const first = firstSupport(key, browser) ?? {};
    if (status === 'full') continue;
    if (worst === 'full' || (worst === 'partial' && status === 'none')) worst = status;
    if (first.full && (!needs || compareVersions(first.full, needs) > 0)) needs = first.full;
    if (!first.full) needs = needs ?? '—';
  }
  if (worst === 'full') {
    const since = keys
      .map((k) => firstSupport(k, browser)?.full)
      .filter(Boolean)
      .sort(compareVersions)
      .at(-1);
    return `✓ ${since ?? ''}`.trim();
  }
  return `${worst === 'partial' ? 'partial' : '✗'}${needs && needs !== '—' ? ` (full: ${needs})` : ' (none)'}`;
}

function mobileNote(keys, floor) {
  const notes = [];
  for (const [desktop, mobile] of Object.entries(MOBILE)) {
    const d = supportCell(keys, desktop, floor);
    const m = supportCell(keys, mobile, floor);
    if (d.startsWith('✓') !== m.startsWith('✓')) notes.push(`${BROWSERS[mobile]}: ${m}`);
  }
  return notes.join('; ');
}

function baselineCell(id) {
  const b = id && baselineOf(id);
  if (!b) return '—';
  if (b.baseline === 'high') return `widely (${b.high})`;
  if (b.baseline === 'low') return `newly (${b.low})`;
  return 'limited';
}

function evidence(feature) {
  return (
    (feature.tests ?? [])
      .map((t) => `\`${t.file}\``)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ') || '—'
  );
}

export function renderMatrix(registry, { tokenSyntax, lint }) {
  const floor = registry.floor;
  const wa = widelyAvailableVersions(registry.checked);
  const lines = [];
  const push = (...l) => lines.push(...l);
  push(
    '# Platform feature matrix',
    '',
    '> Generated by `npm run compat` from [features.json](./features.json) and the pinned compatibility data. Do not edit by hand: change the registry and regenerate. Policy: [ADR 0009](../architecture/decisions/0009-browser-support-baseline.md), [ADR 0038](../architecture/decisions/0038-css-compatibility-and-progressive-enhancement.md), [ADR 0039](../architecture/decisions/0039-cascade-layer-order.md); contracts in [css-architecture.md](../architecture/css-architecture.md).',
    '',
    `- **Checked:** ${registry.checked} with \`@mdn/browser-compat-data\` ${registry.data['@mdn/browser-compat-data']} and \`web-features\` ${registry.data['web-features']}.`,
    `- **Floor:** ${Object.entries(floor)
      .map(([b, v]) => `${BROWSERS[b]} ${v}${releaseDate(b, v) ? ` (${releaseDate(b, v)})` : ''}`)
      .join(' · ')}.`,
    `- **Baseline Widely Available on ${registry.checked}** (computed from web-features): ${Object.entries(
      BROWSERS,
    )
      .map(([b, label]) => `${label} ${wa[b] ?? '—'}`)
      .join(' · ')}.`,
  );
  const above = registry.features.filter((f) => {
    if (f.adoption !== 'foundation' || f.status !== 'implemented' || f.floorExceptions)
      return false;
    const b = baselineOf(f.webFeature);
    return b && b.baseline !== 'high';
  });
  const exceptions = registry.features.filter((f) => f.floorExceptions);
  push(
    `- **Implemented foundations above Baseline Widely Available:** ${above.length ? above.map((f) => `${f.id} (${baselineCell(f.webFeature)})`).join(', ') : 'none'}.`,
    `- **Floor exceptions:** ${
      exceptions
        .map(
          (f) =>
            `${f.id} (${Object.keys(f.floorExceptions)
              .map((b) => BROWSERS[b])
              .join(', ')})`,
        )
        .join(', ') || 'none'
    }; consequences are listed with each feature.`,
    `- **Shipped and example CSS:** ${lint.sources.length} stylesheets, ${lint.keys} distinct compatibility keys, ${lint.problems ? `${lint.problems} problem(s)` : 'no ungated feature outside the floor'}. Ungated shipped CSS needs at least ${DESKTOP.map((b) => `${BROWSERS[b]} ${lint.requires[b]?.version ?? '—'}${lint.requires[b] ? ` (\`${lint.requires[b].key}\`)` : ''}`).join(' · ')}; the floor is higher because of the JavaScript and DOM features below.`,
    '',
    'Legend: ✓ *n* — fully supported at the floor (first full version *n*); partial / ✗ — not fully supported at the floor (first full version in brackets). Baseline: widely / newly available (date) or limited.',
    '',
  );

  const groups = [
    ['Foundations', (f) => f.adoption === 'foundation'],
    ['Enhancements (gated)', (f) => f.adoption === 'enhancement'],
    [
      'Experimental, deferred, and declined',
      (f) => !['foundation', 'enhancement'].includes(f.adoption),
    ],
  ];
  for (const [title, test] of groups) {
    const features = registry.features.filter(test);
    push(`## ${title} (${features.length})`, '');
    if (title.startsWith('Foundations')) {
      push(
        '| Feature | Syntax | Status | Chrome | Edge | Firefox | Safari | Mobile differences | Baseline | Used by / baseline behaviour | Evidence |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      );
      for (const f of features)
        push(
          `| ${f.id} | \`${cell(f.syntax)}\` | ${f.status}${f.milestone ? ` (${f.milestone})` : ''} | ${DESKTOP.map((b) => supportCell(f.bcd, b, floor)).join(' | ')} | ${cell(mobileNote(f.bcd, floor)) || '—'} | ${baselineCell(f.webFeature)} | ${cell([...(f.usedBy ?? []), f.baseline].join('. '))}${
            f.floorExceptions
              ? ` **Floor exception:** ${cell(
                  Object.entries(f.floorExceptions)
                    .map(([b, t]) => `${BROWSERS[b]}: ${t}`)
                    .join(' '),
                )}`
              : ''
          } | ${evidence(f)} |`,
        );
    } else if (title.startsWith('Enhancements')) {
      push(
        '| Feature | Syntax | Status | Chrome | Edge | Firefox | Safari | Gate | Baseline behaviour | Enhanced behaviour | Differences | Evidence |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      );
      for (const f of features)
        push(
          `| ${f.id} | \`${cell(f.syntax)}\` | ${f.status}${f.milestone ? ` (${f.milestone})` : ''} | ${DESKTOP.map((b) => supportCell(f.bcd, b, floor)).join(' | ')} | ${cell(f.gate)} | ${cell(f.baseline)} | ${cell(f.enhanced)} | ${cell(f.differences)} | ${evidence(f)} |`,
        );
    } else {
      push(
        '| Feature | Syntax | Adoption | Chrome | Edge | Firefox | Safari | Baseline | Use case | Decision |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      );
      for (const f of features)
        push(
          `| ${f.id} | \`${cell(f.syntax)}\` | ${f.adoption} | ${DESKTOP.map((b) => supportCell(f.bcd, b, floor)).join(' | ')} | ${baselineCell(f.webFeature)} | ${cell(f.useCase ?? '—')} | ${cell(f.decision)} |`,
        );
    }
    push('');
  }

  push(
    '## Token value syntax outside the floor',
    '',
    'The token generator reports `value.syntax.aboveFloor` (or explains `color.invalid`) when a token value uses one of these. A custom property holding unparseable syntax makes every declaration that reads it invalid at computed-value time in those browsers.',
    '',
    '| Syntax | BCD key | Not parsed by |',
    '| --- | --- | --- |',
  );
  for (const entry of tokenSyntax)
    push(
      `| \`${cell(entry.syntax)}\` | \`${entry.bcd}\` | ${entry.unsupported.map((b) => `${BROWSERS[b]} ${floor[b]}`).join(', ')} |`,
    );
  push(
    '',
    '## Linted stylesheets',
    '',
    '| Stylesheet | Shipped | Compatibility keys |',
    '| --- | --- | --- |',
  );
  for (const source of lint.sources)
    push(`| \`${cell(source.file)}\` | ${source.shipped ? 'yes' : 'example'} | ${source.keys} |`);
  push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Main

export async function run({ write = false } = {}) {
  const registry = loadRegistry();
  const tokens = await import(
    pathToFileURL(join(root, 'packages/tokens/dist/generate/index.js')).href
  );
  const problems = [
    ...checkRegistry(registry, { tokensFloor: tokens.BROWSER_FLOOR }),
    ...checkTokenSyntax(tokens.ABOVE_FLOOR_SYNTAX, registry.floor),
  ];
  const sources = await cssSources();
  const allKeys = new Set();
  const requires = {};
  const lintSources = [];
  for (const source of sources) {
    const { problems: found, uses } = lintCss(source.text, { file: source.file, registry });
    problems.push(...found);
    lintSources.push({ file: source.file, shipped: source.shipped, keys: uses.size });
    for (const key of uses.keys()) {
      allKeys.add(key);
      if (!source.shipped) continue;
      for (const browser of DESKTOP) {
        if (supportAt(key, browser, registry.floor[browser]) !== 'full') continue;
        const v = firstSupport(key, browser)?.full;
        if (!v) continue;
        const current = requires[browser];
        if (
          !current ||
          compareVersions(v, current.version) > 0 ||
          (compareVersions(v, current.version) === 0 && key < current.key)
        )
          requires[browser] = { version: v, key };
      }
    }
  }
  const matrix = renderMatrix(registry, {
    tokenSyntax: tokens.ABOVE_FLOOR_SYNTAX,
    lint: { sources: lintSources, keys: allKeys.size, problems: problems.length, requires },
  });
  const current = existsSync(MATRIX) ? readFileSync(MATRIX, 'utf8') : '';
  if (write) {
    if (current !== matrix) writeFileSync(MATRIX, matrix);
  } else if (current !== matrix) {
    problems.push('docs/compatibility/matrix.md is out of date: run npm run compat.');
  }
  return {
    problems,
    sources: lintSources.length,
    keys: allKeys.size,
    features: registry.features.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await run({ write: process.argv.includes('--write') });
  for (const problem of result.problems) console.error(problem);
  console.log(
    `Compatibility check ${result.problems.length ? 'FAILED' : 'OK'}: ${result.features} registered features; ${result.sources} stylesheets, ${result.keys} compatibility keys; ${result.problems.length} problem(s).`,
  );
  if (result.problems.length) process.exit(1);
}
