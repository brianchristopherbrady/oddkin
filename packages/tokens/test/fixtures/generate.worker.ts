import { emitDtcg, generate, resolveTokens } from '../../src/generate/index.js';
import { cases } from './cases.js';

// Runs the unchanged generator inside a module Worker and posts each case's CSS back, plus the
// DTCG 2025.10 document of each case's first mode under `<name>.dtcg`, and every token's value in
// dark, P3, and the case's first scope under `<name>.values` (resolveTokens, as JSON).
self.postMessage(
  Object.fromEntries(
    Object.entries(cases).flatMap(([name, config]) => {
      const result = generate(config);
      const scope = result.theme?.scopes[0];
      const context = {
        mode: 'dark',
        gamut: 'p3',
        ...(scope?.kind === 'product' ? { product: scope.name } : {}),
        ...(scope?.kind === 'density' ? { density: scope.name } : {}),
        ...(scope?.kind === 'profile' ? { profiles: [scope.name] } : {}),
      } as const;
      return [
        [name, result.css],
        [`${name}.dtcg`, result.theme && emitDtcg(result.theme).text],
        [
          `${name}.values`,
          result.theme && JSON.stringify([...resolveTokens(result.theme, context)]),
        ],
      ];
    }),
  ),
);
