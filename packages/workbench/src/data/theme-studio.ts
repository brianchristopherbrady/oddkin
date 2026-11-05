/**
 * Theme Studio's page data (workbench.md §6): the baseline theme configuration, the generation
 * worker, and the specimen roles, each mapped to a documented component through an example that
 * claims the role (`previewRoles`) or through `themeStudio.preview.roles`; never by tag name alone.
 */
import type { ResolvedWorkbenchConfig } from '../config/index.js';
import type { DiagnosticList } from '../internal/diagnostics.js';
import { presets, registrationOf } from '../panels/model.js';
import { STARTERS } from './starters.js';
import {
  DATA_VERSION,
  PAGE_FORMAT,
  type ComponentPageData,
  type JsonObject,
  type SpecimenRole,
  type ThemeStudioPageData,
  type ThemeStudioScreens,
} from './types.js';

/** The default `theme-specimen` recipe's roles, in display order, with their captions. */
export const SPECIMEN_ROLES: Readonly<Record<string, string>> = {
  surface: 'Surface',
  heading: 'Heading',
  bodyText: 'Body text',
  link: 'Link',
  badge: 'Badge',
  textInput: 'Text input',
  checkbox: 'Checkbox',
  switch: 'Switch',
  primaryAction: 'Primary action',
  secondaryAction: 'Secondary action',
  navigation: 'Navigation',
};

/** What dev tooling loaded for Theme Studio. */
export interface ThemeStudioInput {
  /** The baseline configuration's JSON model (`loadConfig`). */
  readonly config?: JsonObject;
  /** Where it came from, as written in the Workbench configuration. */
  readonly source?: string;
  /** URL of the generation worker module. */
  readonly worker?: string;
  /** The dev server writes the theme file (workbench.md §9). */
  readonly save?: ThemeStudioPageData['studio']['save'];
  /** What a theme file the dev server cannot write needs instead. */
  readonly unsaveable?: string;
  /** Several themes, or a theme file on a base: their files, root base first (P1.1 `extends`). */
  readonly files?: ThemeStudioPageData['studio']['files'];
  /** With `files`: the configured themes. */
  readonly themes?: ThemeStudioPageData['studio']['themes'];
  /** The dev server opens a team's own app with the draft (`themeStudio.app`). */
  readonly app?: string;
}

const roleId = (value: string) => value.replace(/^role:/, '');

/** What the screens need beyond the component pages. */
export interface ScreensInput {
  /** Page id → navigation title. */
  readonly titles: ReadonlyMap<string, string>;
  /**
   * The composition renderer, the documented packages whose elements a document may use, and the
   * catalog entries generated for packages without a renderer of their own.
   */
  readonly composition?: {
    readonly renderer: string;
    readonly packages: readonly string[];
    readonly catalog?: JsonObject;
  };
}

/** Each component's examples with published values, and the composition starters. */
function screensOf(components: readonly ComponentPageData[], input: ScreensInput) {
  const screens: ThemeStudioScreens['components'][number][] = [];
  const registrations: Record<string, string> = {};
  for (const page of components) {
    const registration = registrationOf(page);
    if (!registration) continue;
    if (input.composition?.packages.includes(page.package)) registrations[page.tag] = registration;
    const items: ThemeStudioScreens['components'][number]['items'][number][] = [];
    const omitted: string[] = [];
    const usable = presets(page).filter((example) => !example.incorrect);
    // When every example needs its setup code, a screen shows their values without it.
    const withoutSetup = !usable.some((example) => example.state && !example.fixture);
    for (const example of usable) {
      if (!example.state || (example.fixture && !withoutSetup)) omitted.push(example.label);
      else
        items.push({
          role: example.name,
          label: example.fixture ? `${example.label} (without its setup code)` : example.label,
          tag: page.tag,
          registration,
          example: example.id as SpecimenRole['example'],
          properties: example.state.properties,
          attributes: example.state.attributes,
          slots: example.state.slots,
        });
    }
    if (items.length)
      screens.push({ tag: page.tag, title: input.titles.get(page.id) ?? page.tag, items, omitted });
  }
  const composition = input.composition;
  return {
    components: screens.sort((a, b) => a.title.localeCompare(b.title)),
    ...(composition
      ? {
          composition: {
            renderer: composition.renderer,
            registrations,
            ...(composition.catalog ? { catalog: composition.catalog } : {}),
            // The layout primitives Oddkin's native containers take (data-composition.md §8).
            ...(composition.renderer === '@oddkin/components/composition'
              ? { stylesheets: ['@oddkin/components/css/layout.css'] }
              : {}),
            // Written against @oddkin/components' catalog.
            starters:
              composition.renderer === '@oddkin/components/composition' &&
              composition.packages.includes('@oddkin/components')
                ? STARTERS
                : [],
          },
        }
      : {}),
  };
}

