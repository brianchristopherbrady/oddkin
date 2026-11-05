/**
 * Reading a package's `oddkin.metadata.json` beside its Custom Elements Manifest
 * (metadata-and-analyzer.md §8): the manifest says which elements exist, and the metadata
 * enriches those, by tag. Workbench, change impact, and the agent kits read both through
 * `checkMetadata`, so they agree: stale metadata never brings back an element the manifest no
 * longer declares, and metadata of a schema this version does not know is not read at all.
 * Plain Node: it never loads TypeScript and never executes anything.
 */
import { METADATA_SCHEMA } from './emit.js';

export { METADATA_SCHEMA };

export interface MetadataDiagnostic {
  readonly code:
    'metadata.schema.unsupported' | 'metadata.component.undeclared' | 'metadata.example.undeclared';
  readonly severity: 'error' | 'warning';
  readonly message: string;
  /** The component or example id it is about. */
  readonly subject?: string;
}

export interface MetadataCheck<M> {
  /**
   * The metadata to read: without the components and examples of tags the manifest does not
   * declare, or `undefined` when its schema is not one this version reads.
   */
  readonly metadata: M | undefined;
  readonly diagnostics: readonly MetadataDiagnostic[];
}

/** The manifest fields read here. */
export interface ManifestTags {
  readonly modules?: readonly {
    readonly declarations?: readonly { readonly name?: string; readonly tagName?: string }[];
  }[];
}

const tagOf = (component: unknown) =>
  typeof component === 'string' ? component.replace(/^component:/, '') : undefined;

/**
 * Check `metadata` against the package's `manifest` and return what to read. Without a manifest,
 * only the schema is checked. `file` names the metadata in messages.
 */
export function checkMetadata<M extends object>(
  metadata: M,
  manifest?: ManifestTags,
  file = 'oddkin.metadata.json',
): MetadataCheck<M> {
  const record = metadata as Record<string, unknown>;
  const schema = record['schema'];
  if (schema !== METADATA_SCHEMA)
    return {
      metadata: undefined,
      diagnostics: [
        {
          code: 'metadata.schema.unsupported',
          severity: 'error',
          message: `${file} has schema ${typeof schema === 'string' ? `"${schema}"` : 'none'}, and this version reads only ${METADATA_SCHEMA}: it is not read. Install the @oddkin/analyzer version that wrote it, or run oddkin-analyze again.`,
        },
      ],
    };
  if (!manifest) return { metadata, diagnostics: [] };
  const declared = new Set(
    (manifest.modules ?? []).flatMap((m) =>
      (m.declarations ?? []).flatMap((d) =>
        typeof d.tagName === 'string' && d.tagName ? [d.tagName] : [],
      ),
    ),
  );
  const diagnostics: MetadataDiagnostic[] = [];
  const keep = (field: 'components' | 'examples', tag: (entry: unknown) => string | undefined) => {
    const entries = record[field];
    if (!entries || typeof entries !== 'object') return undefined;
    let dropped = false;
    const kept: Record<string, unknown> = {};
    for (const [id, entry] of Object.entries(entries)) {
      const name = tag(entry);
      if (name === undefined || declared.has(name)) {
        kept[id] = entry;
        continue;
      }
      dropped = true;
      diagnostics.push(
        field === 'components'
          ? {
              code: 'metadata.component.undeclared',
              severity: 'warning',
              message: `${file} describes <${name}>, which the package's Custom Elements Manifest does not declare: its enrichment is not read. Run oddkin-analyze again if the element was removed or renamed.`,
              subject: id,
            }
          : {
              code: 'metadata.example.undeclared',
              severity: 'warning',
              message: `${file} lists example ${id} for <${name}>, which the package's Custom Elements Manifest does not declare: it is not read.`,
              subject: id,
            },
      );
    }
    return dropped ? kept : undefined;
  };
  const components = keep('components', (entry) =>
    entry && typeof entry === 'object' ? tagOf((entry as { tag?: unknown }).tag) : undefined,
  );
  const examples = keep('examples', (entry) =>
    entry && typeof entry === 'object'
      ? tagOf((entry as { component?: unknown }).component)
      : undefined,
  );
  return {
    metadata:
      components || examples
        ? ({
            ...metadata,
            ...(components ? { components } : {}),
            ...(examples ? { examples } : {}),
          } as M)
        : metadata,
    diagnostics,
  };
}
