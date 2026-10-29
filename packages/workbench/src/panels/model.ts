/**
 * DOM-free projection of a component page's published facts into the detail page's API table,
 * presets, generated snippets, and share links (workbench-pages.md §7, workbench.md §4).
 * Nothing here is inferred beyond the manifest: a type the table cannot edit generically is
 * labelled "requires fixture", never guessed.
 */
import type { ComponentPageData, JsonObject } from '../data/types.js';
import {
  isCustomPropertyName,
  isJsonValue,
  type FrameSettings,
  type JsonValue,
} from '../protocol/index.js';

export type ControlKind =
  'boolean' | 'enum' | 'string' | 'number' | 'json' | 'readonly' | 'fixture';

/** How a value reaches the element: a property assignment or a serialized attribute. */
export type WriteMode = 'property' | 'attribute';

export interface ApiRow {
  /** Stable id shared with metadata: `property:<tag>#<name>` (attribute-only rows use the attribute). */
  readonly id: string;
  /** Property name; undefined for an attribute without a property. */
  readonly property?: string;
  readonly attribute?: string;
  readonly reflects: boolean;
  readonly type: string;
  readonly control: ControlKind;
  /** Allowed values of a literal union, in declared order. */
  readonly values?: readonly string[];
  /** The union includes `null`. */
  readonly nullable: boolean;
  /** The declared default as written in the manifest, or undefined when unknown. */
  readonly default?: string;
  readonly description?: string;
  /** The library declares the property as property-only (no attribute by design). */
  readonly propertyOnly: boolean;
}

export interface NamedEntry {
  readonly name: string;
  readonly description?: string;
  /** The CEM type text, or a CSS custom property's `syntax`. */
  readonly type?: string;
  /** The CEM `default` (CSS custom properties). */
  readonly default?: string;
}

export interface ComponentFacts {
  readonly rows: readonly ApiRow[];
  readonly events: readonly NamedEntry[];
  readonly slots: readonly NamedEntry[];
  readonly methods: readonly NamedEntry[];
  readonly parts: readonly NamedEntry[];
  readonly cssProperties: readonly NamedEntry[];
  readonly cssStates: readonly NamedEntry[];
  /** Declared property ↔ event pairs that keep a control in sync (`value` + `input`). */
  readonly syncPairs: readonly { readonly property: string; readonly event: string }[];
}

/** The configuration a preview shows; also what share links and snippets encode. */
export interface PreviewState {
  /** Authored example the state started from (`default` when none was chosen). */
  readonly preset: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly properties: Readonly<Record<string, JsonValue>>;
  readonly slots: Readonly<Record<string, string>>;
  /** CSS custom property values on the element, by name (`--odd-button-background`). */
  readonly styles?: Readonly<Record<string, string>>;
}

