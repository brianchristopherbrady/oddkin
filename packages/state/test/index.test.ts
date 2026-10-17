import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@mote/state skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@mote/state');
    expect(internalDependencies).toEqual(['@mote/core']);
  });
});
