import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {} from '../src/side-nav/side-nav.js';

// Listeners for an element's own events are typed for TypeScript users: each published event
// that is not a native DOM event has an `GlobalEventHandlersEventMap` entry with its detail type in the
// built declarations, next to the `HTMLElementTagNameMap` entry. Events keep the `odd-` prefix
// so the global map stays free of collisions.

const root = fileURLToPath(new URL('..', import.meta.url));
const cem = JSON.parse(readFileSync(join(root, 'custom-elements.json'), 'utf8')) as {
  modules: {
    declarations?: { tagName?: string; events?: { name: string; type?: { text: string } }[] }[];
  }[];
};
const declarations = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? declarations(join(dir, entry.name))
      : entry.name.endsWith('.d.ts')
        ? [readFileSync(join(dir, entry.name), 'utf8')]
        : [],
  );
const typings = declarations(join(root, 'dist')).join('\n');
// Native events an element re-dispatches at its host keep their DOM names and types (ADR 0045
// §5.1, NATIVE_EVENTS in scripts/vocabulary.mjs).
const nativeEvents = new Set(['input', 'change', 'toggle', 'beforetoggle', 'close', 'cancel']);
const events = cem.modules
  .flatMap((m) => m.declarations ?? [])
  .filter((d) => d.tagName)
  .flatMap((d) => (d.events ?? []).map((e) => ({ tag: d.tagName!, ...e })));

describe('typed event listeners', () => {
  it('publishes unprefixed names only for re-dispatched native events', () => {
    expect(events.filter((e) => !e.name.startsWith('odd-')).map((e) => e.name)).toEqual(
      expect.arrayContaining([...nativeEvents].filter((n) => events.some((e) => e.name === n))),
    );
    for (const e of events) if (!e.name.startsWith('odd-')) expect(nativeEvents).toContain(e.name);
  });

  it.each(events.filter((e) => !nativeEvents.has(e.name)))(
    '<$tag> $name is in GlobalEventHandlersEventMap with its detail type',
    ({ name, type }) => {
      expect(name).toMatch(/^odd-/);
      const map = [...typings.matchAll(/interface GlobalEventHandlersEventMap \{([^}]*)\}/g)]
        .map((m) => m[1])
        .join('\n');
      expect(map).toContain(`'${name}': ${type?.text ?? 'CustomEvent'};`);
    },
  );
});

// Compile-time: listeners receive the published detail types (checked by `npm run typecheck`).
export function typedListeners(nav: HTMLElementTagNameMap['odd-side-nav']): void {
  nav.addEventListener('odd-action', (event) => {
    const action: string = event.detail.action;
    void action;
  });
  document.addEventListener('odd-toggle', (event) => {
    const expanded: boolean = event.detail.expanded;
    // @ts-expect-error -- the toggle detail has no `action`
    void event.detail.action;
    void expanded;
  });
}
