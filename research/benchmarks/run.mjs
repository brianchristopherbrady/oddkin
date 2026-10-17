// Mote benchmarks (M3 baseline). Outside shipped code.
// Usage: node research/benchmarks/run.mjs [--samples 15] [--quick]
// Writes research/benchmarks/results/<date>-<platform>.json with raw samples and summaries.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium, firefox, webkit } from 'playwright';
import { measureSizes } from './size/measure.mjs';

const args = process.argv.slice(2);
const SAMPLES = Number(args[args.indexOf('--samples') + 1] || 15) || 15;
const QUICK = args.includes('--quick');
const SIZES = QUICK ? [10, 100] : [10, 100, 1000];
const copiesFor = (n) => Math.max(1, Math.floor(1000 / n));
const OPS = ['replace', 'edit', 'insert', 'remove', 'reverse'];
const PORT = 4183;
const out = 'research/benchmarks/.build';
await mkdir(out, { recursive: true });

const summarize = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    median: round(pick(0.5)),
    p95: round(pick(0.95)),
    min: round(sorted[0]),
    samples: samples.map(round),
  };
};

// ---- Bytes ----
const sizes = await measureSizes();

// ---- Runtime ----
await build({
  entryPoints: ['research/benchmarks/runtime/bench.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outfile: join(out, 'bench.js'),
});
const server = spawn(process.execPath, ['scripts/serve-static.mjs', '--port', String(PORT)], {
  stdio: 'ignore',
});
for (let attempt = 0; ; attempt++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/research/benchmarks/runtime/`)).ok) break;
  } catch {
    if (attempt > 50) throw new Error('static server did not start');
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const browsers = { chromium, firefox, webkit };
const runtime = {};
try {
  for (const [name, type] of Object.entries(browsers)) {
    const browser = await type.launch();
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/research/benchmarks/runtime/`);
    await page.waitForFunction(() => 'bench' in globalThis);
    const call = (method, ...params) =>
      page.evaluate(({ method, params }) => globalThis.bench[method](...params), {
        method,
        params,
      });
    const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : undefined;
    const heap = async (gc) => {
      if (!cdp) return undefined;
      if (gc) await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };
    const results = { counters: {}, lists: {}, memory: {} };

    // Warm-up.
    for (let i = 0; i < 3; i++) {
      await call('mount', 'bench-direct', 100);
      await call('updateAll');
    }

    for (const tag of ['bench-direct', 'bench-tracked']) {
      const mount = [];
      const updateAll = [];
      const updateOne = [];
      const unmount = [];
      for (let i = 0; i < SAMPLES; i++) {
        mount.push(await call('mount', tag, 1000));
        updateAll.push(await call('updateAll'));
        updateOne.push(await call('updateOne'));
        unmount.push(await call('unmount'));
      }
      results.counters[tag] = {
        mount1000: summarize(mount),
        updateAll1000: summarize(updateAll),
        updateOneOf1000: summarize(updateOne),
        unmount1000: summarize(unmount),
      };
    }

    for (const kind of ['collection', 'handwritten']) {
      results.lists[kind] = {};
      for (const n of SIZES) {
        results.lists[kind][n] = {};
        for (const op of OPS) {
          const samples = [];
          for (let i = 0; i < SAMPLES; i++) {
            await call('setupList', kind, n, copiesFor(n));
            samples.push(await call('listOp', op));
          }
          const text = await call('listText');
          const expected = op === 'insert' ? n + 1 : op === 'remove' ? n - 1 : n;
          if (text.length !== expected)
            throw new Error(
              `${name} ${kind} ${n} ${op}: rendered ${text.length} items, expected ${expected}`,
            );
          results.lists[kind][n][op] = summarize(samples);
        }
      }
    }

    // Exact ownership accounting: Scope-owned resources return to baseline after 100 cycles.
    await call('reset');
    const ownedBefore = await call('owned');
    await call('cycle', 100, 100);
    const ownedAfter = await call('owned');
    results.ownership = {
      cycles: 100,
      countersPerCycle: 100,
      before: ownedBefore,
      after: ownedAfter,
    };
    if (JSON.stringify(ownedBefore) !== JSON.stringify(ownedAfter)) {
      throw new Error(
        `${name}: owned resources did not return to baseline: ${JSON.stringify(results.ownership)}`,
      );
    }

    if (cdp) {
      // Retained heap per mounted counter, and return to baseline after removal (forced GC).
      await call('reset');
      const before = await heap(true);
      await call('mount', 'bench-direct', 1000);
      const mounted = await heap(true);
      await call('reset');
      // Leak check: heap (after forced GC) following each of several mount/unmount cycles.
      const cycles = [];
      for (let i = 0; i < 6; i++) {
        await call('mount', 'bench-direct', 1000);
        await call('reset');
        cycles.push(await heap(true));
      }
      const growth = cycles.slice(1).map((value, i) => value - cycles[i]);
      await call('cycle', 100, 100);
      await call('reset');
      const after100 = await heap(true);
      results.memory.counters = {
        retainedBytesPerMountedCounter: Math.round((mounted - before) / 1000),
        heapAfterEachMountUnmountCycle: cycles,
        netGrowthAcrossCyclesBytes: cycles[cycles.length - 1] - cycles[0],
        largestCycleToCycleChangeBytes: Math.max(...growth.map(Math.abs)),
        heapAfter100MoreCyclesOf100Bytes: after100,
        growthFromFirstCycleTo106thBytes: after100 - cycles[0],
      };
      for (const kind of ['collection', 'handwritten']) {
        results.memory[kind] = {};
        for (const n of SIZES) {
          await call('reset');
          const base = await heap(true);
          await call('setupList', kind, n);
          const retained = (await heap(true)) - base;
          const allocated = [];
          for (let i = 0; i < 5; i++) {
            const start = await heap(true);
            await call('listOp', 'replace');
            allocated.push((await heap(false)) - start);
          }
          results.memory[kind][n] = {
            retainedBytes: retained,
            replaceAllocatedBytesMedian: summarize(allocated).median,
          };
        }
      }
    }
    runtime[name] = { version: browser.version(), ...results };
    await browser.close();
  }
} finally {
  server.kill();
}

