// 1,000-cycle lifetime and retained-memory run (plan M8 917). Outside shipped code.
// Usage: node research/benchmarks/lifetime/run.mjs [--cycles 1000]
// For each engine: warm up, then two batches of N cycles per scenario. Ownership (core's
// scopeStats) must return to its baseline after every batch; Chromium also reports the retained
// heap after forced GC (CDP HeapProfiler.collectGarbage, Runtime.getHeapUsage), before and after
// each batch. Writes research/benchmarks/results/lifetime-<date>-<platform>.json.
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium, firefox, webkit } from 'playwright';

const args = process.argv.slice(2);
const CYCLES = Number(args[args.indexOf('--cycles') + 1] || 1000) || 1000;
const WARMUP = Math.min(100, CYCLES);
const root = resolve('.');
const out = 'research/benchmarks/.build';
await mkdir(out, { recursive: true });
await build({
  entryPoints: ['research/benchmarks/lifetime/bench.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outfile: join(out, 'lifetime.js'),
});

const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer(async (request, response) => {
  const path = normalize(join(root, decodeURIComponent(new URL(request.url, 'http://x').pathname)));
  const file = path.endsWith('\\') || path.endsWith('/') ? join(path, 'index.html') : path;
  if (!file.startsWith(root)) return void response.writeHead(403).end();
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/research/benchmarks/lifetime/`;

const SCENARIOS = ['appCycles', 'navigationCycles', 'themeEditCycles', 'componentCycles'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const results = {};
try {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => 'lifetime' in globalThis);
    const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : undefined;
    const heap = async () => {
      if (!cdp) return undefined;
      await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };
    const run = (scenario, cycles) =>
      page.evaluate(({ scenario, cycles }) => globalThis.lifetime[scenario](cycles), {
        scenario,
        cycles,
      });
    results[name] = { version: browser.version(), scenarios: {}, errors };
    for (const scenario of SCENARIOS) {
      // WebKit refuses more than 100 history writes per 10 s; the router then abandons navigations.
      if (scenario === 'navigationCycles' && name === 'webkit') {
        results[name].scenarios[scenario] = {
          skipped: 'WebKit limits history writes to 100 per 10 seconds',
        };
        continue;
      }
      await run(scenario, WARMUP);
      const heap0 = await heap();
      const first = await run(scenario, CYCLES);
      const heap1 = await heap();
      const second = await run(scenario, CYCLES);
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
      results[name].scenarios[scenario] = entry;
      console.log(
        `${name} ${scenario}: ownership ${entry.ownershipReturned ? 'returned' : 'LEAKED'}; ${entry.ms.join(' / ')} ms` +
          (entry.retainedPerCycleBytes
            ? `; retained ${entry.retainedPerCycleBytes.join(' / ')} B/cycle`
            : '') +
          `; ${entry.check.join(' / ')}`,
      );
    }
    await browser.close();
  }
} finally {
  server.close();
}

const date = new Date().toISOString().slice(0, 10);
const file = `research/benchmarks/results/lifetime-${date}-${platform()}.json`;
await writeFile(
  file,
  `${JSON.stringify(
    {
      date,
      cycles: CYCLES,
      warmup: WARMUP,
      method:
        'Each scenario: warm-up, then two batches; ownership = core scopeStats() equal before and after each batch; Chromium heap = CDP HeapProfiler.collectGarbage then Runtime.getHeapUsage().usedSize before and after each batch; retained per cycle = heap growth / cycles.',
      machine: {
        platform: platform(),
        release: release(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        memory: totalmem(),
      },
      node: process.version,
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${file}`);
