import { describe, expect, it } from 'vitest';
import { checkMetadata, METADATA_SCHEMA } from '../src/metadata.js';

// Reading oddkin.metadata.json beside the package's manifest (metadata-and-analyzer.md §8): the
// manifest says which elements exist, and only its tags keep their enrichment and examples.
const manifest = {
  modules: [
    { path: 'a.js', declarations: [{ name: 'A', tagName: 'x-a' }] },
    { path: 'util.js', declarations: [{ name: 'helper' }] },
    { path: 'b.js', declarations: [{ name: 'B', tagName: 'x-b' }] },
  ],
};
const metadata = {
  schema: METADATA_SCHEMA,
  library: { name: 'x', version: '1.0.0' },
  components: {
    'component:x-a': { tag: 'x-a', registration: 'x/a' },
    'component:x-b': { tag: 'x-b' },
  },
  examples: {
    'example:x-a/default': { component: 'component:x-a', name: 'default' },
    'example:x-b/default': { component: 'component:x-b', name: 'default' },
  },
};

describe('checkMetadata', () => {
  it('reads metadata that agrees with the manifest as it is', () => {
    const result = checkMetadata(metadata, manifest);
    expect(result.diagnostics).toEqual([]);
    expect(result.metadata).toBe(metadata);
    // Without a manifest only the schema is checked.
    expect(checkMetadata(metadata).metadata).toBe(metadata);
  });

  it('leaves out the components and examples of tags the manifest no longer declares', () => {
    const stale = {
      ...metadata,
      components: { ...metadata.components, 'component:x-old': { tag: 'x-old' } },
      examples: {
        ...metadata.examples,
        'example:x-old/default': { component: 'component:x-old', name: 'default' },
      },
    };
    const result = checkMetadata(stale, manifest, 'x/oddkin.metadata.json');
    expect(result.metadata).toEqual(metadata);
    expect(
      result.diagnostics.map(({ code, severity, subject }) => [code, severity, subject]),
    ).toEqual([
      ['metadata.component.undeclared', 'warning', 'component:x-old'],
      ['metadata.example.undeclared', 'warning', 'example:x-old/default'],
    ]);
    expect(result.diagnostics[0]?.message).toContain(
      'x/oddkin.metadata.json describes <x-old>, which the package',
    );
    // An example of a declared tag stays even when the metadata does not describe that tag.
    const examplesOnly = { schema: METADATA_SCHEMA, components: {}, examples: metadata.examples };
    expect(checkMetadata(examplesOnly, manifest)).toEqual({
      metadata: examplesOnly,
      diagnostics: [],
    });
    // The original is not changed.
    expect(Object.keys(stale.components)).toContain('component:x-old');
  });

  it('does not read metadata of a schema it does not know', () => {
    for (const schema of ['https://oddkin.dev/schemas/oddkin-metadata/v2.json', undefined]) {
      const result = checkMetadata({ ...metadata, schema }, manifest);
      expect(result.metadata).toBeUndefined();
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'metadata.schema.unsupported', severity: 'error' }),
      ]);
      expect(result.diagnostics[0]?.message).toContain(
        schema ? `has schema "${schema}"` : 'has schema none',
      );
    }
  });
});
