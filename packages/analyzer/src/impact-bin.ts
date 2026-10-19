#!/usr/bin/env node
import { main } from './impact-cli.js';

process.exitCode = main(process.argv.slice(2), {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
