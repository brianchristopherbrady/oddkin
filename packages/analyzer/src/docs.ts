/**
 * `docs[*].updated` (metadata-and-analyzer.md §3, "Updated dates"): an authored `@updated` date,
 * or the last commit touching the page's declared source files. Never build time; pages with
 * neither are omitted. Page ids are shared with the Workbench page registry.
 */
import type { ExampleInfo } from './examples.js';
import type { ComponentInfo, Extraction, SourceLocation, SourceRef } from './extract.js';
import type { SourceHistory } from './history.js';

export interface DatedPage {
  /** Stable page id: `components/<tag>`, `foundations/<id>`. */
  readonly page: string;
  /** Library-relative files the page's facts come from. */
  readonly files: readonly string[];
  readonly authored?: { readonly value: string; readonly source: SourceLocation };
}

export interface UpdatedFact {
  readonly value: string;
  readonly provenance: 'authored' | 'extracted';
  readonly source?: SourceLocation;
}

const local = (ref: SourceRef | undefined) =>
  ref && !ref.external && !ref.package ? [ref.file] : [];

/**
 * Each registered element's page and its declared sources in this library: the class and its base
 * classes, the definition and the definitions it recomposes, template, styles, registration
 * module, explicit metadata, and examples.
 */
export function componentPages(
  extraction: Extraction,
  examples: readonly ExampleInfo[],
): DatedPage[] {
  const classes = new Map(extraction.components.map((c) => [`${c.file}#${c.name}`, c]));
  const definitions = new Map(extraction.definitions.map((d) => [d.tag, d]));
  return extraction.registrations.map((registration) => {
    const files = new Set<string>([registration.file]);
    let component: ComponentInfo | undefined = classes.get(
      `${registration.classFile}#${registration.className}`,
    );
    const authored = component?.tags['updated']?.[0];
    // `classes` holds only this library's classes: the chain ends at another package's base.
    while (component) {
      files.add(component.file);
      if (component.authored) files.add(component.authored.file);
      const base: ComponentInfo['superclass'] = component.superclass;
      component = base.file ? classes.get(`${base.file}#${base.name}`) : undefined;
    }
    for (
      let definition = registration.definition;
      definition;
      definition = definition.extends ? definitions.get(definition.extends) : undefined
    ) {
      for (const file of [
        ...local(definition.ref),
        ...local(definition.template),
        ...definition.styles.flatMap(local),
      ])
        files.add(file);
    }
    for (const example of examples)
      if (example.component === registration.tag) files.add(example.file);
    return {
      page: `components/${registration.tag}`,
      files: [...files].sort(),
      ...(authored ? { authored: { value: authored.value, source: authored.location } } : {}),
    };
  });
}

/** `docs` entries with an `updated` fact, keyed by page id in sorted order. */
export function updatedDocs(
  pages: readonly DatedPage[],
  history: SourceHistory | undefined,
): Record<string, { updated: UpdatedFact }> {
  const dates = history?.lastChanged([...new Set(pages.flatMap((p) => p.files))]);
  const docs: Record<string, { updated: UpdatedFact }> = {};
  for (const page of [...pages].sort((a, b) => (a.page < b.page ? -1 : 1))) {
    if (page.authored) {
      docs[page.page] = {
        updated: {
          value: page.authored.value,
          provenance: 'authored',
          source: page.authored.source,
        },
      };
      continue;
    }
    const latest = page.files
      .map((file) => dates?.get(file) ?? '')
      .reduce((a, b) => (b > a ? b : a), '');
    if (latest) docs[page.page] = { updated: { value: latest, provenance: 'extracted' } };
  }
  return docs;
}
