// ADR 0046 D2: each mode-dependent colour written once as light-dark(LIGHT, DARK) versus the mode
// toggles, measured through the canonical generator's `modeColors` option (default 'toggles').
// Run after `npx tsc -b packages/tokens`:
//   node research/experiments/light-dark/measure.mjs [--engines chromium,firefox,webkit] [--json out.json]
// It reports gzip bytes and the mode closure per theme, then builds the same scope tree under
// each output in each engine and colour-scheme/forced-colours emulation and compares every
// colour and shadow token's computed value on every probe.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium, firefox, webkit } from '@playwright/test';
import { emitDtcg, generate, resolveToken } from '../../../packages/tokens/dist/index.js';
import { cases } from '../../../packages/tokens/test/fixtures/cases.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = (path) => JSON.parse(readFileSync(`${root}${path}`, 'utf8'));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const engines = arg('--engines', 'chromium,firefox,webkit').split(',');
const gzip = (text) => gzipSync(Buffer.from(text), { level: 9 }).length;

const configs = {
  default: json('packages/tokens/themes/default.theme.json'),
  'products-density': cases['products-density'],
  harbor: json('examples/tokens-css-only/theme.json'),
};
const OUTPUTS = ['toggles', 'light-dark'];

// 1. Bytes and the mode closure.
const report = { sizes: {}, parity: {}, browsers: {} };
const themes = {};
for (const [name, config] of Object.entries(configs)) {
  const out = {};
  for (const modeColors of OUTPUTS) {
    const result = generate(config, { css: { modeColors } });
    if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.diagnostics)}`);
    const dark = /\[data-odd-mode="dark"\] \{\n([^}]*)\}/.exec(result.css)?.[1] ?? '';
    out[modeColors] = {
      css: result.css,
      theme: result.theme,
      bytes: Buffer.byteLength(result.css),
      gzip: gzip(result.css),
      modeDeclarations: dark.split('\n').filter((l) => l.includes(': ')).length - 3,
      lightDark: (result.css.match(/light-dark\(/g) ?? []).length,
    };
  }
  themes[name] = out;
  const [a, b] = OUTPUTS.map((o) => out[o]);
  report.sizes[name] = {
    toggles: { bytes: a.bytes, gzip: a.gzip, modeClosure: a.modeDeclarations },
    lightDark: {
      bytes: b.bytes,
      gzip: b.gzip,
      modeClosure: b.modeDeclarations,
      lightDarkValues: b.lightDark,
    },
    gzipDelta: b.gzip - a.gzip,
  };
  // The option changes CSS only: the resolved theme, resolveToken, and DTCG are the same objects' output.
  const names = [...a.theme.tokens.keys()];
  const contexts = [{ mode: 'light' }, { mode: 'dark' }];
  report.parity[name] = {
    dtcgIdentical: emitDtcg(a.theme).text === emitDtcg(b.theme).text,
    resolveTokenIdentical: names.every((n) =>
      contexts.every((c) => resolveToken(a.theme, n, c) === resolveToken(b.theme, n, c)),
    ),
  };
}
console.table(
  Object.fromEntries(
    Object.entries(report.sizes).map(([n, s]) => [
      n,
      {
        'toggles B': s.toggles.bytes,
        'toggles gz': s.toggles.gzip,
        'light-dark B': s.lightDark.bytes,
        'light-dark gz': s.lightDark.gzip,
        'gz delta': s.gzipDelta,
        'mode closure': `${s.toggles.modeClosure} -> ${s.lightDark.modeClosure}`,
      },
    ]),
  ),
);
console.log('parity', JSON.stringify(report.parity));

// 2. Computed values in a real cascade.
const TREE = (theme) => `
  <i id="root-default"></i>
  <div data-odd-mode="light"><i id="light"></i>
    <div data-odd-mode="dark"><i id="dark"></i>
      <div data-odd-product="clinic"><i id="dark-clinic"></i>
        <div data-odd-mode="light"><i id="dark-clinic-light"></i></div>
      </div>
      <div data-odd-density="compact"><i id="dark-compact"></i></div>
      <div data-odd-mode="system"><i id="system"></i></div>
      <div data-odd-profile="layout.compact"><i id="dark-profile"></i></div>
      <div id="host-plain"></div>
      <div id="host-adopted"></div>
      <div id="host-nested"></div>
      <div id="slot-host"><i id="slotted"></i><i id="slotted-plain" slot="plain"></i></div>
      <div data-odd-product="clinic"><div data-odd-theme="${theme}"><i id="in-theme"></i></div></div>
      <div data-odd-mode="light" data-odd-product="studio" data-odd-density="spacious"><i id="same-element"></i></div>
    </div>
    <div data-odd-product="studio"><i id="studio"></i>
      <div data-odd-mode="dark"><i id="studio-dark"></i>
        <div data-odd-density="spacious"><i id="studio-dark-spacious"></i></div>
      </div>
    </div>
    <div style="color-scheme: dark"><i id="author-scheme-dark"></i></div>
  </div>`;

/** Runs in the page: builds the shadow trees, then reads every token on every probe. */
function readAll({ css, colors, shadows }) {
  const adopt = (shadowRoot) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadowRoot.adoptedStyleSheets = [sheet];
  };
  const q = (id) => document.getElementById(id);
  const plain = q('host-plain').attachShadow({ mode: 'open' });
  plain.innerHTML =
    '<i id="in-shadow"></i><div data-odd-mode="light"><i id="shadow-unadopted-light"></i></div>';
  const adopted = q('host-adopted').attachShadow({ mode: 'open' });
  adopted.innerHTML =
    '<div data-odd-mode="light"><i id="shadow-adopted-light"></i><div data-odd-product="clinic" data-odd-mode="dark"><i id="shadow-adopted-dark-clinic"></i></div></div>';
  adopt(adopted);
  const outer = q('host-nested').attachShadow({ mode: 'open' });
  outer.innerHTML = '<i id="level-1"></i><div id="inner-host"></div>';
  outer.getElementById('inner-host').attachShadow({ mode: 'open' }).innerHTML =
    '<i id="level-2"></i>';
  const slot = q('slot-host').attachShadow({ mode: 'open' });
  slot.innerHTML =
    '<div data-odd-mode="light" data-odd-product="studio"><slot></slot></div><slot name="plain"></slot>';
  adopt(slot);

  const probes = [];
  const collect = (scope) => {
    for (const el of scope.querySelectorAll('i[id]')) {
      probes.push(el);
      if (el.shadowRoot) collect(el.shadowRoot);
    }
    for (const host of scope.querySelectorAll('*')) if (host.shadowRoot) collect(host.shadowRoot);
  };
  collect(document);
  const variable = (name) => `var(--odd-${name.replaceAll('.', '-')})`;
  const out = {};
  for (const probe of probes) {
    // Each token on its own child, so one style recalculation reads them all.
    const cells = [];
    for (const name of colors) {
      const b = document.createElement('b');
      b.style.color = variable(name);
      cells.push([name, b, 'color']);
    }
    for (const name of shadows) {
      const b = document.createElement('b');
      b.style.boxShadow = variable(name);
      cells.push([name, b, 'boxShadow']);
    }
    probe.append(...cells.map(([, b]) => b));
    const values = {};
    for (const [name, b, property] of cells) values[name] = getComputedStyle(b)[property];
    const style = getComputedStyle(probe);
    values['(color-scheme)'] = style.colorScheme;
    values['(raw --odd-color-action-default)'] = style
      .getPropertyValue('--odd-color-action-default')
      .trim();
    for (const [, b] of cells) b.remove();
    out[probe.id] = values;
  }
  return {
    forced: matchMedia('(forced-colors: active)').matches,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    out,
  };
}

const EMULATIONS = [
  { colorScheme: 'light', forcedColors: 'none' },
  { colorScheme: 'dark', forcedColors: 'none' },
  { colorScheme: 'light', forcedColors: 'active' },
  { colorScheme: 'dark', forcedColors: 'active' },
];
const launchers = { chromium, firefox, webkit };
for (const engine of engines) {
  const browser = await launchers[engine].launch();
  report.browsers[engine] = { version: browser.version(), runs: [] };
  for (const emulation of EMULATIONS) {
    const context = await browser.newContext(emulation);
    const page = await context.newPage();
    for (const [name, out] of Object.entries(themes)) {
      const theme = out.toggles.theme;
      const colors = [...theme.tokens.values()]
        .filter((t) => t.type === 'color')
        .map((t) => t.name);
      const shadows = [...theme.tokens.values()]
        .filter((t) => t.type === 'shadow')
        .map((t) => t.name);
      const readings = {};
      for (const modeColors of OUTPUTS) {
        // Probes opt out of forced colours so the token values stay observable there.
        await page.setContent(
          `<!doctype html><style>${out[modeColors].css}</style><style>i, b { display: block; forced-color-adjust: none; }</style>${TREE(theme.name)}`,
        );
        readings[modeColors] = await page.evaluate(readAll, {
          css: out[modeColors].css,
          colors,
          shadows,
        });
      }
      const [a, b] = OUTPUTS.map((o) => readings[o]);
      const differences = [];
      let compared = 0;
      for (const [probe, values] of Object.entries(a.out)) {
        for (const [token, value] of Object.entries(values)) {
          if (token.startsWith('(raw')) continue;
          compared++;
          const other = b.out[probe]?.[token];
          if (other !== value) differences.push({ probe, token, toggles: value, lightDark: other });
        }
      }
      // Non-vacuity: the light and dark probes differ, and the probes exist in both outputs.
      const modeSensitive = colors.filter((t) => a.out.light[t] !== a.out.dark[t]).length;
      const run = {
        emulation,
        theme: name,
        forcedActive: a.forced,
        probes: Object.keys(a.out).length,
        compared,
        modeSensitive,
        differences: differences.length,
        differingProbes: [...new Set(differences.map((d) => d.probe))],
        examples: differences.slice(0, 3),
        rawExample: {
          toggles: a.out.dark['(raw --odd-color-action-default)'],
          lightDark: b.out.dark['(raw --odd-color-action-default)'],
        },
      };
      report.browsers[engine].runs.push(run);
      console.log(
        `${engine} ${browser.version()} ${emulation.colorScheme}${a.forced ? ' forced' : emulation.forcedColors === 'active' ? ' (forced not emulated)' : ''} ${name}: ${run.probes} probes, ${compared} values, ${modeSensitive} mode-sensitive colours, ${differences.length} differences${differences.length ? ` on ${run.differingProbes.join(', ')}` : ''}`,
      );
    }
    await context.close();
  }
  await browser.close();
}
const out = arg('--json');
if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