export interface PresetEntry {
  readonly name: string;
  readonly id: string;
  readonly label: string;
  /** Authored values; undefined when the example's values were not published. */
  readonly state?: PreviewState;
  readonly preset: boolean;
  readonly requiresFixture: boolean;
  readonly guidance?: string;
  readonly incorrect?: { readonly explanation?: string; readonly correct?: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const list = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** Split a type at top-level `|`, ignoring separators inside brackets, braces, and quotes. */
export function unionMembers(type: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const char of type) {
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'" || char === '`') quote = char;
    else if ('([{<'.includes(char)) depth++;
    else if (')]}>'.includes(char)) depth--;
    else if (char === '|' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const LITERAL = /^(["'])(.*)\1$/;

/** The control a declared type supports (workbench.md §4); unknown shapes require a fixture. */
export function classifyType(type: string): {
  control: ControlKind;
  values?: string[];
  nullable: boolean;
} {
  const members = unionMembers(type);
  const nullable = members.includes('null');
  const rest = members.filter((m) => m !== 'null' && m !== 'undefined');
  if (!rest.length) return { control: 'fixture', nullable };
  const literals = rest.map((m) => LITERAL.exec(m)?.[2]);
  if (literals.every((v) => v !== undefined))
    return { control: 'enum', values: literals as string[], nullable };
  if (rest.length === 1) {
    const only = rest[0] as string;
    if (only === 'boolean') return { control: 'boolean', nullable };
    if (only === 'string') return { control: 'string', nullable };
    if (only === 'number') return { control: 'number', nullable };
    if (/^(readonly\s+)?(string|number|boolean)\[\]$/.test(only))
      return { control: 'json', nullable };
  }
  return { control: 'fixture', nullable };
}

/** Columns and controls of the editable API table, from the CEM declaration and enrichment. */
export function componentFacts(page: ComponentPageData): ComponentFacts {
  const declaration = page.declaration;
  const enrichment = page.enrichment ?? {};
  const propertyOnly = new Set(
    list(enrichment['propertyOnly']).flatMap((entry) => {
      const id = text(entry['property']);
      return id ? [id.slice(id.indexOf('#') + 1)] : [];
    }),
  );
  const rows: ApiRow[] = [];
  const covered = new Set<string>();
  for (const member of list(declaration['members'])) {
    if (member['kind'] !== 'field' || member['static'] === true) continue;
    if (member['privacy'] === 'private' || member['privacy'] === 'protected') continue;
    const name = text(member['name']);
    if (!name || name.startsWith('#') || name.startsWith('_')) continue;
    const type = text(isRecord(member['type']) ? member['type']['text'] : undefined) ?? 'unknown';
    const attribute = text(member['attribute']);
    if (attribute) covered.add(attribute);
    const classified = classifyType(type);
    const readonly = member['readonly'] === true;
    const defaultValue = text(member['default']);
    const description = text(member['description']);
    rows.push({
      id: `property:${page.tag}#${name}`,
      property: name,
      ...(attribute ? { attribute } : {}),
      reflects: member['reflects'] === true,
      type,
      control: readonly ? 'readonly' : classified.control,
      ...(classified.values ? { values: classified.values } : {}),
      nullable: classified.nullable,
      ...(defaultValue ? { default: defaultValue } : {}),
      ...(description ? { description } : {}),
      propertyOnly: propertyOnly.has(name),
    });
  }
  for (const attr of list(declaration['attributes'])) {
    const name = text(attr['name']);
    if (!name || covered.has(name) || text(attr['fieldName'])) continue;
    const type = text(isRecord(attr['type']) ? attr['type']['text'] : undefined) ?? 'string';
    const classified = classifyType(type);
    const defaultValue = text(attr['default']);
    const description = text(attr['description']);
    rows.push({
      id: `property:${page.tag}#${name}`,
      attribute: name,
      reflects: false,
      type,
      // An attribute is always a string or a boolean presence.
      control:
        classified.control === 'boolean' || classified.control === 'enum'
          ? classified.control
          : 'string',
      ...(classified.values ? { values: classified.values } : {}),
      nullable: false,
      ...(defaultValue ? { default: defaultValue } : {}),
      ...(description ? { description } : {}),
      propertyOnly: false,
    });
  }
  const named = (value: unknown): NamedEntry[] =>
    list(value).flatMap((entry) => {
      const name = typeof entry['name'] === 'string' ? entry['name'] : undefined;
      if (name === undefined) return [];
      const description = text(entry['description']);
      const type =
        text(isRecord(entry['type']) ? entry['type']['text'] : undefined) ?? text(entry['syntax']);
      const fallback = text(entry['default']);
      return [
        {
          name,
          ...(description ? { description } : {}),
          ...(type ? { type } : {}),
          ...(fallback ? { default: fallback } : {}),
        },
      ];
    });
  const methods = named(
    list(declaration['members']).filter(
      (m) =>
        m['kind'] === 'method' &&
        m['static'] !== true &&
        m['privacy'] !== 'private' &&
        m['privacy'] !== 'protected',
    ),
  );
  const syncPairs = list(enrichment['syncPairs']).flatMap((pair) => {
    const property = text(pair['property']);
    const event = text(pair['event']);
    return property && event ? [{ property, event }] : [];
  });
  return {
    rows,
    events: named(declaration['events']),
    slots: named(declaration['slots']),
    methods,
    parts: named(declaration['cssParts']),
    cssProperties: named(declaration['cssProperties']),
    cssStates: named(declaration['cssStates']),
    syncPairs,
  };
}

