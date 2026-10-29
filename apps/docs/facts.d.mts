import type { SiteFacts } from './src/pages/document.js';
import type { FactBlocks } from './src/pages/model.js';

/** Every fact of the authored docs pages, generated from the repository's published files. */
export function docsFacts(root: string): Promise<FactBlocks>;

/**
 * The shell's facts, from the core manifest and the README, with the catalog's pages from the
 * Workbench reference `index` (none without it).
 */
export function siteFacts(
  root: string,
  index?: {
    registry: {
      pages: readonly {
        kind: string;
        route: string;
        title: string;
        group?: string;
        visible: boolean;
      }[];
    };
  },
): Promise<SiteFacts>;
