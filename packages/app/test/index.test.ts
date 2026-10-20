import { describe, expect, it } from 'vitest';
import * as root from '../src/index.js';
import * as app from '../src/app/index.js';

describe('@oddkin/app root entry', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(root.packageName).toBe('@oddkin/app');
    expect(root.internalDependencies).toEqual(['@oddkin/core', '@oddkin/state']);
  });

  it('re-exports application ownership', () => {
    for (const [name, value] of Object.entries(app))
      expect((root as Record<string, unknown>)[name], name).toBe(value);
    expect(Object.keys(root).sort()).toEqual(
      [...Object.keys(app), 'internalDependencies', 'packageName'].sort(),
    );
  });
});