/** The write a row's control uses by default: the attribute when one exists, unless property-only. */
export function defaultWriteMode(row: ApiRow): WriteMode {
  if (!row.property) return 'attribute';
  if (!row.attribute || row.propertyOnly || row.control === 'json') return 'property';
  return 'attribute';
}

const EMPTY_STATE: PreviewState = { preset: 'default', attributes: {}, properties: {}, slots: {} };

function stateFrom(name: string, values: Record<string, unknown>): PreviewState | undefined {
  const props = isRecord(values['props']) ? values['props'] : {};
  const attributes = isRecord(values['attributes']) ? values['attributes'] : {};
  const slots = isRecord(values['slots']) ? values['slots'] : {};
  if (!isJsonValue(props)) return undefined;
  const stringAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes))
    if (typeof value === 'string') stringAttributes[key] = value;
  const stringSlots: Record<string, string> = {};
  for (const [key, value] of Object.entries(slots))
    if (typeof value === 'string') stringSlots[key === 'default' ? '' : key] = value;
  return {
    preset: name,
    attributes: stringAttributes,
    properties: props as Record<string, JsonValue>,
    slots: stringSlots,
  };
}

/**
 * Presets from authored examples (`defineExamples`). Values come from the published example
 * definition (`definition`); without it the example is listed but cannot be applied.
 */
export function presets(page: ComponentPageData): PresetEntry[] {
  return page.examples.flatMap((example: JsonObject): PresetEntry[] => {
    const name = text(example['name']);
    const id = text(example['id']);
    if (!name || !id) return [];
    const definition = isRecord(example['definition']) ? example['definition'] : undefined;
    const requiresFixture = definition?.['hasFixture'] === true;
    const state = definition && !requiresFixture ? stateFrom(name, definition) : undefined;
    const incorrect = isRecord(definition?.['incorrect'])
      ? (definition['incorrect'] as Record<string, unknown>)
      : isRecord(example['incorrect'])
        ? example['incorrect']
        : undefined;
    const label = text(definition?.['label']) ?? name;
    const guidance = text(definition?.['guidance']);
    const explanation = text(incorrect?.['explanation']);
    const correct = text(incorrect?.['correct']);
    return [
      {
        name,
        id,
        label,
        ...(state ? { state } : {}),
        preset: definition?.['preset'] === true,
        requiresFixture,
        ...(guidance ? { guidance } : {}),
        ...(incorrect
          ? {
              incorrect: {
                ...(explanation ? { explanation } : {}),
                ...(correct ? { correct } : {}),
              },
            }
          : {}),
      },
    ];
  });
}

/** The state a page starts from: its `default` example when published, otherwise nothing set. */
export function initialState(page: ComponentPageData): PreviewState {
  const entries = presets(page);
  const first =
    entries.find((p) => p.name === 'default' && p.state) ??
    entries.find((p) => p.preset && !p.incorrect && p.state);
  return first?.state ?? EMPTY_STATE;
}

/** Authored metadata values (`{ value, provenance }` records or plain strings) as text. */
export const authoredValues = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((entry) =>
        typeof entry === 'string'
          ? [entry]
          : isRecord(entry) && typeof entry['value'] === 'string'
            ? [entry['value']]
            : [],
      )
    : [];

/** Intended use: authored content (`oddkin.docs.ts`) over the enrichment's `@useFor`/`@notFor`. */
export function intendedUse(page: ComponentPageData): {
  useFor: readonly string[];
  notFor: readonly string[];
} {
  return {
    useFor: page.authored?.useFor ?? authoredValues(page.enrichment?.['useFor']),
    notFor: page.authored?.notFor ?? authoredValues(page.enrichment?.['notFor']),
  };
}

/** An explained mistake and the correct example it names (by name or example id). */
export interface UsagePair {
  readonly incorrect: PresetEntry;
  readonly correct?: PresetEntry;
}

export function usagePairs(page: ComponentPageData): UsagePair[] {
  const entries = presets(page);
  return entries.flatMap((incorrect) => {
    if (!incorrect.incorrect) return [];
    const ref = incorrect.incorrect.correct;
    const correct = ref
      ? entries.find((e) => !e.incorrect && (e.name === ref || e.id === ref))
      : undefined;
    return [{ incorrect, ...(correct ? { correct } : {}) }];
  });
}

