import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Each AI element's declared customization levels (multi-product.md §6) against what ships, read
// from the published metadata `npm run build` writes: level 1, its styles read theme tokens;
// level 2, it documents parts, slots, or variables. No AI element separates structural from
// visual styles or publishes a foundation entry, so none claims level 3.
const pkg = new URL('../', import.meta.url);
const json = (url: URL) => JSON.parse(readFileSync(url, 'utf8')) as Record<string, any>;
const manifest = json(new URL('package.json', pkg));
const cem = json(new URL('custom-elements.json', pkg));
const metadata = json(new URL('oddkin.metadata.json', pkg));
const declarations = (cem['modules'] as { declarations?: Record<string, any>[] }[]).flatMap(
  (m) => m.declarations ?? [],
);
const documented = (tag: string, list: string, name: string) =>
  !!declarations
    .find((d) => d['tagName'] === tag)
    ?.[list]?.find((item: { name: string }) => item.name === name)?.description;

describe('@oddkin/ai customization levels', () => {
  const components = Object.values(metadata['components']) as Record<string, any>[];

  it('every element declares levels 1 and 2, as authored', () => {
    expect(components).toHaveLength(24);
    for (const c of components)
      expect([
        c['tag'],
        c['customization']?.['levels']?.['value'],
        c['customization']?.['levels']?.['provenance'],
      ]).toEqual([c['tag'], [1, 2], 'authored']);
  });

  it('level 1: the default styles read theme tokens', () => {
    for (const c of components)
      expect(
        (c['tokenReads'] as { token: string }[]).some((t) => !t.token.startsWith('--')),
        c['tag'],
      ).toBe(true);
  });

  it('level 2: documented parts, slots, or variables', () => {
    for (const c of components) {
      const tag = c['tag'] as string;
      const paths = c['customization'] as {
        parts?: string[];
        slots?: string[];
        variables?: string[];
      };
      const ids = [...(paths.parts ?? []), ...(paths.slots ?? []), ...(paths.variables ?? [])];
      expect(ids.length, tag).toBeGreaterThan(0);
      for (const id of ids) {
        const [, kind, name] = /^(part|slot|cssprop):[^#]+#(.*)$/.exec(id) ?? [];
        const list = kind === 'part' ? 'cssParts' : kind === 'slot' ? 'slots' : 'cssProperties';
        expect(documented(tag, list, name!), `${tag} ${id}`).toBe(true);
      }
    }
  });

  it('level 3 is not claimed: there is no foundation entry', () => {
    expect(Object.keys(manifest['exports']).filter((key) => key.includes('foundation'))).toEqual(
      [],
    );
  });
});
