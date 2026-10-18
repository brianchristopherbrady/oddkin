// CSS compatibility gallery: plain JavaScript, no build, strict CSP and Trusted Types.
// Controls change ordinary attributes and properties; nothing here re-implements styling.
import '@oddkin/components/define/button';
import '@oddkin/components/define/card';
import '@oddkin/components/define/input';
import { buttonStructuralStyles, buttonStyles } from '@oddkin/components/button';

const $ = (selector) => document.querySelector(selector);
const stage = $('#stage');
const frame = $('#frame');
const nested = $('#nested');
const email = $('#email');
const buttons = [$('#cancel'), $('#save')];
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const LONG_LABEL = 'Sähköpostiosoite, johon lähetämme vahvistuslinkin ja kuitit';

function swapLongContent(long) {
  for (const element of document.querySelectorAll('[data-long]')) {
    element.dataset.short ??= element.textContent.trim();
    element.textContent = long ? element.dataset.long : element.dataset.short;
  }
  email.label = long ? LONG_LABEL : 'Email';
}

function apply() {
  const mode = $('#mode').value;
  stage.dataset.oddMode = mode;
  const effective = mode === 'system' ? (systemDark.matches ? 'dark' : 'light') : mode;
  if ($('#nested-mode').value === 'opposite')
    nested.dataset.oddMode = effective === 'dark' ? 'light' : 'dark';
  else delete nested.dataset.oddMode;

  const density = $('#density').value;
  if (density) stage.dataset.oddDensity = density;
  else delete stage.dataset.oddDensity;
  const profile = $('#profile').value;
  if (profile) stage.dataset.oddProfile = profile;
  else delete stage.dataset.oddProfile;

  stage.dir = $('#direction').value;
  const width = $('#width').value;
  frame.style.inlineSize = `${width}rem`;
  $('#width-value').textContent = `${width}rem`;
  swapLongContent($('#long').checked);

  for (const button of buttons) {
    button.disabled = $('#disabled').checked;
    button.loading = $('#loading').checked;
  }
  email.disabled = $('#disabled').checked;
  email.error = $('#invalid').checked ? 'Use an address at your organization.' : '';

  const enhanced = $('#enhanced').checked;
  $('#enhancements').disabled = !enhanced;
  document.documentElement.dataset.enhanced = String(enhanced);

  $('#preferences').textContent = [
    `Colour scheme preference: ${systemDark.matches ? 'dark' : 'light'}.`,
    `Reduced motion: ${reducedMotion.matches ? 'on — the loading spinner turns slowly' : 'off'}.`,
  ].join(' ');
}

function hasPath(path) {
  const parts = path.split('.');
  let target = parts[0] === 'window' ? window : globalThis[parts[0]];
  for (const part of parts.slice(1, -1)) target = target == null ? undefined : target[part];
  return target != null && parts[parts.length - 1] in target;
}

async function showSupport() {
  const registry = await (await fetch('../../docs/compatibility/features.json')).json();
  const body = $('#support tbody');
  for (const feature of registry.features) {
    if (!feature.detectCss && !feature.detectApi) continue;
    const detected = feature.detectCss
      ? CSS.supports(feature.detectCss)
      : hasPath(feature.detectApi);
    const row = document.createElement('tr');
    for (const text of [
      feature.id,
      feature.syntax,
      feature.adoption,
      detected ? 'yes' : 'no',
      feature.baseline,
    ]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    row.dataset.feature = feature.id;
    row.dataset.detected = String(detected);
    body.append(row);
  }
}

async function showCss() {
  $('#token-css').textContent = await (
    await fetch('../../packages/tokens/dist/css/default.css')
  ).text();
  $('#button-css').textContent = [buttonStructuralStyles, buttonStyles]
    .map((styles) => styles.cssText.trim())
    .join('\n\n');
  $('#enhancement-css').textContent = await (await fetch('./enhancements.css')).text();
}

$('#controls').addEventListener('input', apply);
$('#controls').addEventListener('change', apply);
systemDark.addEventListener('change', apply);
reducedMotion.addEventListener('change', apply);
apply();
await Promise.all([showSupport(), showCss()]);
document.body.dataset.ready = 'true';
