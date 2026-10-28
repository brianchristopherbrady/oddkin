// M8 CSS review (F08): `contain: content` and `content-visibility: auto` on collection items,
// measured against no containment in Chromium, Firefox, and WebKit, with correctness checks
// (screenshots of the first viewport and of a focused card, find-in-page, scroll heights).
// Pages are served from the workspace through Playwright routes (no port). Variants alternate in
// each round, and the medians of the rounds are compared, not absolute times.
//   node research/experiments/containment/run.mjs [--engines chromium,firefox,webkit] [--rounds 5]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { importMap } from '../../../scripts/packed-consumers.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const origin = 'http://oddkin.test';
const PAGE = '/research/experiments/containment/page.html';
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > -1 ? process.argv[at + 1] : fallback;
};
const ENGINES = { chromium, firefox, webkit };
const engines = arg('--engines', 'chromium,firefox,webkit').split(',');
const rounds = Number(arg('--rounds', '5'));
const VARIANTS = ['none', 'contain', 'visibility'];
const SCENARIOS = ['cards', 'transcript'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

async function pageHtml() {
  const dir = join(root, 'research/experiments/containment');
  const html = await readFile(join(dir, 'page.html'), 'utf8');
  const { imports } = await importMap([join(dir, 'page.js')], {
    modules: join(root, 'node_modules'),
    pageDir: dir,
  });
  return html.replace(
    /(<script type="importmap">)[\s\S]*?(<\/script>)/,
    `$1${JSON.stringify({ imports })}$2`,
  );
}

async function open(browser, html) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === PAGE) return route.fulfill({ contentType: 'text/html', body: html });
    const file = join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return route.fulfill({ status: 403, body: '' });
    try {
      return route.fulfill({
        contentType: TYPES[extname(file)] ?? 'application/octet-stream',
        body: await readFile(file),
      });
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Generous: WebKit on a loaded machine has missed the default 30 s load.
  await page.goto(origin + PAGE, { timeout: 120_000 });
  await page.waitForFunction(() => 'bench' in window, null, { timeout: 120_000 });
  return { context, page, errors };
}

const frames = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Pixels and behaviour each variant must keep: compared with the variant without containment. */
async function checks(page, scenario, engine) {
  if (scenario === 'cards') {
    await page.evaluate(() => window.scrollTo(0, 0));
    await frames(page);
    // Chromium alone exposes its accessibility tree (DevTools protocol): is the last card in it?
    let inTree = null;
    if (engine === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      inTree = nodes.some((node) => node.name?.value === 'Card 399' && !node.ignored);
    }
    const viewport = await page.screenshot();
    await page.keyboard.press('Tab');
    await frames(page);
    const box = await page.locator('odd-card').first().boundingBox();
    const focused = await page.screenshot({
      clip: { x: box.x - 16, y: box.y - 16, width: box.width + 32, height: box.height + 32 },
    });
    const found = await page.evaluate(() =>
      typeof window.find === 'function' ? window.find('Card 399 summary') : null,
    );
    return { viewport, focused, found, inTree };
  }
  const conversation = await page.locator('odd-conversation').screenshot();
  return { viewport: conversation };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Pixels that differ between two screenshots, and the largest channel difference (0–255). */
async function pixelDiff(browser, a, b) {
  const page = await browser.newPage();
  const result = await page.evaluate(
    async ([x, y]) => {
      const load = async (base64) =>
        createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const [first, second] = await Promise.all([load(x), load(y)]);
      if (first.width !== second.width || first.height !== second.height)
        return { pixels: -1, max: -1 };
      const read = (image) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const [p, q] = [read(first), read(second)];
      let pixels = 0;
      let max = 0;
      for (let i = 0; i < p.length; i += 4) {
        const d = Math.max(
          Math.abs(p[i] - q[i]),
          Math.abs(p[i + 1] - q[i + 1]),
          Math.abs(p[i + 2] - q[i + 2]),
        );
        if (d) pixels++;
        max = Math.max(max, d);
      }
      return { pixels, max };
    },
    [a.toString('base64'), b.toString('base64')],
  );
  await page.close();
  return result;
}

const html = await pageHtml();
const out = join(
  root,
  `research/benchmarks/results/containment-${new Date().toISOString().slice(0, 10)}.json`,
);
// Engines measured earlier the same day are kept, so one engine can be rerun alone.
const earlier = await readFile(out, 'utf8').then(JSON.parse, () => ({ engines: {} }));
const results = {
  date: new Date().toISOString(),
  method:
    'Median of per-round medians. Times are synchronous style and layout forced with offsetHeight after each change (paint is not included), except render (insertion to every element updated) and stream (snapshot to updated message, plus layout).',
  rounds,
  engines: earlier.rounds === rounds ? earlier.engines : {},
};
for (const name of engines) {
  const browser = await ENGINES[name].launch();
  const runs = {};
  const shots = {};
  const notes = {};
  for (let round = 0; round < rounds; round++) {
    const order = VARIANTS.map((_, i) => VARIANTS[(i + round) % VARIANTS.length]);
    for (const scenario of SCENARIOS)
      for (const variant of order) {
        const { context, page, errors } = await open(browser, html);
        const result = await page.evaluate(
          ([s, v]) => window.bench[s]({ variant: v }),
          [scenario, variant],
        );
        ((runs[scenario] ??= {})[variant] ??= []).push(result);
        if (round === 0) (shots[scenario] ??= {})[variant] = await checks(page, scenario, name);
        if (errors.length) (notes[`${scenario}/${variant}`] ??= []).push(...errors);
        await context.close();
      }
    process.stdout.write(`${name} round ${round + 1}/${rounds}\n`);
  }
  const version = browser.version();
  const summary = {};
  for (const [scenario, variants] of Object.entries(runs))
    for (const [variant, list] of Object.entries(variants)) {
      const entry = {};
      for (const key of Object.keys(list[0]))
        entry[key] =
          typeof list[0][key] === 'number'
            ? Math.round(median(list.map((r) => r[key])) * 100) / 100
            : list.every((r) => r[key] === list[0][key])
              ? list[0][key]
              : list.map((r) => r[key]);
      const base = shots[scenario].none;
      const shot = shots[scenario][variant];
      entry.viewportDiff = await pixelDiff(browser, base.viewport, shot.viewport);
      if (shot.focused)
        entry.focusedCardDiff = await pixelDiff(browser, base.focused, shot.focused);
      if ('found' in shot) entry.findInPage = shot.found;
      if ('inTree' in shot) entry.lastCardInAccessibilityTree = shot.inTree;
      (summary[scenario] ??= {})[variant] = entry;
      if (variant !== 'none' && entry.viewportDiff.pixels) {
        await mkdir(join(root, '.tmp/containment'), { recursive: true });
        for (const [label, buffer] of Object.entries(shot))
          if (Buffer.isBuffer(buffer)) {
            const file = (v) =>
              join(root, `.tmp/containment/${name}-${scenario}-${v}-${label}.png`);
            await writeFile(file(variant), buffer);
            await writeFile(file('none'), base[label]);
          }
      }
    }
  await browser.close();
  results.engines[name] = { version, summary, errors: notes };
  console.log(name, JSON.stringify(summary));
  await writeFile(out, `${JSON.stringify(results, null, 2)}\n`);
}
console.log(`wrote ${out}`);
