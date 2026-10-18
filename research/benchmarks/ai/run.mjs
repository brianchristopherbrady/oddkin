// @oddkin/ai performance fixture runner (outside shipped code).
// Usage: node research/benchmarks/ai/run.mjs [--samples 5] [--messages 1000] [--chars 20000]
// Requires `npm run build`. Writes research/benchmarks/results/ai-<date>-<platform>.json.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium, firefox, webkit } from 'playwright';

const args = process.argv.slice(2);
const option = (name, fallback) => Number(args[args.indexOf(name) + 1] || fallback) || fallback;
const SAMPLES = option('--samples', 5);
const MESSAGES = option('--messages', 1000);
const CHARS = option('--chars', 20000);
const CHUNKS_PER_FRAME = 3;
const PORT = 4184;
const out = 'research/benchmarks/.build';
await mkdir(out, { recursive: true });

await build({
  entryPoints: ['research/benchmarks/ai/bench.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outfile: join(out, 'ai-bench.js'),
  logLevel: 'error',
});

const summarize = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const round = (n) => Math.round(n * 100) / 100;
  return {
    median: round(pick(0.5)),
    max: round(sorted[sorted.length - 1]),
    samples: samples.map(round),
  };
};

const server = spawn(process.execPath, ['scripts/serve-static.mjs', '--port', String(PORT)], {
  stdio: 'ignore',
});
for (let attempt = 0; ; attempt++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/research/benchmarks/ai/`)).ok) break;
  } catch {
    if (attempt > 50) throw new Error('static server did not start');
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const runtime = {};
try {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/research/benchmarks/ai/`);
    await page.waitForFunction(() => 'bench' in globalThis);
    const call = (method, ...params) =>
      page.evaluate(({ method, params }) => globalThis.bench[method](...params), {
        method,
        params,
      });
    const cdp = name === 'chromium' ? await page.context().newCDPSession(page) : undefined;
    const heap = async () => {
      if (!cdp) return undefined;
      await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };

    // Warm-up.
    await call('mountHistory', 50);
    await call('stream', 2000, CHUNKS_PER_FRAME);
    await call('teardown');

    const raw = { history: [], stream: [], baseline: [], memory: [] };
    for (let i = 0; i < SAMPLES; i++) {
      const before = await heap();
      raw.history.push(await call('mountHistory', MESSAGES));
      const mounted = await heap();
      raw.stream.push(await call('stream', CHARS, CHUNKS_PER_FRAME));
      const streamed = await heap();
      const remaining = await call('teardown');
      const after = await heap();
      if (cdp) raw.memory.push({ before, mounted, streamed, after, remainingHostNodes: remaining });
      // The same stream into an empty conversation, for comparison.
      await call('mountHistory', 0);
      raw.baseline.push(await call('stream', CHARS, CHUNKS_PER_FRAME));
      await call('teardown');
    }
    for (const s of raw.stream) {
      if (!s.followedToBottom)
        throw new Error(`${name}: the view did not follow the stream to the bottom`);
      if (!s.renderedFinalHeading) throw new Error(`${name}: the streamed answer was not rendered`);
    }
    if (raw.history.some((h) => h.messages !== MESSAGES))
      throw new Error(`${name}: not every message rendered`);
    if (errors.length) throw new Error(`${name}: page errors: ${errors.join('; ')}`);

    const pick = (rows, key) => summarize(rows.map((r) => r[key]));
    runtime[name] = {
      version: browser.version(),
      history: {
        messages: MESSAGES,
        snapshotLoadMs: pick(raw.history, 'snapshotLoadMs'),
        mountToCommitMs: pick(raw.history, 'mountToCommitMs'),
        mountToSettledMs: pick(raw.history, 'mountToSettledMs'),
        domNodes: raw.history[0].domNodes,
      },
      streamIntoHistory: summarizeStream(raw.stream),
      streamIntoEmpty: summarizeStream(raw.baseline),
      memory: cdp
        ? {
            retainedBytesPerMessage: Math.round(
              raw.memory.map((m) => (m.mounted - m.before) / MESSAGES).sort((a, b) => a - b)[
                Math.floor(SAMPLES / 2)
              ],
            ),
            streamGrowthBytes: summarize(raw.memory.map((m) => m.streamed - m.mounted)),
            afterTeardownMinusBeforeBytes: summarize(raw.memory.map((m) => m.after - m.before)),
            heapBeforeEachSample: raw.memory.map((m) => m.before),
          }
        : 'Chromium only',
    };
    await browser.close();
  }
} finally {
  server.kill();
}

