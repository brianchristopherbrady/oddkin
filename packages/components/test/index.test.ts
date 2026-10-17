import { describe, expect, it } from 'vitest';
import { internalDependencies, packageName } from '../src/index.js';

describe('@mote/components skeleton', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(packageName).toBe('@mote/components');
    expect(internalDependencies).toEqual(['@mote/core', '@mote/tokens']);
  });
});
