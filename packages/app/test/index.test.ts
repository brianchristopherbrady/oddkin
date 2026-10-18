import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@oddkin/app skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@oddkin/app');
    expect(internalDependencies).toEqual(['@oddkin/core', '@oddkin/state']);
  });
});
