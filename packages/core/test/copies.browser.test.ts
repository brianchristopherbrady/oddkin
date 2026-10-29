import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerCopy } from '../src/internal/copies.js';
import { VERSION } from '../src/internal/version.js';

// Each copy of core records itself on the page; development builds warn once, from the second copy.
const COPIES = Symbol.for('oddkin.core.copies');
const page = globalThis as { [COPIES]?: string[] };
let saved: string[] | undefined;
const restore = () => {
  if (saved) page[COPIES] = saved;
  else delete page[COPIES];
};

beforeEach(() => {
  saved = page[COPIES];
  delete page[COPIES];
});
afterEach(() => {
  restore();
  vi.restoreAllMocks();
});

describe('copies of core on one page', () => {
  it('the second copy warns once, naming both versions; the first and third do not', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerCopy();
    expect(warn).not.toHaveBeenCalled();
    registerCopy();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain(
      `[core.copies] Two copies of @oddkin/core run on this page (${VERSION} and ${VERSION})`,
    );
    registerCopy();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(page[COPIES]).toEqual([VERSION, VERSION, VERSION]);
  });

  it('this copy registered itself when its reactive graph loaded', async () => {
    restore();
    await import('../src/reactive/index.js');
    expect(page[COPIES]).toContain(VERSION);
  });
});
