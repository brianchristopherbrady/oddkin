import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@mote/core skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@mote/core');
    expect(internalDependencies).toEqual([]);
  });
});
