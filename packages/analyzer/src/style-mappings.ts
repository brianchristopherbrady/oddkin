/**
 * Style mappings: which public option or state sets which CSS property of which part to which
 * token, read from a component's CSS text. A mapping is the declaration that wins the cascade
 * (`!important`, layer, specificity, order) for a part, a stated condition, and a property. A
 * part's property is left unmapped when any rule that may set it states a condition outside the
 * grammar below: unknown, never guessed. Contract: metadata-and-analyzer.md §3 ("Style mappings").
 */

/** CSS text with each token reference written as `token(<name>)`, other substitutions as `unknown()`. */
export type TokenCss = string;

export interface StyleMapping {
  /** `default`, `appearance="primary"`, `appearance="primary" (enabled, hover)`, `(disabled)`, … */
  readonly when: string;
  /** The part the declaration styles; absent for the host. */
  readonly part?: string;
  readonly cssProperty: string;
  readonly token: string;
  readonly provenance: 'extracted';
}

/** Which of a component's parts each tag and class selects in its template. */
export interface PartSelectors {
  readonly tags: ReadonlyMap<string, readonly string[]>;
  readonly classes: ReadonlyMap<string, readonly string[]>;
  /** Every part the template renders. */
  readonly all: readonly string[];
  /** Parts on elements whose class list is computed: any class selector may match them. */
  readonly computedClass: readonly string[];
}

/** What one selector styles; the part `undefined` is the host. */
export interface Selection {
  /** Parts styled when `when` holds. */
  readonly matches: readonly (string | undefined)[];
  readonly when: string;
  /** `b * 100 + c`; the grammar has no id selectors. */
  readonly specificity: number;
  /** Parts the selector may style under a condition this grammar does not read. */
  readonly unread: readonly (string | undefined)[];
}

