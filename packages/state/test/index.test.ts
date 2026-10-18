import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@oddkin/state skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@oddkin/state');
    expect(internalDependencies).toEqual(['@oddkin/core']);
  });
});
