/**
 * Foundation facts from a published token inspection (`@oddkin/tokens` `*.inspect.json`): which
 * tokens make up spacing, colour roles, and borders and radii, and which tokens alias them. Facts
 * are read, never recomputed: values, origins, and provenance come from the inspection as written.
 * Contract: metadata-and-analyzer.md §3; workbench-pages.md §5.2–§5.3.
 */

/** One token as `emitInspectJson` writes it. */
export interface InspectedToken {
  readonly name: string;
  readonly cssVariable: string;
  readonly category: string;
  readonly type: string;
  readonly origin: string;
  readonly definition: unknown;
  readonly value: unknown;
  readonly provenance?: string;
}

/** A theme's token inspection (`<theme>.inspect.json`). */
export interface TokenInspection {
  readonly theme: string;
  readonly modes: readonly string[];
  readonly tokens: readonly InspectedToken[];
}

/** Where the inspection was read from, recorded on every foundation. */
export interface InspectionSource {
  /** Package publishing it, e.g. `@oddkin/tokens`. */
  readonly package: string;
  /** Its export, e.g. `./inspect/default.json`. */
  readonly export: string;
}

type Entry = { name: string; token: string; publicValue?: string };
type Vocabulary = { id: string; entries: Entry[] };
type Section = { id: string; available: boolean; reason?: string };

const ALIAS = /^\{([^}]+)\}$/;

/** The token another token aliases directly (`"{space.xs}"`), if any. */
function aliasOf(token: InspectedToken): string | undefined {
  return typeof token.definition === 'string' ? ALIAS.exec(token.definition)?.[1] : undefined;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

/** Tokens that alias one of `targets`, as vocabulary entries naming the step they use. */
function aliasesOf(
  tokens: readonly InspectedToken[],
  targets: ReadonlySet<string>,
  categories: readonly string[],
): Entry[] {
  return tokens
    .filter((t) => categories.includes(t.category) && targets.has(aliasOf(t) ?? ''))
    .map((t) => ({ name: t.name, token: aliasOf(t)! }))
    .sort(byName);
}

/** Semantic (and layout) roles, then component mappings, of the tokens aliasing `targets`. */
function vocabulariesOf(tokens: readonly InspectedToken[], targets: ReadonlySet<string>) {
  const semantic = aliasesOf(tokens, targets, ['semantic', 'layout']);
  const component = aliasesOf(tokens, targets, ['component']);
  const vocabularies: Vocabulary[] = [];
  if (semantic.length) vocabularies.push({ id: 'semantic', entries: semantic });
  if (component.length) vocabularies.push({ id: 'component-mappings', entries: component });
  return { semantic, component, vocabularies };
}

function section(id: string, count: number, reason: string): Section {
  return count ? { id, available: true } : { id, available: false, reason };
}

/** A value given per mode (`{ light, dark }`), keyed only by the theme's modes. */
function isModeMap(value: unknown, modes: readonly string[]): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => modes.includes(key));
}

/** Origins of a set of tokens, e.g. `preset` or `overridden`, for the generation fact. */
function origins(tokens: readonly InspectedToken[]): string[] {
  return [...new Set(tokens.map((t) => t.origin))].sort();
}

/**
 * `foundations` metadata (`foundation:spacing`, `foundation:color`, `foundation:borders-and-radii`)
 * for the tokens a theme's inspection declares. Foundations without tokens are omitted.
 */
export function foundationsFrom(
  inspection: TokenInspection,
  source: InspectionSource,
): Record<string, Record<string, unknown>> {
  const tokens = inspection.tokens;
  const scale = (prefix: string) =>
    tokens
      .filter((t) => t.name.startsWith(`${prefix}.`) && t.category === 'foundation' && !aliasOf(t))
      .sort(byName);
  const generation = (scaleTokens: readonly InspectedToken[]) => ({
    value: { theme: inspection.theme, origins: origins(scaleTokens), source },
    provenance: 'extracted',
  });
  const variations = ['mode'];
  const foundations: Record<string, Record<string, unknown>> = {};

  const space = scale('space');
  if (space.length) {
    const steps = new Set(space.map((t) => t.name));
    const { semantic, component, vocabularies } = vocabulariesOf(tokens, steps);
    foundations['foundation:spacing'] = {
      id: 'spacing',
      sections: [
        section('scale', space.length, 'no spacing scale tokens'),
        section(
          'semantic-vocabulary',
          semantic.length + component.length,
          'no tokens alias a spacing step',
        ),
      ],
      generation: generation(space),
      tokens: space.map((t) => t.name),
      vocabularies,
    };
  }

  const roles = tokens.filter((t) => t.name.startsWith('color.') && t.category === 'semantic');
  if (roles.length) {
    const modeVaried = roles.filter((t) => isModeMap(t.value, inspection.modes));
    foundations['foundation:color'] = {
      id: 'color',
      sections: [
        section('semantic-roles', roles.length, 'no semantic colour roles'),
        section(
          'palettes-and-ramps',
          tokens.filter((t) => t.name.startsWith('ref.')).length,
          'no reference palette tokens',
        ),
      ],
      generation: generation(roles),
      tokens: roles.map((t) => t.name).sort(),
      ...(modeVaried.length ? { variations } : {}),
    };
  }

  const radii = scale('radius');
  const widths = scale('border');
  if (radii.length || widths.length) {
    const targets = new Set([...radii, ...widths].map((t) => t.name));
    const { component: mappings, vocabularies } = vocabulariesOf(tokens, targets);
    foundations['foundation:borders-and-radii'] = {
      id: 'borders-and-radii',
      sections: [
        section('border-widths-and-styles', widths.length, 'no border width tokens'),
        section('radii', radii.length, 'no radius tokens'),
        section(
          'component-mappings',
          mappings.length,
          'no component tokens alias a radius or border width',
        ),
      ],
      generation: generation([...radii, ...widths]),
      tokens: [...widths, ...radii].map((t) => t.name),
      vocabularies,
    };
  }
  return foundations;
}
