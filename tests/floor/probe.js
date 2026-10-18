// Floor probe (ADR 0038). Runs unchanged in named floor browsers through
// scripts/compat/run-floor.mjs and in current engines through e2e/floor-probe.spec.ts.
// Plain JavaScript without a build step: the probe itself must run in the oldest supported
// browsers. Each check id is cited as evidence in docs/compatibility/features.json.
import '@oddkin/components/define/button';
import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import { generate, resolveToken } from '@oddkin/tokens/generate';

const results = {
  userAgent: navigator.userAgent,
  checks: [],
  detections: {},
  unsupportedSyntax: '',
};
const check = (id, ok, detail) =>
  results.checks.push({ id, ok: Boolean(ok), detail: String(detail) });
const $ = (selector) => document.querySelector(selector);
const computed = (selector) => getComputedStyle($(selector));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const rgb = (hex) => {
  const h = String(hex).slice(1);
  return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
};
const rootPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const remPx = (value) => `${parseFloat(value) * rootPx()}px`;

function hasPath(path) {
  const parts = path.split('.');
  let target = parts[0] === 'window' ? window : globalThis[parts[0]];
  for (const part of parts.slice(1, -1)) target = target == null ? undefined : target[part];
  return target != null && parts[parts.length - 1] in target;
}

async function settle(element) {
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  await frame();
}

async function run() {
  const config = await (await fetch('../../packages/tokens/themes/default.theme.json')).json();
  const theme = generate(config).theme;
  const expected = (name, context) => resolveToken(theme, name, context);

  // ADR 0039: an unlayered zero-specificity rule loaded before the tokens still wins.
  const override = computed('#layer-override .swatch').color;
  check('layer-order', override === 'rgb(1, 2, 3)', override);

  // Mode, density, and profile scopes resolve as the generator predicts (alias closure).
  const light = computed('#scope-light > .swatch').color;
  check('scope-light', light === rgb(expected('color.text.primary', { mode: 'light' })), light);
  const dark = computed('#scope-dark .swatch').color;
  check('scope-dark', dark === rgb(expected('color.text.primary', { mode: 'dark' })), dark);
  const compact = computed('#scope-compact .control').minHeight;
  check(
    'scope-density',
    compact === remPx(expected('control.height.md', { density: 'compact' })),
    compact,
  );
  const profile = computed('#scope-profile .padded').paddingTop;
  check(
    'scope-profile',
    profile === remPx(expected('card.padding', { profiles: ['layout.compact'] })),
    profile,
  );
  const scheme = computed('#scope-dark').colorScheme;
  check('color-scheme', scheme === 'dark', scheme);

  // Components register from plain ESM through an import map and share sheets per document.
  await Promise.all(
    ['odd-button', 'odd-card', 'odd-input'].map((t) => customElements.whenDefined(t)),
  );
  check('components-registered', true, 'odd-button, odd-card, odd-input defined');
  const [primary, secondary] = document.querySelectorAll('odd-button');
  await settle(primary);
  await settle(secondary);
  const sheets = [primary, secondary].map((b) => b.shadowRoot.adoptedStyleSheets);
  check(
    'shared-sheet',
    sheets[0].length > 0 && sheets[0].every((sheet, i) => sheet === sheets[1][i]),
    `${sheets[0].length} adopted sheet(s), shared: ${sheets[0][0] === sheets[1][0]}`,
  );
  const control = primary.shadowRoot.querySelector('button');
  const background = getComputedStyle(control).backgroundColor;
  const action = computed('#action-reference').backgroundColor;
  check('button-styles', background === action && background !== 'rgba(0, 0, 0, 0)', background);
  const height = control.getBoundingClientRect().height;
  check('target-size', height >= 24, `${height}px`);

  // Custom state and form association (the features that set the floor).
  const input = $('#probe-input');
  await settle(input);
  input.addEventListener('invalid', (event) => event.preventDefault());
  input.checkValidity();
  await settle(input);
  check(
    'custom-state',
    input.matches(':state(user-invalid)') &&
      input.shadowRoot.querySelector('input').getAttribute('aria-invalid') === 'true',
    `:state(user-invalid) ${input.matches(':state(user-invalid)')}`,
  );
  input.value = 'ada@example.com';
  await settle(input);
  const data = [...new FormData($('#probe-form'))].map(([k, v]) => `${k}=${v}`).join('&');
  check('form-association', data === 'email=ada@example.com' && input.checkValidity(), data);

  // Container size queries respond to the container, not the viewport.
  const wide = computed('#cq-wide .cq-item').color;
  const narrow = computed('#cq-narrow .cq-item').color;
  check(
    'container-query',
    wide === 'rgb(0, 128, 0)' && narrow === 'rgb(0, 0, 255)',
    `wide ${wide}, narrow ${narrow}`,
  );

  // F02 with real modern syntax where this browser lacks it, otherwise syntax no engine parses.
  const candidates = ['oklch(from red l c h)', 'contrast-color(red)', 'light-dark(red, red)'];
  const syntax =
    candidates.find((candidate) => !CSS.supports('color', candidate)) ?? 'oddkin-future-color(red)';
  results.unsupportedSyntax = syntax;
  const style = document.createElement('style');
  style.textContent = `
    #naive { --naive: ${syntax}; background-color: rgb(0, 128, 0); background-color: var(--naive, rgb(0, 128, 0)); }
    #gated { --gated: rgb(0, 128, 0); }
    @supports (color: ${syntax}) { #gated { --gated: ${syntax}; } }
    #gated { background-color: var(--gated); }`;
  document.head.append(style);
  const naive = computed('#naive').backgroundColor;
  check('naive-token-syntax', naive === 'rgba(0, 0, 0, 0)', `${syntax} → ${naive}`);
  const gated = computed('#gated').backgroundColor;
  check('gated-token-syntax', gated === 'rgb(0, 128, 0)', `${syntax} → ${gated}`);

  // F04: a registered initial value masks a var() fallback, so Oddkin never registers its
  // tokens or component variables. Without registration support the fallback applies.
  if (typeof CSS.registerProperty === 'function') {
    CSS.registerProperty({
      name: '--probe-registered',
      syntax: '<color>',
      inherits: false,
      initialValue: 'rgb(9, 9, 9)',
    });
    const masked = computed('#registered').backgroundColor;
    check('registration-masks-fallback', masked === 'rgb(9, 9, 9)', `registered → ${masked}`);
  } else {
    const fallback = computed('#registered').backgroundColor;
    check(
      'registration-masks-fallback',
      fallback === 'rgb(0, 128, 0)',
      `CSS.registerProperty unavailable → ${fallback}`,
    );
  }

  // Feature detection for every registered feature that declares how to detect it.
  const registry = await (await fetch('../../docs/compatibility/features.json')).json();
  for (const feature of registry.features) {
    if (feature.detectCss)
      results.detections[`${feature.id}:css`] = CSS.supports(feature.detectCss);
    if (feature.detectApi) results.detections[`${feature.id}:api`] = hasPath(feature.detectApi);
  }
}

try {
  await run();
} catch (error) {
  check('probe-error', false, error && error.stack ? error.stack : error);
}
window.__probe = results;
$('#results').textContent = JSON.stringify(results, null, 2);
if (new URLSearchParams(location.search).has('report')) {
  await fetch('/__report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(results),
  });
}
document.documentElement.dataset.probe = 'done';
