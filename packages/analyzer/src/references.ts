/**
 * Authored references (metadata-and-analyzer.md §5): names that descriptions, guidance, and
 * examples cite in code spans must exist in the published contracts. Only Oddkin-shaped spans are
 * checked; other code spans (HTML, ARIA, DOM APIs, values) are prose. Node-free and DOM-free.
 */
import type { AnalyzerDiagnostic, SourceLocation } from './extract.js';

export const UNKNOWN_REFERENCE = 'agent.guidance.unknownReference';

/** A piece of authored text and what its member-shaped references resolve against. */
export interface AuthoredText {
  readonly text: string;
  /** Tag of the element the text describes; `.prop`, `name()`, `attr="v"`, … resolve against it. */
  readonly subject?: string;
  /** Where the text lives, e.g. `odd-card --odd-card-shadow` or `example:odd-card/default guidance`. */
  readonly at: string;
  readonly source?: SourceLocation;
}

interface ElementNames {
  readonly members: Set<string>;
  readonly methods: Set<string>;
  /** Attribute name → allowed values when its type is a union of string literals. */
  readonly attributes: Map<string, readonly string[] | undefined>;
  readonly events: Set<string>;
  readonly slots: Set<string>;
  readonly parts: Set<string>;
  readonly cssProperties: Set<string>;
  readonly cssStates: Set<string>;
}

export interface ReferenceIndex {
  readonly elements: ReadonlyMap<string, ElementNames>;
  /** Tag prefixes of the indexed elements (`odd-`): only tag-shaped spans with them are checked. */
  readonly prefixes: ReadonlySet<string>;
  /** Package scopes (`@oddkin`): only import specifiers in them are checked. */
  readonly scopes: ReadonlySet<string>;
  readonly imports: (specifier: string) => boolean;
  readonly tokens: ReadonlySet<string>;
  readonly variables: ReadonlySet<string>;
  readonly recipes: ReadonlySet<string>;
  /** Published contract ids (`contract:core/scope`). */
  readonly contracts: ReadonlySet<string>;
}

export interface ReferenceSources {
  /** Published `custom-elements.json` manifests. */
  readonly manifests: readonly unknown[];
  /** Published `oddkin.metadata.json` documents (layout recipes). */
  readonly metadata?: readonly unknown[];
  /** Packages whose `exports` define the public import specifiers. */
  readonly packages?: readonly { readonly name: string; readonly exports?: unknown }[];
  /** Token ids (`color.focus.ring`) and the CSS custom properties a theme declares. */
  readonly tokens?: readonly string[];
  readonly variables?: readonly string[];
  /** Contract ids from the installed packages' `contracts.json`. */
  readonly contracts?: readonly string[];
}

type Json = Record<string, unknown>;
const list = (value: unknown): Json[] =>
  Array.isArray(value) ? value.filter((v): v is Json => !!v && typeof v === 'object') : [];
const names = (value: unknown): Set<string> =>
  new Set(list(value).flatMap((v) => (typeof v['name'] === 'string' ? [v['name']] : [])));

/** `"a" | "b"` → ['a', 'b']; anything else (boolean, string, number, mixed) → undefined. */
function literalUnion(type: unknown): readonly string[] | undefined {
  const text = (type as { text?: unknown } | undefined)?.text;
  if (typeof text !== 'string') return undefined;
  const parts = text.split('|').map((p) => p.trim());
  const values = parts.map((p) => /^"([^"]*)"$/.exec(p)?.[1]);
  return values.every((v) => v !== undefined) ? (values as string[]) : undefined;
}

const declarations = (manifest: unknown): Json[] =>
  list((manifest as { modules?: unknown })?.modules).flatMap((m) => list(m['declarations']));

export function referenceIndex(sources: ReferenceSources): ReferenceIndex {
  const elements = new Map<string, ElementNames>();
  for (const manifest of sources.manifests)
    for (const d of declarations(manifest)) {
      if (typeof d['tagName'] !== 'string') continue;
      const members = list(d['members']).filter((m) => !m['static'] && m['privacy'] !== 'private');
      elements.set(d['tagName'], {
        members: names(members),
        methods: names(members.filter((m) => m['kind'] === 'method')),
        attributes: new Map(
          list(d['attributes']).flatMap((a) =>
            typeof a['name'] === 'string' ? [[a['name'], literalUnion(a['type'])] as const] : [],
          ),
        ),
        events: names(d['events']),
        slots: names(d['slots']),
        parts: names(d['cssParts']),
        cssProperties: names(d['cssProperties']),
        cssStates: names(d['cssStates']),
      });
    }
  const packages = sources.packages ?? [];
  const entries = new Map(
    packages.map((p) => [
      p.name,
      typeof p.exports === 'string'
        ? ['.']
        : Object.keys((p.exports ?? { '.': '' }) as Record<string, unknown>),
    ]),
  );
  return {
    elements,
    prefixes: new Set([...elements.keys()].map((tag) => tag.slice(0, tag.indexOf('-') + 1))),
    scopes: new Set(packages.map((p) => p.name.split('/')[0] ?? '')),
    imports: (specifier) => {
      const name = specifier.split('/').slice(0, 2).join('/');
      const subpath = `.${specifier.slice(name.length)}`;
      return (entries.get(name) ?? []).some((key) => {
        const star = key.indexOf('*');
        return star < 0
          ? key === subpath
          : subpath.startsWith(key.slice(0, star)) && subpath.endsWith(key.slice(star + 1));
      });
    },
    tokens: new Set(sources.tokens ?? []),
    variables: new Set(sources.variables ?? []),
    contracts: new Set(sources.contracts ?? []),
    recipes: new Set(
      (sources.metadata ?? []).flatMap((m) =>
        Object.values(
          ((m as { recipes?: Record<string, { name?: unknown }> })?.recipes ?? {}) as Record<
            string,
            { name?: unknown }
          >,
        ).flatMap((r) => (typeof r.name === 'string' ? [r.name] : [])),
      ),
    ),
  };
}

