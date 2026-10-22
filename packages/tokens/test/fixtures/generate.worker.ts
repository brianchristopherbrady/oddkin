import { emitDtcg, generate } from '../../src/generate/index.js';
import { cases } from './cases.js';

// Runs the unchanged generator inside a module Worker and posts each case's CSS back, plus the
// DTCG 2025.10 document of each case's first mode under `<name>.dtcg`.
self.postMessage(
  Object.fromEntries(
    Object.entries(cases).flatMap(([name, config]) => {
      const result = generate(config);
      return [
        [name, result.css],
        [`${name}.dtcg`, result.theme && emitDtcg(result.theme).text],
      ];
    }),
  ),
);
