#!/usr/bin/env node
import { main } from './kit/cli.js';

process.exitCode = await main(process.argv.slice(2), {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