const DESCRIBED = [
  ['members', 'name'],
  ['attributes', 'name'],
  ['events', 'name'],
  ['slots', 'name'],
  ['cssParts', 'name'],
  ['cssProperties', 'name'],
  ['cssStates', 'name'],
] as const;

/**
 * Authored text of a package: element and member descriptions and deprecation reasons from its
 * CEM, authored facts (`provenance: 'authored'`) from its metadata, and example texts.
 */
export function authoredTexts(
  manifest: unknown,
  metadata?: unknown,
  examples: readonly { readonly texts?: readonly AuthoredText[] }[] = [],
): AuthoredText[] {
  const out: AuthoredText[] = [];
  const add = (text: unknown, at: string, subject?: string) => {
    if (typeof text === 'string' && text.includes('`'))
      out.push({ text, at, ...(subject ? { subject } : {}) });
  };
  for (const d of declarations(manifest)) {
    const tag = typeof d['tagName'] === 'string' ? d['tagName'] : undefined;
    const owner = tag ?? String(d['name']);
    add(d['description'], owner, tag);
    add(d['deprecated'], `${owner} deprecated`, tag);
    for (const [key] of DESCRIBED)
      for (const item of list(d[key])) {
        add(item['description'], `${owner} ${String(item['name'])}`, tag);
        add(item['deprecated'], `${owner} ${String(item['name'])} deprecated`, tag);
      }
  }
  const components = (metadata as { components?: Record<string, unknown> } | undefined)?.components;
  for (const [id, component] of Object.entries(components ?? {})) {
    const tag = id.replace(/^component:/, '');
    const visit = (value: unknown, path: string): void => {
      if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}/${i}`));
      else if (value && typeof value === 'object') {
        const fact = value as Json;
        if (fact['provenance'] === 'authored' && typeof fact['value'] === 'string') {
          if (fact['value'].includes('`'))
            out.push({
              text: fact['value'],
              at: `${tag} ${path.slice(1)}`,
              subject: tag,
              ...(fact['source'] ? { source: fact['source'] as SourceLocation } : {}),
            });
        } else for (const [key, v] of Object.entries(fact)) visit(v, `${path}/${key}`);
      }
    };
    visit(component, '');
  }
  for (const example of examples) out.push(...(example.texts ?? []));
  return out;
}

const GLOBAL_ATTRIBUTE =
  /^(aria-[a-z]+|data-[\w-]+|role|id|class|style|slot|part|exportparts|title|lang|dir|hidden|inert|tabindex|autofocus|popover)$/;

