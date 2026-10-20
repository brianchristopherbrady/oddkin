#!/usr/bin/env node
import { run } from './cli.js';

const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort());
process.exitCode = await run(process.argv.slice(2), {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
  signal: controller.signal,
  inherit: true,
});
