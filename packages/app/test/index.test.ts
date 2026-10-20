import { describe, expect, it } from 'vitest';
import * as root from '../src/index.js';
import * as app from '../src/app/index.js';
import * as command from '../src/command/index.js';
import * as lifecycle from '../src/lifecycle/index.js';
import * as resource from '../src/resource/index.js';
import * as router from '../src/router/index.js';

describe('@oddkin/app root entry', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(root.packageName).toBe('@oddkin/app');
    expect(root.internalDependencies).toEqual(['@oddkin/core', '@oddkin/state']);
  });

  it('re-exports application ownership, resources, commands, the router, and the page lifecycle', () => {
    const entries = { ...app, ...resource, ...command, ...router, ...lifecycle };
    for (const [name, value] of Object.entries(entries))
      expect((root as Record<string, unknown>)[name], name).toBe(value);
    expect(Object.keys(root).sort()).toEqual(
      [
        ...Object.keys(app),
        ...Object.keys(resource),
        ...Object.keys(command),
        ...Object.keys(router),
        ...Object.keys(lifecycle),
        'internalDependencies',
        'packageName',
      ].sort(),
    );
  });
});