/** Every code span in `texts` that names an Oddkin contract must resolve in `index`. */
export function checkReferences(
  texts: readonly AuthoredText[],
  index: ReferenceIndex,
): AnalyzerDiagnostic[] {
  const out: AnalyzerDiagnostic[] = [];
  for (const { text, subject, at, source } of texts) {
    const self = subject ? index.elements.get(subject) : undefined;
    const report = (span: string, problem: string) =>
      out.push({
        code: UNKNOWN_REFERENCE,
        severity: 'warning',
        message: `${at}: \`${span}\` ${problem}.`,
        ...(source ? { source } : {}),
        suggestion: 'Cite only names the published contracts declare, or drop the code span.',
      });
    const anyElement = (has: (e: ElementNames) => boolean) =>
      [...index.elements.values()].some(has);
    const checkOn = (element: ElementNames, tag: string, span: string, rest: string) => {
      const state = /^:state\(([\w-]+)\)$/.exec(rest)?.[1];
      if (state !== undefined && !element.cssStates.has(state))
        report(span, `names a custom state ${tag} does not declare`);
      const part = /^::part\(([\w-]+)\)$/.exec(rest)?.[1];
      if (part !== undefined && !element.parts.has(part))
        report(span, `names a part ${tag} does not declare`);
      for (const [, name = '', value] of rest.matchAll(/\s([a-z][\w-]*)(?:="([^"]*)")?/g))
        checkAttribute(element, tag, span, name, value);
    };
    const checkAttribute = (
      element: ElementNames,
      tag: string,
      span: string,
      name: string,
      value: string | undefined,
    ) => {
      if (element.attributes.has(name)) {
        const allowed = element.attributes.get(name);
        if (value !== undefined && allowed && !allowed.includes(value))
          report(span, `gives ${tag} [${name}] a value outside ${allowed.join(', ')}`);
      } else if (name === 'slot') {
        // Placement on a child, resolved against the element that hosts it.
        if (value !== undefined && !element.slots.has(value))
          report(span, `names a slot ${tag} does not declare`);
      } else if (!GLOBAL_ATTRIBUTE.test(name))
        report(span, `names an attribute ${tag} does not declare`);
    };

    for (const match of text.matchAll(/`([^`]+)`/g)) {
      const span = (match[1] ?? '').trim();
      const after = text.slice((match.index ?? 0) + (match[0] ?? '').length);

      // Contextual: "`side-nav` layout recipe", "`odd-model-change` event". Native events have no
      // hyphen (`submit`, `input`), Oddkin events always do.
      if (/^\s+(layout\s+)?recipe\b/.test(after) && /^[a-z]+(-[a-z0-9]+)*$/.test(span)) {
        if (!index.recipes.has(span)) report(span, 'is not a known layout recipe');
        continue;
      }
      if (/^\s+events?\b/.test(after) && /^[a-z]+(-[a-z0-9]+)+$/.test(span)) {
        if (!(self?.events.has(span) ?? anyElement((e) => e.events.has(span))))
          report(span, subject ? `is not an event of ${subject}` : 'is not a known event');
        continue;
      }

      const scope = /^(@[a-z0-9-]+)\/[a-z0-9-]+/.exec(span)?.[1];
      if (/^contract:[a-z][a-z0-9-]*\/[a-z0-9-]+$/.test(span)) {
        if (!index.contracts.has(span)) report(span, 'is not a published contract');
        continue;
      }
      if (scope && index.scopes.has(scope)) {
        if (!/\s/.test(span) && !index.imports(span)) report(span, 'is not a public entry point');
        continue;
      }
      if (/^--[a-z0-9-]+$/.test(span)) {
        if (!index.variables.has(span) && !anyElement((e) => e.cssProperties.has(span)))
          report(span, 'is neither a token variable nor a declared CSS property');
        continue;
      }
      const tagged = /^<?([a-z][a-z0-9]*-[a-z0-9-]*)(.*?)>?$/s.exec(span);
      const tag = tagged?.[1];
      if (tag && index.prefixes.has(tag.slice(0, tag.indexOf('-') + 1))) {
        const element = index.elements.get(tag);
        if (element) checkOn(element, tag, span, tagged[2] ?? '');
        else if (
          !(tagged[2] ?? '') &&
          !(self?.events.has(tag) || anyElement((e) => e.events.has(tag)))
        )
          report(span, 'is not a known element or event');
        else if (!element && (tagged[2] ?? '')) report(span, 'is not a known element');
        continue;
      }
      if (!self || !subject) {
        if (/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(span) && isTokenPath(span, index))
          if (!index.tokens.has(span)) report(span, 'is not a token');
        continue;
      }
      const member = /^\.([A-Za-z_$][\w$]*)/.exec(span)?.[1];
      if (member !== undefined) {
        if (!self.members.has(member)) report(span, `is not a property or method of ${subject}`);
        continue;
      }
      const method = /^([A-Za-z_$][\w$]*)\([^()]*\)$/.exec(span)?.[1];
      if (method !== undefined) {
        if (!self.methods.has(method)) report(span, `is not a method of ${subject}`);
        continue;
      }
      const attribute = /^([a-z][a-z0-9-]*)="([^"]*)"$/.exec(span);
      if (attribute) {
        checkAttribute(self, subject, span, attribute[1] ?? '', attribute[2]);
        continue;
      }
      const state = /^:state\(([\w-]+)\)$/.test(span) || /^::part\(([\w-]+)\)$/.test(span);
      if (state) {
        checkOn(self, subject, span, span);
        continue;
      }
      if (
        /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(span) &&
        !self.members.has(span.split('.')[0] ?? '') &&
        isTokenPath(span, index) &&
        !index.tokens.has(span)
      )
        report(span, 'is not a token');
    }
  }
  return out;
}

/** A dotted span whose first segment starts some token id (`elevation.md`, not `detail.action`). */
const isTokenPath = (span: string, index: ReferenceIndex): boolean => {
  const group = `${span.split('.')[0]}.`;
  return [...index.tokens].some((token) => token.startsWith(group));
};
