import type { SiteFacts } from './src/pages/document.js';
import type { FactBlocks } from './src/pages/model.js';

/** Every fact of the authored docs pages, generated from the repository's published files. */
export function docsFacts(root: string): Promise<FactBlocks>;

/** The shell's facts, from the core manifest and the README. */
export function siteFacts(root: string): Promise<SiteFacts>;