export function themeStudioPage(
  id: string,
  components: readonly ComponentPageData[],
  config: ResolvedWorkbenchConfig,
  input: ThemeStudioInput,
  out: DiagnosticList,
  screens: ScreensInput = { titles: new Map() },
): ThemeStudioPageData {
  const role = (
    name: string,
    page: ComponentPageData,
    exampleName: string | undefined,
    source: SpecimenRole['source'],
  ): SpecimenRole | undefined => {
    const entry = registrationOf(page);
    const all = presets(page);
    const example = exampleName
      ? all.find((p) => p.name === exampleName)
      : (all.find((p) => p.name === 'default') ?? all.find((p) => p.state && !p.incorrect));
    if (!entry || !example?.state) return undefined;
    return {
      role: name,
      label: SPECIMEN_ROLES[name] ?? name,
      tag: page.tag,
      registration: entry,
      example: example.id as SpecimenRole['example'],
      properties: example.state.properties,
      attributes: example.state.attributes,
      slots: example.state.slots,
      source,
    };
  };

  // Roles claimed by examples; a role claimed by two components stays unmapped.
  const claims = new Map<string, { page: ComponentPageData; example: string }[]>();
  for (const page of components)
    for (const example of page.examples) {
      const roles = example['previewRoles'];
      const name = example['name'];
      if (!Array.isArray(roles) || typeof name !== 'string') continue;
      for (const r of roles)
        if (typeof r === 'string')
          claims.set(roleId(r), [...(claims.get(roleId(r)) ?? []), { page, example: name }]);
    }

  const missing: { item: string; supply: string }[] = [];
  const byTag = new Map(components.map((page) => [page.tag, page]));
  const mapped = new Map<string, SpecimenRole>();
  for (const [name, target] of Object.entries(config.themeStudio.preview.roles ?? {})) {
    const tag = typeof target === 'string' ? target : target.component;
    const page = byTag.get(tag);
    const resolved =
      page && role(name, page, typeof target === 'string' ? undefined : target.example, 'config');
    if (resolved) mapped.set(name, resolved);
    else
      out.warn(
        'data.themeStudio.role',
        `themeStudio.preview.roles.${name}: <${tag}> is not a documented component with a registration entry and that example.`,
        `/themeStudio/preview/roles/${name}`,
      );
  }
  for (const [name, claimants] of claims) {
    if (mapped.has(name)) continue;
    const tags = [...new Set(claimants.map((c) => c.page.tag))];
    const only = claimants[0];
    if (tags.length === 1 && claimants.length === 1 && only) {
      const resolved = role(name, only.page, only.example, 'example');
      if (resolved) mapped.set(name, resolved);
    } else
      missing.push({
        item: `role:${name}`,
        supply: `themeStudio.preview.roles.${name} (claimed by ${claimants.map((c) => `${c.page.tag}/${c.example}`).join(', ')})`,
      });
  }
  const order = Object.keys(SPECIMEN_ROLES);
  const rank = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
  const roles = [...mapped.values()].sort(
    (a, b) => rank(a.role) - rank(b.role) || a.role.localeCompare(b.role),
  );
  for (const name of order)
    if (!mapped.has(name) && !claims.has(name))
      missing.push({
        item: `role:${name}`,
        supply: `an example with previewRoles: ['${name}'], or themeStudio.preview.roles.${name}`,
      });
  if (!input.config)
    missing.unshift({
      item: 'config',
      supply: 'themeStudio.themeConfig or themeStudio.themes (theme configuration files)',
    });
  if (!input.worker)
    missing.unshift({
      item: 'generator',
      supply: 'a documented package that depends on @oddkin/tokens (its ./generate export)',
    });
  if (input.unsaveable) missing.push({ item: 'save', supply: input.unsaveable });

  return {
    format: PAGE_FORMAT,
    version: DATA_VERSION,
    id,
    kind: 'tool',
    studio: {
      ...(input.config ? { config: input.config } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.files ? { files: input.files } : {}),
      ...(input.themes ? { themes: input.themes } : {}),
      ...(input.worker ? { worker: input.worker } : {}),
      ...(input.save ? { save: input.save } : {}),
      ...(input.app ? { app: input.app } : {}),
      roles,
      screens: screensOf(components, screens),
      missing,
    },
  };
}