const report = {
  date: new Date().toISOString(),
  method: {
    timing:
      'performance.now() in the page around the operation plus a synchronous flush(); setup untimed; fresh setup per list sample; 3 warm-up rounds. List ops are applied to max(1, floor(1000/n)) independent copies and divided by the copy count; updateOneOf1000 is the mean of 100 increment+flush rounds (Firefox and WebKit clamp performance.now() to about 1 ms without cross-origin isolation)',
    samples: SAMPLES,
    memory:
      'Chromium only: CDP HeapProfiler.collectGarbage then Runtime.getHeapUsage().usedSize; allocation = heap after operation (no GC) minus heap before (after GC)',
    bundles: 'esbuild bundle, minify, ESM, es2022; gzip level 9; Brotli quality 11',
    headless: true,
  },
  environment: {
    node: process.version,
    os: `${platform()} ${release()} ${arch()}`,
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryGiB: Math.round(totalmem() / 2 ** 30),
  },
  esbuild: JSON.parse(await readFile('node_modules/esbuild/package.json', 'utf8')).version,
  sizes,
  runtime,
};
await mkdir('research/benchmarks/results', { recursive: true });
const file = `research/benchmarks/results/${report.date.slice(0, 10)}-${platform()}${QUICK ? '-quick' : ''}.json`;
await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);

console.log(`\nBytes (minified / gzip / brotli):`);
for (const [entry, s] of Object.entries(sizes))
  console.log(
    `  ${entry.padEnd(10)} ${String(s.minified).padStart(6)} / ${String(s.gzip).padStart(5)} / ${String(s.brotli).padStart(5)}`,
  );
for (const [name, r] of Object.entries(runtime)) {
  console.log(`\n${name} ${r.version} (median ms, p95):`);
  for (const [tag, c] of Object.entries(r.counters)) {
    console.log(
      `  ${tag}: mount1000 ${c.mount1000.median} (${c.mount1000.p95}), updateAll1000 ${c.updateAll1000.median} (${c.updateAll1000.p95}), updateOne ${c.updateOneOf1000.median} (${c.updateOneOf1000.p95})`,
    );
  }
  for (const [kind, bySize] of Object.entries(r.lists)) {
    for (const [n, ops] of Object.entries(bySize)) {
      console.log(
        `  ${kind.padEnd(11)} n=${String(n).padEnd(4)} ${OPS.map((op) => `${op} ${ops[op].median}`).join(', ')}`,
      );
    }
  }
  console.log(
    `  owned after ${r.ownership.cycles} cycles: ${JSON.stringify(r.ownership.after)} (baseline ${JSON.stringify(r.ownership.before)})`,
  );
  if (r.memory?.counters) console.log(`  memory: ${JSON.stringify(r.memory)}`);
}
console.log(`\nWrote ${file}`);
