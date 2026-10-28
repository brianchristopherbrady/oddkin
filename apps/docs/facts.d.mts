import type { FactBlocks } from './src/pages/model.js';

/** Every fact of the authored docs pages, generated from the repository's published files. */
export function docsFacts(root: string): Promise<FactBlocks>;
