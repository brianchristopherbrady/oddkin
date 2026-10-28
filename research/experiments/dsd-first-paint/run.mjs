// ADR 0046 D10: declarative shadow DOM first paint. Prerenders a page's Oddkin elements into
// declarative shadow roots, with each element's styles as a same-origin stylesheet so a strict
// `style-src 'self'` still holds, and compares first paint, layout shift, and the work of the
// replacement on upgrade with the upgrade-only page. Chromium only: it alone reports
// largest-contentful-paint and layout-shift entries. Pages are served from the workspace through
// Playwright routes (no port), with module scripts optionally delayed to stand in for a slow
// network.
//   node research/experiments/dsd-first-paint/run.mjs [--samples 9]
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { importMap } from '../../../scripts/packed-consumers.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const origin = 'http://oddkin.test';
const flag = process.argv.indexOf('--samples');
const samples = flag > -1 ? Number(process.argv[flag + 1]) : 9;
const DELAYS = [0, 800];
const PAGES = [
  { name: 'example: components-only', path: '/examples/components-only/index.html' },
  { name: 'content page', path: '/research/experiments/dsd-first-paint/content.html' },
];
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

/** The fixture's import map, generated from the installed workspace packages. */
async function fixtureHtml() {
  const pageDir = join(root, 'research/experiments/dsd-first-paint');
  const html = await readFile(join(pageDir, 'content.html'), 'utf8');
  const { imports } = await importMap([join(pageDir, 'content.js')], {
    modules: join(root, 'node_modules'),
    pageDir,
  });
  return html.replace(
    /(<script type="importmap">)[\s\S]*?(<\/script>)/,
    `$1${JSON.stringify({ imports })}$2`,
  );
}

/** Serve the workspace, an HTML override for the page, generated stylesheets, and delayed JS. */
async function serve(context, { path, html, css = {}, delay = 0 }) {
  await context.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === path)
      return route.fulfill({ contentType: 'text/html', body: html, status: 200 });
    const generated = /^\/__dsd\/([a-z0-9-]+)\.css$/.exec(url.pathname);
    if (generated) return route.fulfill({ contentType: 'text/css', body: css[generated[1]] ?? '' });
    const file = join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) return route.fulfill({ status: 403, body: '' });
    let body;
    try {
      body = await readFile(file);
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
    if (delay && extname(file) === '.js') await new Promise((done) => setTimeout(done, delay));
    return route.fulfill({ contentType: TYPES[extname(file)] ?? 'application/octet-stream', body });
  });
}

/** Load the page, wait for every element, and serialize its body with declarative shadow roots. */
async function prerender(browser, page) {
  const context = await browser.newContext();
  await serve(context, page);
  const tab = await context.newPage();
  await tab.goto(origin + page.path);
  const result = await tab.evaluate(async () => {
    while (document.querySelector(':not(:defined)')) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const roots = [];
    const css = {};
    const walk = (node) => {
      for (const el of node.querySelectorAll('*')) {
        if (!el.shadowRoot || !el.localName.startsWith('odd-')) continue;
        roots.push(el.shadowRoot);
        css[el.localName] ??= el.shadowRoot.adoptedStyleSheets
          .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
          .join('\n');
        walk(el.shadowRoot);
      }
    };
    walk(document.body);
    return { body: document.body.getHTML({ shadowRoots: roots }), css, hosts: roots.length };
  });
  await context.close();
  // Each declarative root links its element's styles (a same-origin file, allowed by `'self'`).
  const withStyles = (style) =>
    result.body.replace(
      /<(odd-[a-z0-9-]+)\b([^>]*)><template shadowrootmode="open"([^>]*)>/g,
      (_, tag, attributes, template) =>
        `<${tag}${attributes}><template shadowrootmode="open"${template}>${style(tag)}`,
    );
  const html = (body) => page.html.replace(/(<body[^>]*>)[\s\S]*(<\/body>)/, `$1${body}$2`);
  return {
    html: html(withStyles((tag) => `<link rel="stylesheet" href="/__dsd/${tag}.css">`)),
    // The same with inline <style>, which a strict `style-src` refuses: for comparison only.
    inline: html(withStyles((tag) => `<style>${result.css[tag]}</style>`)).replace(
      /style-src 'self'/,
      "style-src 'self' 'unsafe-inline'",
    ),
    css: result.css,
    hosts: result.hosts,
  };
}

