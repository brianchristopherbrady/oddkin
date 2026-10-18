import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@oddkin/components skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@oddkin/components');
    expect(internalDependencies).toEqual(['@oddkin/core', '@oddkin/tokens']);
  });
});
