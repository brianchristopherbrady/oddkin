import { describe, expect, it } from 'vitest';
import * as root from '../src/index.js';
import * as store from '../src/store/index.js';

describe('@oddkin/state root entry', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(root.packageName).toBe('@oddkin/state');
    expect(root.internalDependencies).toEqual(['@oddkin/core']);
  });

  it('re-exports the store and keeps inspection a separate import', () => {
    for (const [name, value] of Object.entries(store))
      expect((root as Record<string, unknown>)[name], name).toBe(value);
    expect(Object.keys(root).sort()).toEqual(
      [...Object.keys(store), 'internalDependencies', 'packageName'].sort(),
    );
    expect('inspect' in root).toBe(false);
  });
});