function summarizeStream(rows) {
  const pick = (key) => summarize(rows.map((r) => r[key]));
  return {
    chunks: rows[0].chunks,
    characters: rows[0].characters,
    chunksPerFrame: rows[0].chunksPerFrame,
    totalMs: pick('totalMs'),
    pushMsMedian: pick('pushMsMedian'),
    pushMsP95: pick('pushMsP95'),
    pushMsMax: pick('pushMsMax'),
    frameMsMedian: pick('frameMsMedian'),
    frameMsP95: pick('frameMsP95'),
    frameMsMax: pick('frameMsMax'),
    framesOver50ms: pick('framesOver50ms'),
    domNodesAfter: rows[0].domNodes,
  };
}

const report = {
  date: new Date().toISOString(),
  workload: {
    history: `${MESSAGES} messages on one branch, alternating user/assistant; assistant messages are Markdown (heading, paragraph with strong, code span and link; every 3rd a nested list; every 5th a fenced code block; every 7th two citations with two source parts; every 10th a tool call)`,
    stream: `about ${CHARS} characters of Markdown (headings, paragraphs, lists, fenced code, tables) in 3–13 character chunks, ${CHUNKS_PER_FRAME} chunks per animation frame, pushed through ConversationController into <odd-conversation> (600 px tall) with the history mounted, then into an empty conversation for comparison`,
    samples: SAMPLES,
  },
  method: {
    timing:
      'performance.now() in the page. mountToCommit = append to updateComplete; mountToSettled adds two animation frames and a task. Stream push = synchronous cost of one sink.push (controller commit and subscriber notification; rendering is frame-coalesced); frame = requestAnimationFrame-to-requestAnimationFrame interval during the stream (includes rendering). Firefox and WebKit clamp performance.now() to about 1 ms without cross-origin isolation.',
    domNodes: 'Elements and text nodes in the conversation, including every open shadow tree.',
    memory:
      'Chromium only: CDP HeapProfiler.collectGarbage then Runtime.getHeapUsage().usedSize before mounting, after mounting, after streaming, and after teardown.',
    bundle:
      "esbuild bundle of research/benchmarks/ai/bench.ts with the packages' production exports, minified, ES2022.",
    headless: true,
  },
  environment: {
    node: process.version,
    os: `${platform()} ${release()} ${arch()}`,
    cpu: cpus()[0]?.model,
    cores: cpus().length,
    memoryGiB: Math.round(totalmem() / 2 ** 30),
  },
  runtime,
};
await mkdir('research/benchmarks/results', { recursive: true });
const file = `research/benchmarks/results/ai-${report.date.slice(0, 10)}-${platform()}.json`;
await writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
for (const [name, r] of Object.entries(runtime)) {
  console.log(
    `${name} ${r.version}: history mount ${r.history.mountToSettledMs.median} ms (${r.history.domNodes} nodes); stream total ${r.streamIntoHistory.totalMs.median} ms, push p95 ${r.streamIntoHistory.pushMsP95.median} ms, frame p95 ${r.streamIntoHistory.frameMsP95.median} ms, frames >50 ms ${r.streamIntoHistory.framesOver50ms.median}; empty-conversation frame p95 ${r.streamIntoEmpty.frameMsP95.median} ms`,
  );
  if (typeof r.memory === 'object')
    console.log(`  memory: ${JSON.stringify({ ...r.memory, heapBeforeEachSample: undefined })}`);
}
console.log(`Wrote ${file}`);
