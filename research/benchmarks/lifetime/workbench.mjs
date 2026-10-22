// Workbench preview switching, 1,000-cycle lifetime run (plan M8 917). Outside shipped code.
// Usage: node research/benchmarks/lifetime/workbench.mjs [--cycles 1000]
// Same method as run.mjs: per engine, a warm-up, then two batches of N cycles. One public
// <oddkin-component-panel>, inside the Workbench dev server's own page (same origin as its preview
// frame document), switches `page` through every component in the @oddkin/components and @oddkin/ai
// catalog; each cycle disposes the previous preview frame and waits until the next component is
// mounted in a fresh one. Ownership (core's scopeStats() and live preview frames, from the copies
// the panel uses) must return to its baseline after every batch; Chromium also reports the retained
// heap after forced GC. Writes research/benchmarks/results/lifetime-workbench-<date>-<platform>.json.
import { readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { chromium, firefox, webkit } from 'playwright';
import { startDevServer } from '../../../packages/workbench/dist/node/index.js';

const args = process.argv.slice(2);
const CYCLES = Number(args[args.indexOf('--cycles') + 1] || 1000) || 1000;
const WARMUP = Math.min(100, CYCLES);
const ENGINES = (
  args.includes('--engines') ? args[args.indexOf('--engines') + 1] : 'chromium,firefox,webkit'
).split(',');

const server = await startDevServer({
  config: 'tests/fixtures/workbench-oddkin',
  port: 0,
  host: '127.0.0.1',
  watch: false,
});
const base = server.url;

/** Runs in the Workbench page: set up the panel once, then switch pages for `cycles` cycles. */
async function previewSwitchCycles(cycles) {
  const state = (globalThis.__switch ??= await (async () => {
    const [{ scopeStats }, { previewProtocolStats }] = await Promise.all([
      import('@oddkin/core/scope'),
      import('@oddkin/workbench/preview'),
      import('@oddkin/workbench/panels/component/define'),
    ]);
    const json = async (url) => (await fetch(url)).json();
    const index = await json('/_oddkin/index.json');
    const files = Object.entries(index.pages)
      .filter(([id]) => id.startsWith('components/') && id.split('/').length === 2)
      .map(([, file]) => file);
    const pages = await Promise.all(files.map((file) => json(`/_oddkin/${file}`)));
    const panel = document.createElement('oddkin-component-panel');
    panel.index = index;
    panel.frameUrl = '/_oddkin/frame.html';
    panel.href = (route) => route;
    document.body.append(panel);
    const stats = () => ({ ...scopeStats(), liveFrames: previewProtocolStats().liveFrames });
    return { panel, pages, stats, mounted: 0 };
  })());
  const { panel, pages, stats } = state;
  const show = async (page) => {
    panel.page = page;
    for (let waited = 0; ; waited += 10) {
      const preview = panel.previews[0];
      if (preview?.iframe.contentDocument?.querySelector(page.tag)?.shadowRoot) break;
      if (waited > 30_000) {
        const doc = preview?.iframe.contentDocument;
        const status = [...(panel.shadowRoot ?? panel).querySelectorAll('.wb-status')]
          .map((el) => el.textContent?.trim())
          .join(' | ');
        throw new Error(
          `<${page.tag}> did not mount within 30 s (cycle ${state.mounted}); status: "${status}"; frame: ${doc ? doc.readyState + ' ' + (doc.querySelector('[data-oddkin-preview]')?.innerHTML.slice(0, 300) ?? 'no container') : 'no document'}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    state.mounted++;
  };
  // Pending replies hold a request timer for a moment after the element renders: measure once the
  // counters have been unchanged for 100 ms (at most 2 s), at both ends of a batch.
  const settled = async () => {
    let last = JSON.stringify(stats());
    for (let stable = 0, waited = 0; stable < 100 && waited < 2_000; waited += 20) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const now = JSON.stringify(stats());
      stable = now === last ? stable + 20 : 0;
      last = now;
    }
    return JSON.parse(last);
  };
  // Each batch starts and ends on the first page, so the same page's scopes are live both times.
  await show(pages[0]);
  const before = await settled();
  const start = performance.now();
  for (let i = 1; i <= cycles; i++) await show(pages[i % pages.length]);
  await show(pages[0]);
  const ms = performance.now() - start;
  return {
    cycles,
    ms,
    before,
    after: await settled(),
    check: `${pages.length} components; mounted ${state.mounted}`,
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const results = {};
try {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit }).filter(([name]) =>
    ENGINES.includes(name),
  )) {
    const browser = await type.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    // The overview page: the shell shows no preview of its own.
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('oddkin-workbench main h1'));
    const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : undefined;
    const heap = async () => {
      if (!cdp) return undefined;
      await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };
    const run = (cycles) => page.evaluate(previewSwitchCycles, cycles);
    await run(WARMUP);
    const heap0 = await heap();
    const first = await run(CYCLES);
    const heap1 = await heap();
    const second = await run(CYCLES);
    const heap2 = await heap();
    const entry = {
      cycles: CYCLES,
      ms: [Math.round(first.ms), Math.round(second.ms)],
      ownershipReturned: same(first.before, first.after) && same(second.before, second.after),
      scopeStats: { before: first.before, after: second.after },
      check: [first.check, second.check],
    };
    if (heap0 !== undefined) {
      entry.heapBytes = [heap0, heap1, heap2];
      entry.retainedPerCycleBytes = [
        Math.round((heap1 - heap0) / CYCLES),
        Math.round((heap2 - heap1) / CYCLES),
      ];
    }
    results[name] = {
      version: browser.version(),
      scenarios: { previewSwitchCycles: entry },
      errors,
    };
    console.log(
      `${name} previewSwitchCycles: ownership ${entry.ownershipReturned ? 'returned' : 'LEAKED'}; ${entry.ms.join(' / ')} ms` +
        (entry.retainedPerCycleBytes
          ? `; retained ${entry.retainedPerCycleBytes.join(' / ')} B/cycle`
          : '') +
        `; ${entry.check.join(' / ')}; errors ${errors.length}`,
    );
    await browser.close();
  }
} finally {
  await server.close();
}

const date = new Date().toISOString().slice(0, 10);
const file = `research/benchmarks/results/lifetime-workbench-${date}-${platform()}.json`;
await writeFile(
  file,
  `${JSON.stringify(
    {
      date,
      cycles: CYCLES,
      warmup: WARMUP,
      method:
        'One <oddkin-component-panel> in the Workbench dev server page switches `page` through the catalog; each cycle waits for the next component to render in a fresh preview frame. Warm-up, then two batches, each starting and ending on the first page; ownership = core scopeStats() plus live preview frames equal before and after each batch; Chromium heap = CDP HeapProfiler.collectGarbage then Runtime.getHeapUsage().usedSize before and after each batch; retained per cycle = heap growth / cycles.',
      machine: {
        platform: platform(),
        release: release(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        memory: totalmem(),
      },
      node: process.version,
      // A run limited with --engines keeps the other engines' results from the same day.
      results: {
        ...(await readFile(file, 'utf8').then(
          (text) => JSON.parse(text).results,
          () => ({}),
        )),
        ...results,
      },
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${file}`);
