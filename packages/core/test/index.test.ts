import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@oddkin/core skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@oddkin/core');
    expect(internalDependencies).toEqual([]);
  });
});
