import { VERSION } from './version.js';

const COPIES: unique symbol = Symbol.for('oddkin.core.copies') as never;

/**
 * Development builds record each copy of `@oddkin/core` on the page under a registered symbol
 * (core-contracts.md §5.1) and warn once, from the second copy, naming both versions.
 */
export function registerCopy(): void {
  const page = globalThis as { [COPIES]?: string[] };
  const copies = (page[COPIES] ??= []);
  copies.push(VERSION);
  if (copies.length === 2)
    console.warn(
      `[core.copies] Two copies of @oddkin/core run on this page (${copies[0]} and ${copies[1]}). Readables, context keys, and error handlers do not cross copies, so state from one does not update the other. Install one copy (\`npm ls @oddkin/core\` shows them), or keep the two applications apart on purpose.`,
    );
}
