/// <reference types="vite/client" />
import { vi } from 'vitest';
import { describeCemContract } from '../../../tests/contract/cem-contract.js';

// The published custom-elements.json of @oddkin/ai describes what the browser does
// (tests/contract/cem-contract.ts). Passing facts become `verified` provenance through
// `npm run verify:metadata`. The package has no authored examples yet, so slot and part cases
// are recorded as not executed.

// 24 elements × 3 engines, each check creating fresh elements.
vi.setConfig({ testTimeout: 60_000 });

import.meta.glob('../src/**/*.define.ts', { eager: true });

await describeCemContract({
  manifestUrl: new URL('../custom-elements.json', import.meta.url),
  packageUrl: new URL('../package.json', import.meta.url),
  packageDir: 'packages/ai',
  // The files this page runs: the package's sources, the development builds of core and tokens,
  // and the components build; scripts/verification.mjs hashes the same set.
  sources: {
    ...import.meta.glob<string>('../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    ...import.meta.glob<string>(['../../core/dist/**/*.js', '!../../core/dist/prod/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    ...import.meta.glob<string>('../../tokens/dist/**/*.js', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
    ...import.meta.glob<string>('../../components/dist/**/*.js', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  },
});
