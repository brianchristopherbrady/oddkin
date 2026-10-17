import { generate } from '../../src/generate/index.js';
import { cases } from './cases.js';

// Runs the unchanged generator inside a module Worker and posts each case's CSS back.
self.postMessage(
  Object.fromEntries(Object.entries(cases).map(([name, config]) => [name, generate(config).css])),
);