/**
 * How a detail-page item is shown: with content (`documented`), as declared empty (`none`: the
 * component has none of these), or labelled as missing (`missing`: "Not documented", naming the
 * input that would supply it). A page has no unlabelled gap when every item is one of these.
 */
export type CoverageState = 'documented' | 'none' | 'missing';

export interface CoverageItem {
  /** Stable `<section>/<item>` id; the panel marks the item's element with `data-coverage`. */
  readonly id: string;
  readonly section: string;
  readonly state: CoverageState;
  /** What the item is, for labels shown without a heading (`Preview: not documented…`). */
  readonly subject?: string;
  /** The `none` label. */
  readonly empty?: string;
  /** The `missing` label's source: the input that would supply the item. */
  readonly source?: string;
  /** Entries listed without a description; their rows say "Not documented". */
  readonly undocumented?: readonly string[];
}

const EXAMPLES_SOURCE = 'an example set (defineExamples)';
const REGISTRATION_SOURCE = 'the registration entry in oddkin.metadata.json';

/**
 * Every item a component's detail page shows, in page order, and how it is shown. The panel
 * renders from this, and the coverage check walks it for every component (workbench-pages.md §7).
 */
export function pageCoverage(page: ComponentPageData): CoverageItem[] {
  const facts = componentFacts(page);
  const entries = presets(page);
  const { useFor, notFor } = intendedUse(page);
  const enrichment = page.enrichment ?? {};
  const registered = typeof enrichment['registration'] === 'string';
  const description = text(page.declaration['description']);
  const items: CoverageItem[] = [];
  const item = (
    id: string,
    state: CoverageState,
    extra: Omit<CoverageItem, 'id' | 'section' | 'state'> = {},
    section = id.slice(0, id.indexOf('/')),
  ) => items.push({ id, section, state, ...extra });
  const documented = (id: string, present: boolean, source: string, subject?: string) =>
    item(id, present ? 'documented' : 'missing', {
      ...(present ? {} : { source }),
      ...(subject ? { subject } : {}),
    });
  const declared = (
    id: string,
    list: readonly (NamedEntry | ApiRow)[],
    empty: string,
    section?: string,
  ) => {
    const undocumented = list
      .filter((entry) => !entry.description)
      .map((entry) =>
        'name' in entry ? entry.name || '(default)' : (entry.property ?? entry.attribute ?? ''),
      );
    item(
      id,
      list.length ? 'documented' : 'none',
      {
        ...(list.length ? {} : { empty }),
        ...(undocumented.length ? { undocumented } : {}),
      },
      section,
    );
  };

  documented('overview/description', Boolean(description), 'a JSDoc description on the class');
  documented(
    'interactive-example/presets',
    entries.some((p) => p.state && !p.incorrect),
    EXAMPLES_SOURCE,
    'Presets',
  );
  documented('interactive-example/preview', registered, REGISTRATION_SOURCE, 'Preview');
  // The editable controls render in the interactive example (its "Controls and API").
  declared(
    'api/properties',
    facts.rows,
    'No properties or attributes are declared.',
    'interactive-example',
  );
  declared('api/slots', facts.slots, 'No slots are declared.', 'interactive-example');
  declared(
    'api/css-properties',
    facts.cssProperties,
    'No CSS custom properties are declared.',
    'interactive-example',
  );
  item('source/module', 'documented');
  documented('source/register', registered, REGISTRATION_SOURCE);
  documented('examples/examples', entries.length > 0, EXAMPLES_SOURCE);
  declared('api/events', facts.events, 'None declared.');
  declared('api/parts', facts.parts, 'None declared.');
  declared('api/methods', facts.methods, 'None declared.');
  declared('api/css-states', facts.cssStates, 'None declared.');
  const mappings = list(enrichment['styleMappings']);
  item('tokens/style-mappings', mappings.length ? 'documented' : 'none', {
    ...(mappings.length ? {} : { empty: 'No style mappings are declared.' }),
  });
  const reads = list(enrichment['tokenReads']);
  item('tokens/token-reads', reads.length ? 'documented' : 'none', {
    ...(reads.length ? {} : { empty: 'No token reads are declared.' }),
  });
  documented(
    'behavior-and-accessibility/a11y',
    authoredValues(enrichment['a11y']).length > 0,
    '@a11y',
  );
  documented(
    'behavior-and-accessibility/keyboard',
    authoredValues(enrichment['keyboard']).length > 0,
    '@keyboard',
  );
  if (page.authored?.guidance) item('guidance/authored', 'documented');
  documented('guidance/use-for', useFor.length > 0, '@useFor');
  documented('guidance/not-for', notFor.length > 0, '@notFor');
  documented(
    'guidance/usage-pairs',
    entries.some((p) => p.incorrect),
    'an incorrect example that names its correct one (`incorrect` in defineExamples)',
  );
  const limitations = authoredValues(enrichment['limitations']);
  item('known-limitations/limitations', limitations.length ? 'documented' : 'none', {
    ...(limitations.length ? {} : { empty: 'None documented.' }),
  });
  return items;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Plain HTML and JavaScript that reproduce a state: the public registration entry, attributes,
 * property assignments by script, slot content, declared-event listeners, and preview scopes.
 */
export function snippet(
  page: ComponentPageData,
  state: PreviewState,
  options: { readonly events?: readonly string[]; readonly settings?: FrameSettings } = {},
): string {
  const registration = text(page.enrichment?.['registration']);
  const attrs = Object.entries(state.attributes).map(([name, value]) =>
    value === '' ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`,
  );
  const scope: string[] = [];
  if (options.settings?.mode) scope.push(` data-odd-mode="${options.settings.mode}"`);
  if (options.settings?.direction) scope.push(` dir="${options.settings.direction}"`);
  const children = Object.entries(state.slots).map(([name, value]) =>
    name
      ? `  <span slot="${escapeHtml(name)}">${escapeHtml(value)}</span>`
      : `  ${escapeHtml(value)}`,
  );
  const element = children.length
    ? `<${page.tag}${attrs.join('')}>\n${children.join('\n')}\n</${page.tag}>`
    : `<${page.tag}${attrs.join('')}></${page.tag}>`;
  const markup = scope.length
    ? `<div${scope.join('')}>\n${element
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n')}\n</div>`
    : element;
  const lines: string[] = ['<script type="module">'];
  if (registration) lines.push(`  import '${registration}';`);
  else
    lines.push(
      `  // No registration entry is published for <${page.tag}>; import its define module.`,
    );
  const properties = Object.entries(state.properties);
  const styles = Object.entries(state.styles ?? {});
  const events = options.events ?? componentFacts(page).events.map((e) => e.name);
  if (properties.length || styles.length || events.length) {
    lines.push('', `  const element = document.querySelector('${page.tag}');`);
    for (const [name, value] of properties)
      lines.push(`  element.${name} = ${JSON.stringify(value)};`);
    for (const [name, value] of styles)
      lines.push(`  element.style.setProperty(${JSON.stringify(name)}, ${JSON.stringify(value)});`);
    for (const name of events)
      lines.push(
        `  element.addEventListener('${name}', (event) => console.log(event.type, event.detail));`,
      );
  }
  lines.push('</script>');
  return `${lines.join('\n')}\n${markup}\n`;
}

export const SHARE_VERSION = 1;
export const SHARE_PARAM = 'preview';
/** Narrowest numeric preview width a share link carries (share-payload.v1). */
export const MIN_SHARE_WIDTH = 160;
export const MAX_SHARE_WIDTH = 4096;

/** Preview settings in a share link (`preview` in share-payload.v1). */
export interface SharePreview {
  readonly mode?: 'light' | 'dark';
  readonly direction?: 'ltr' | 'rtl';
  readonly width?: number | 'fill';
  readonly sameAsSite?: boolean;
}

/** The decoded form of a component share link: docs/schemas/share-payload.v1.schema.json. */
export interface SharePayload {
  readonly v: typeof SHARE_VERSION;
  readonly kind: 'component';
  readonly component: string;
  readonly preset?: string;
  readonly props?: Readonly<Record<string, JsonValue>>;
  readonly attributes?: Readonly<Record<string, string>>;
  /** Slot text by slot name; the default slot is `default`. */
  readonly slots?: Readonly<Record<string, string>>;
  /** CSS custom property values by name. */
  readonly styles?: Readonly<Record<string, string>>;
  readonly preview?: SharePreview;
}

const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
};

/** The share payload for a component's preview state. */
export function sharePayload(
  tag: string,
  state: PreviewState,
  preview?: SharePreview,
): SharePayload {
  const slots: Record<string, string> = {};
  for (const [name, text] of Object.entries(state.slots)) slots[name || 'default'] = text;
  return {
    v: SHARE_VERSION,
    kind: 'component',
    component: tag,
    preset: state.preset,
    ...(Object.keys(state.properties).length ? { props: state.properties } : {}),
    ...(Object.keys(state.attributes).length ? { attributes: state.attributes } : {}),
    ...(Object.keys(slots).length ? { slots } : {}),
    ...(Object.keys(state.styles ?? {}).length ? { styles: state.styles } : {}),
    ...(preview ? { preview } : {}),
  };
}

export function encodeShare(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decode and validate a share link against the page's contract. Names the component does not
 * declare are dropped and reported, so a stale link never writes undeclared properties.
 */
export function decodeShare(
  page: ComponentPageData,
  encoded: string,
): { state?: PreviewState; preview?: SharePreview; problems: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(fromBase64Url(encoded));
  } catch {
    return { problems: ['The preview link is not valid.'] };
  }
  if (!isRecord(value) || value['v'] !== SHARE_VERSION || value['kind'] !== 'component')
    return { problems: ['The preview link uses an unsupported version.'] };
  if (value['component'] !== page.tag)
    return { problems: ['The preview link is for another component.'] };
  const facts = componentFacts(page);
  const properties = new Set(
    facts.rows.flatMap((r) =>
      r.property && r.control !== 'readonly' && r.control !== 'fixture' ? [r.property] : [],
    ),
  );
  const attributes = new Set(facts.rows.flatMap((r) => (r.attribute ? [r.attribute] : [])));
  const slots = new Set(facts.slots.map((s) => s.name || 'default'));
  const cssProperties = new Set(
    facts.cssProperties.map((p) => p.name).filter((name) => isCustomPropertyName(name)),
  );
  const problems: string[] = [];
  const pick = <T>(
    source: unknown,
    allowed: Set<string>,
    check: (v: unknown) => v is T,
    kind: string,
  ): Record<string, T> => {
    const out: Record<string, T> = {};
    if (!isRecord(source)) return out;
    for (const [key, entry] of Object.entries(source)) {
      if (!allowed.has(key) || !check(entry)) problems.push(`Ignored ${kind} "${key}".`);
      else out[key] = entry;
    }
    return out;
  };
  const isString = (v: unknown): v is string => typeof v === 'string';
  const slotText: Record<string, string> = {};
  for (const [name, text] of Object.entries(pick(value['slots'], slots, isString, 'slot')))
    slotText[name === 'default' ? '' : name] = text;
  const preview = isRecord(value['preview']) ? sanitizePreview(value['preview']) : undefined;
  const styles = pick(value['styles'], cssProperties, isString, 'CSS custom property');
  return {
    state: {
      preset: typeof value['preset'] === 'string' ? value['preset'] : 'default',
      attributes: pick(value['attributes'], attributes, isString, 'attribute'),
      properties: pick(value['props'], properties, isJsonValue, 'property'),
      slots: slotText,
      ...(Object.keys(styles).length ? { styles } : {}),
    },
    ...(preview ? { preview } : {}),
    problems,
  };
}

function sanitizePreview(preview: Record<string, unknown>): SharePreview {
  const out: { -readonly [K in keyof SharePreview]: SharePreview[K] } = {};
  if (preview['mode'] === 'light' || preview['mode'] === 'dark') out.mode = preview['mode'];
  if (preview['direction'] === 'ltr' || preview['direction'] === 'rtl')
    out.direction = preview['direction'];
  const width = preview['width'];
  if (width === 'fill') out.width = 'fill';
  else if (
    typeof width === 'number' &&
    Number.isInteger(width) &&
    width >= MIN_SHARE_WIDTH &&
    width <= MAX_SHARE_WIDTH
  )
    out.width = width;
  if (preview['sameAsSite'] === true) out.sameAsSite = true;
  return out;
}