// States a compound may add after its element; each is one pseudo-class or attribute selector.
const STATES: readonly (readonly [string, string])[] = [
  [":not([aria-disabled='true'])", 'enabled'],
  [':enabled', 'enabled'],
  [':disabled', 'disabled'],
  [':hover', 'hover'],
  [':active', 'active'],
  [':focus-visible', 'focus-visible'],
];
const ARIA = /^\[aria-([\w-]+)=(?:'([^']*)'|"([^"]*)")\]/;
const HOST = /^:host(?:\(\[([\w-]+)(?:=(?:'([^']*)'|"([^"]*)"))?\]\))?$/;
const ELEMENT = /^(?:[a-zA-Z][\w-]*|\.[\w-]+|\*)/;
const CONDITION = /^@(?:media|supports|container)\b/;
// At-rules whose contents are not an element's steady-state styles.
const IGNORED =
  /^@(?:keyframes|font-face|property|counter-style|font-feature-values|page|starting-style)\b/;
const NONE: Selection = { matches: [], when: 'default', specificity: 0, unread: [] };

/** Split at top-level separator characters (outside parentheses, brackets, and strings). */
function splitTop(text: string, separators: string): string[] {
  const pieces: string[] = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (const c of text) {
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (!depth && separators.includes(c)) {
      pieces.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  pieces.push(current);
  return pieces;
}

/** `appearance="primary"` for `:host([appearance='primary'])`, `full-width` for `:host([full-width])`. */
function hostWhen(host: RegExpExecArray): string {
  const value = host[2] ?? host[3];
  return !host[1] ? '' : value === undefined ? host[1] : `${host[1]}="${value}"`;
}

/** The states after a compound's element; `undefined` when one is outside the grammar. */
function statesOf(text: string): string[] | undefined {
  const states: string[] = [];
  while (text) {
    const known = STATES.find(([key]) => text.startsWith(key));
    const aria = ARIA.exec(text);
    if (known) {
      states.push(known[1]!);
      text = text.slice(known[0]!.length);
    } else if (aria) {
      const value = aria[2] ?? aria[3];
      states.push(value === 'true' ? aria[1]! : `${aria[1]}="${value}"`);
      text = text.slice(aria[0].length);
    } else return undefined;
  }
  return states;
}

/**
 * What a selector styles and when: `:host` with at most one attribute, or a part's tag or class
 * (optionally after `:host…` and a space) followed by the states above. Any other combinator,
 * pseudo-class, or attribute leaves the condition unread. Pseudo-elements style no part.
 */
export function selectionOf(selector: string, parts: PartSelectors): Selection {
  const compounds = splitTop(selector.trim(), ' \t\r\n>+~').filter(Boolean);
  const last = compounds.at(-1);
  if (!last || last.includes('::')) return NONE;
  if (compounds.length === 1 && last.startsWith(':host')) {
    const host = HOST.exec(last);
    return host
      ? {
          ...NONE,
          matches: [undefined],
          when: hostWhen(host) || 'default',
          specificity: host[1] ? 200 : 100,
        }
      : { ...NONE, unread: [undefined] };
  }
  const element = ELEMENT.exec(last)?.[0];
  const isClass = !!element?.startsWith('.');
  const universal = !element || element === '*';
  const named = universal
    ? []
    : ((isClass ? parts.classes.get(element.slice(1)) : parts.tags.get(element.toLowerCase())) ??
      []);
  const maybe = universal ? parts.all : isClass ? parts.computedClass : [];
  const host =
    compounds.length === 2 && splitTop(selector, '>+~').length === 1
      ? HOST.exec(compounds[0]!)
      : null;
  const states = universal ? undefined : statesOf(last.slice(element.length));
  if (!states || (compounds.length > 1 && !host)) return { ...NONE, unread: [...named, ...maybe] };
  const stated = [...new Set(states)].sort();
  const when = [host ? hostWhen(host) : '', stated.length ? `(${stated.join(', ')})` : '']
    .filter(Boolean)
    .join(' ');
  return {
    matches: named,
    when: when || 'default',
    specificity: (host ? (host[1] ? 200 : 100) : 0) + (isClass ? 100 : 1) + states.length * 100,
    unread: maybe,
  };
}

interface Rule {
  readonly prelude: string;
  readonly body: string;
  /** Preludes of the at-rules around it, outermost first. */
  readonly context: readonly string[];
}

/** Innermost blocks with their at-rule context; `undefined` when style rules nest (not read). */
function rulesOf(text: string): Rule[] | undefined {
  const rules: Rule[] = [];
  const open: { prelude: string; start: number; nested: boolean }[] = [];
  let boundary = 0;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') {
      const parent = open.at(-1);
      if (parent && !parent.prelude.startsWith('@')) return undefined;
      if (parent) parent.nested = true;
      open.push({ prelude: text.slice(boundary, i).trim(), start: i + 1, nested: false });
      boundary = i + 1;
    } else if (c === '}') {
      const block = open.pop();
      if (block && !block.nested)
        rules.push({
          prelude: block.prelude,
          body: text.slice(block.start, i),
          context: open.map((b) => b.prelude),
        });
      boundary = i + 1;
    } else if (c === ';') boundary = i + 1;
  }
  return rules;
}

/** Layer names in order of first appearance, from `@layer` statements and blocks. */
function layerOrder(text: string): string[] {
  const names: string[] = [];
  for (const [, list] of text.matchAll(/@layer\s+([^{;]+)/g))
    for (const name of list!.split(',').map((n) => n.trim()))
      if (name && !names.includes(name)) names.push(name);
  return names;
}

/** A rule's media, support, and container conditions and its layer; `undefined` when unread. */
function contextOf(
  context: readonly string[],
): { conditions: string[]; layer?: string } | 'ignored' | undefined {
  const conditions: string[] = [];
  let layer: string | undefined;
  for (const prelude of context) {
    if (IGNORED.test(prelude)) return 'ignored';
    if (CONDITION.test(prelude)) conditions.push(prelude.replace(/\s+/g, ' '));
    else if (/^@layer\s+[\w.-]+$/.test(prelude) && layer === undefined)
      layer = prelude.slice('@layer'.length).trim();
    else return undefined;
  }
  return { conditions, ...(layer === undefined ? {} : { layer }) };
}

/** The tokens read by each declaration that wins for a part, a condition, and a property. */
export function styleMappingsOf(css: TokenCss, parts: PartSelectors): StyleMapping[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = rulesOf(text);
  if (!rules) return [];
  const layers = layerOrder(text);
  // Normal declarations: unlayered over later layers over earlier ones; `!important` reverses.
  const precedence = (important: boolean, layer: string | undefined, specificity: number) => {
    const index = layer === undefined ? layers.length : layers.indexOf(layer);
    return (important ? 2e9 + (layers.length - index) * 1e6 : index * 1e6) + specificity;
  };
  type Winner = {
    part?: string;
    when: string;
    cssProperty: string;
    rank: number;
    tokens: string[];
  };
  const winners = new Map<string, Winner>();
  const unread = new Set<string>();
  for (const rule of rules) {
    // A computed selector or condition could style anything.
    if ([rule.prelude, ...rule.context].some((p) => p.includes('unknown()'))) return [];
    const context = contextOf(rule.context);
    if (context === 'ignored' || rule.prelude.startsWith('@')) continue;
    const selections = splitTop(rule.prelude, ',').map((s) => selectionOf(s, parts));
    for (const declaration of splitTop(rule.body, ';')) {
      const colon = declaration.indexOf(':');
      const cssProperty = declaration.slice(0, Math.max(colon, 0)).trim();
      if (!/^-{0,2}[a-z][a-z-]*$/.test(cssProperty)) continue;
      const value = declaration.slice(colon + 1);
      const important = /!\s*important\s*$/i.test(value);
      const tokens = [...new Set(Array.from(value.matchAll(/token\(([\w.-]+)\)/g), (m) => m[1]!))];
      for (const selection of selections) {
        const notRead = context ? selection.unread : [...selection.matches, ...selection.unread];
        for (const part of notRead) unread.add(`${part ?? ''}|${cssProperty}`);
        if (!context) continue;
        const when =
          [selection.when === 'default' ? '' : selection.when, ...context.conditions]
            .filter(Boolean)
            .join(' ') || 'default';
        const rank = precedence(important, context.layer, selection.specificity);
        for (const part of selection.matches) {
          const key = `${part ?? ''}|${when}|${cssProperty}`;
          const current = winners.get(key);
          if (!current || rank >= current.rank)
            winners.set(key, { ...(part ? { part } : {}), when, cssProperty, rank, tokens });
        }
      }
    }
  }
  return [...winners.values()]
    .filter((w) => !unread.has(`${w.part ?? ''}|${w.cssProperty}`))
    .flatMap(({ part, when, cssProperty, tokens }) =>
      tokens.map((token) => ({
        when,
        ...(part ? { part } : {}),
        cssProperty,
        token,
        provenance: 'extracted' as const,
      })),
    );
}
