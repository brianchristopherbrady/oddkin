import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@mote/app skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@mote/app');
    expect(internalDependencies).toEqual(['@mote/core', '@mote/state']);
  });
});