/** One page load: paint and shift entries, the moment every element is defined, and CDP totals. */
async function measure(browser, page, variant) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await serve(context, variant);
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  tab.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await tab.addInitScript(() => {
    const seen = { lcp: 0, cls: 0, fcp: 0, shifts: 0 };
    window.__paint = seen;
    const watch = (type, onEntry) =>
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({
        type,
        buffered: true,
      });
    watch('largest-contentful-paint', (e) => (seen.lcp = e.startTime));
    watch('layout-shift', (e) => {
      if (e.hadRecentInput) return;
      seen.cls += e.value;
      seen.shifts++;
    });
    watch('paint', (e) => e.name === 'first-contentful-paint' && (seen.fcp = e.startTime));
  });
  const cdp = await context.newCDPSession(tab);
  await cdp.send('Performance.enable');
  await tab.goto(origin + page.path, { waitUntil: 'load' });
  const defined = await tab.evaluate(async () => {
    while (document.querySelector(':not(:defined)')) await new Promise((r) => setTimeout(r, 5));
    const at = performance.now();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return at;
  });
  const paint = await tab.evaluate(() => window.__paint);
  const metrics = Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]),
  );
  const shadow = await tab.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((el) => el.shadowRoot && el.localName.startsWith('odd-'))
      .map((el) => el.shadowRoot.innerHTML)
      .join('\n'),
  );
  await context.close();
  return {
    ...paint,
    defined,
    script: metrics.ScriptDuration * 1000,
    layout: metrics.LayoutDuration * 1000,
    style: metrics.RecalcStyleDuration * 1000,
    layouts: metrics.LayoutCount,
    nodes: metrics.Nodes,
    errors,
    shadow,
  };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const browser = await chromium.launch();
const results = [];
try {
  for (const page of PAGES) {
    page.html =
      page.path.endsWith('content.html') === true
        ? await fixtureHtml()
        : await readFile(join(root, page.path), 'utf8');
    const prerendered = await prerender(browser, page);
    for (const delay of DELAYS) {
      const variants = {
        'upgrade only': { path: page.path, html: page.html, delay },
        prerendered: { path: page.path, html: prerendered.html, css: prerendered.css, delay },
        'prerendered, inline styles': { path: page.path, html: prerendered.inline, delay },
      };
      const runs = Object.fromEntries(Object.keys(variants).map((name) => [name, []]));
      // Alternate the variants so machine load affects both alike.
      for (let i = 0; i < samples; i++)
        for (const [name, variant] of Object.entries(variants))
          runs[name].push(await measure(browser, page, variant));
      // Template part markers carry a per-load nonce; compare without comments.
      const plain = (name) => runs[name][0].shadow.replace(/<!--[\s\S]*?-->/g, '');
      const sameShadow = Object.keys(runs).every((name) => plain(name) === plain('upgrade only'));
      if (!sameShadow)
        for (const name of Object.keys(runs)) {
          const [a, b] = [plain('upgrade only'), plain(name)];
          let i = 0;
          while (i < a.length && a[i] === b[i]) i++;
          if (i < a.length || i < b.length)
            console.log(
              `  ${name} differs at ${i}: «${a.slice(i - 40, i + 60)}» / «${b.slice(i - 40, i + 60)}»`,
            );
        }
      for (const [name, list] of Object.entries(runs)) {
        const row = {
          page: page.name,
          delay,
          variant: name,
          samples: list.length,
          hosts: prerendered.hosts,
          htmlBytes: Buffer.byteLength(variants[name].html),
          sameShadowAfterUpgrade: sameShadow,
          errors: [...new Set(list.flatMap((r) => r.errors))],
        };
        for (const key of ['fcp', 'lcp', 'cls', 'shifts', 'defined', 'script', 'layout', 'style'])
          row[key] = Number(median(list.map((r) => r[key])).toFixed(key === 'cls' ? 4 : 1));
        results.push(row);
        console.log(
          `${page.name}, JS delay ${delay} ms, ${name}: FCP ${row.fcp} ms, LCP ${row.lcp} ms, CLS ${row.cls} (${row.shifts} shifts), defined ${row.defined} ms, script ${row.script} ms, layout ${row.layout} ms, style ${row.style} ms, ${row.htmlBytes} B HTML, same shadow DOM after upgrade: ${row.sameShadowAfterUpgrade}${row.errors.length ? `, errors: ${row.errors.join(' | ')}` : ''}`,
        );
      }
    }
  }
} finally {
  await browser.close();
}
const out = join(
  root,
  `research/benchmarks/results/dsd-first-paint-${new Date().toISOString().slice(0, 10)}.json`,
);
await writeFile(
  out,
  `${JSON.stringify({ browser: 'chromium', samples, delays: DELAYS, results }, null, 2)}\n`,
);
console.log(`Results: ${out}`);
