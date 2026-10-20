import { describe, expect, it } from 'vitest';
import * as root from '../src/index.js';
import * as context from '../src/context/index.js';
import * as store from '../src/store/index.js';

describe('@oddkin/state root entry', () => {
  it('identifies itself and its allowed internal dependencies', () => {
    expect(root.packageName).toBe('@oddkin/state');
    expect(root.internalDependencies).toEqual(['@oddkin/core']);
  });

  it('re-exports the store and context and keeps inspection a separate import', () => {
    for (const [name, value] of Object.entries({ ...store, ...context }))
      expect((root as Record<string, unknown>)[name], name).toBe(value);
    expect(Object.keys(root).sort()).toEqual(
      [
        ...Object.keys(store),
        ...Object.keys(context),
        'internalDependencies',
        'packageName',
      ].sort(),
    );
    expect('inspect' in root).toBe(false);
  });

  it('imports without DOM globals: context events extend the platform Event only', () => {
    expect(typeof document).toBe('undefined');
    const event = new context.ContextRequestEvent(
      context.createContext<number>('n'),
      {} as Element,
      () => {},
    );
    expect([event.type, event.bubbles, event.composed, event.subscribe]).toEqual([
      'context-request',
      true,
      true,
      false,
    ]);
  });
});
