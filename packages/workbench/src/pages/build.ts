/**
 * Build the page registry from standard CEM, optional Oddkin enrichment, authored content, and
 * configuration. Pure and deterministic; no build time enters the output.
 */
import {
  resolveWorkbenchConfig,
  type DocsContent,
  type PageContent,
  type ResolvedWorkbenchConfig,
  type WorkbenchConfig,
} from '../config/index.js';
import { DiagnosticList, type WorkbenchDiagnostic } from '../internal/diagnostics.js';
import { FOUNDATIONS, humanize, sectionTitle } from './defaults.js';
import {
  PAGE_REGISTRY_SCHEMA,
  type Availability,
  type CemDeclaration,
  type CemPackage,
  type OddkinMetadataLike,
  type PageEntry,
  type PageKind,
  type PageRegistry,
  type SectionEntry,
} from './types.js';

export interface RegistryInput {
  readonly config: WorkbenchConfig | ResolvedWorkbenchConfig;
  /** Standard Custom Elements Manifest(s). Enough for the Components baseline. */
  readonly cem?: CemPackage | readonly CemPackage[];
  /** `oddkin.metadata.json` enrichment (foundations, categories, examples, products, docs). */
  readonly metadata?: OddkinMetadataLike;
  /** Authored content (`oddkin.docs.ts` / Markdown front matter). */
  readonly docs?: DocsContent;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Draft {
  id: string;
  route: string;
  section: string;
  kind: PageKind;
  eyebrow?: string;
  title: string;
  summary?: string;
  group?: string;
  groupOrder?: number;
  tags?: readonly string[];
  updated?: string;
  order?: number;
  available: Availability;
  nav: { primary?: boolean; sidebar?: boolean; card?: boolean; search?: boolean };
  sections: SectionEntry[];
  legacyRoutes?: string[];
  /** Hidden by data or configuration regardless of authored content. */
  hidden?: boolean;
}

function resolveConfig(
  config: WorkbenchConfig | ResolvedWorkbenchConfig,
  out: DiagnosticList,
): ResolvedWorkbenchConfig | undefined {
  const { config: resolved, diagnostics } = resolveWorkbenchConfig(config);
  out.items.push(...diagnostics);
  return resolved;
}

function customElements(
  cem: RegistryInput['cem'],
): { declaration: CemDeclaration; module: string }[] {
  const packages = cem === undefined ? [] : Array.isArray(cem) ? cem : [cem as CemPackage];
  const found = new Map<string, { declaration: CemDeclaration; module: string }>();
  for (const pkg of packages as readonly CemPackage[]) {
    for (const module of pkg.modules) {
      for (const declaration of module.declarations ?? []) {
        if (declaration.customElement && declaration.tagName && !found.has(declaration.tagName)) {
          found.set(declaration.tagName, { declaration, module: module.path });
        }
      }
    }
  }
  return [...found.values()];
}

const firstSentence = (text: string | undefined) => {
  if (!text) return undefined;
  const flat = text.replace(/\s+/g, ' ').trim();
  const end = flat.search(/[.!?](\s|$)/);
  return end === -1 ? flat : flat.slice(0, end + 1);
};

/** Build the registry. `registry` is undefined only when the configuration is invalid. */
export function buildPageRegistry(input: RegistryInput): {
  registry: PageRegistry | undefined;
  diagnostics: WorkbenchDiagnostic[];
} {
  const out = new DiagnosticList();
  const config = resolveConfig(input.config, out);
  if (!config) return { registry: undefined, diagnostics: out.items };
  const metadata = input.metadata ?? {};
  const drafts: Draft[] = [];

  // Home (optional).
  if (config.navigation.home) {
    drafts.push({
      id: 'home',
      route: '/',
      section: 'home',
      kind: 'home',
      title: config.branding.name ?? 'Overview',
      available: 'full',
      nav: { search: true },
      sections: [],
    });
  }

  // Foundations: only those the enrichment declares, with sections from data.
  const foundationDrafts: Draft[] = [];
  FOUNDATIONS.forEach(({ id, slug, title }, index) => {
    const meta = metadata.foundations?.[`foundation:${id}`];
    if (!meta) return;
    const sections = meta.sections.map((s): SectionEntry => ({
      id: s.id,
      title: sectionTitle(s.id),
      visible: s.available,
      source: 'generated',
    }));
    const visibleCount = sections.filter((s) => s.visible).length;
    foundationDrafts.push({
      id: `foundations/${slug}`,
      route: `/foundations/${slug}`,
      section: 'foundations',
      kind: 'foundation',
      eyebrow: 'Foundations',
      title,
      order: index,
      available:
        visibleCount === 0 ? 'unavailable' : visibleCount === sections.length ? 'full' : 'partial',
      nav: { sidebar: true, card: true, search: true },
      sections,
      ...(visibleCount === 0 ? { hidden: true } : {}),
    });
  });
  for (const key of Object.keys(metadata.foundations ?? {})) {
    if (!FOUNDATIONS.some((f) => `foundation:${f.id}` === key)) {
      out.warn(
        'pages.foundation.unknown',
        `Enrichment declares unknown foundation "${key}".`,
        `/foundations/${key}`,
      );
    }
  }
  const anyFoundation = foundationDrafts.some((d) => !d.hidden);
  drafts.push({
    id: 'foundations',
    route: '/foundations',
    section: 'foundations',
    kind: 'overview',
    title: 'Foundations',
    // With no foundation data the destination stays, explaining what to supply (§11).
    available: anyFoundation ? 'full' : 'unavailable',
    nav: { search: true },
    sections: [],
  });
  drafts.push(...foundationDrafts);

  // Components.
  const categoryLabels = new Map<string, { label: string; order: number }>();
  config.categories.definitions.forEach((d, i) =>
    categoryLabels.set(d.id, { label: d.label, order: d.order ?? i }),
  );
  Object.entries(metadata.categories ?? {}).forEach(([key, c], i) => {
    const id = key.replace(/^category:/, '');
    if (!categoryLabels.has(id))
      categoryLabels.set(id, { label: c.label, order: c.order ?? 1000 + i });
  });
  const enrichedByTag = new Map(
    Object.values(metadata.components ?? {}).map((c) => [c.tag, c] as const),
  );
  const rawPrefix = metadata.library?.prefix;
  const prefix = rawPrefix ? (rawPrefix.endsWith('-') ? rawPrefix : `${rawPrefix}-`) : undefined;
  const elements = customElements(input.cem);
  const componentDrafts = elements.map(({ declaration }): Draft => {
    const tag = declaration.tagName as string;
    const enriched = enrichedByTag.get(tag);
    const categoryId =
      config.categories.assign[tag] ?? enriched?.category?.replace(/^category:/, '');
    const category = categoryId ? categoryLabels.get(categoryId) : undefined;
    if (categoryId && !category) {
      out.warn(
        'pages.category.unknown',
        `<${tag}> is assigned to unknown category "${categoryId}".`,
        `/components/${tag}`,
      );
    }
    const group = category?.label ?? config.categories.fallback;
    const section = (
      id: string,
      visible: boolean,
      source: SectionEntry['source'] = 'generated',
    ): SectionEntry => ({
      id,
      title: sectionTitle(id),
      visible,
      source,
    });
    const summary = firstSentence(declaration.summary ?? declaration.description);
    return {
      id: `components/${tag}`,
      route: `/components/${tag}`,
      section: 'components',
      kind: 'component',
      eyebrow: `Components · ${group}`,
      title:
        prefix && tag.startsWith(prefix)
          ? humanize(tag.slice(prefix.length))
          : humanize(declaration.name),
      ...(summary ? { summary } : {}),
      group,
      groupOrder: category?.order ?? Number.MAX_SAFE_INTEGER,
      // Full Oddkin support needs enrichment; standard CEM alone is the documented baseline.
      available: enriched ? 'full' : 'partial',
      nav: { sidebar: true, card: true, search: true },
      sections: [
        section('overview', true, 'built-in'),
        // Every section is shown; the panel labels what the library does not supply (§7.1).
        section('interactive-example', true),
        section('api', true),
        section('examples', true),
        section('tokens', true),
        section('behavior-and-accessibility', true),
        section('guidance', true),
        section('source', true),
        section('known-limitations', true),
      ],
    };
  });
  componentDrafts.sort(
    (a, b) =>
      (a.groupOrder as number) - (b.groupOrder as number) ||
      (a.group as string).localeCompare(b.group as string) ||
      a.title.localeCompare(b.title),
  );
  for (const tag of enrichedByTag.keys()) {
    if (!elements.some((e) => e.declaration.tagName === tag)) {
      out.warn(
        'pages.component.noCem',
        `Enrichment describes <${tag}>, which is not in the CEM input.`,
        `/components/component:${tag}`,
      );
    }
  }
  drafts.push({
    id: 'components',
    route: '/components',
    section: 'components',
    kind: 'overview',
    title: 'Components',
    available: componentDrafts.length ? 'full' : 'unavailable',
    nav: { search: true },
    sections: [],
    ...(config.navigation.legacyRedirects ? { legacyRoutes: ['/playground'] } : {}),
  });
  drafts.push(...componentDrafts);

  // Theme Studio: a primary destination, never a Foundations card or sidebar entry.
  const studioRoute = config.themeStudio.route;
  drafts.push({
    id: 'theme-studio',
    route: studioRoute,
    section: 'theme-studio',
    kind: 'tool',
    title: 'Theme Studio',
    // Without a theme config or token data, only declared CSS custom properties can be edited.
    available: config.themeStudio.themeConfig || metadata.tokens ? 'full' : 'partial',
    nav: { card: false, sidebar: false, search: true },
    sections: [],
    ...(config.navigation.legacyRedirects && studioRoute !== '/foundations/theme-studio'
      ? { legacyRoutes: ['/foundations/theme-studio'] }
      : {}),
    ...(config.themeStudio.enabled ? {} : { hidden: true }),
  });

  // Products and modes: absent unless enabled (§9).
  if (config.products.enabled) {
    const inFoundations = config.products.placement.includes('foundations');
    const inPrimary = config.products.placement.includes('primary');
    const route = inPrimary ? '/products' : '/foundations/products';
    const count = metadata.products
      ? Object.keys(metadata.products).length
      : config.products.sources.length;
    if (count === 0) {
      out.warn(
        'pages.products.empty',
        'Products and modes is enabled but no product sources resolved; the page is hidden.',
        '/products',
      );
    }
    drafts.push({
      id: 'products',
      route,
      section: inFoundations ? 'foundations' : 'products',
      kind: 'products',
      ...(inFoundations ? { eyebrow: 'Foundations' } : {}),
      title: 'Products and modes',
      order: FOUNDATIONS.length,
      available: count ? 'full' : 'unavailable',
      nav: { sidebar: inFoundations, card: inFoundations, search: true },
      sections: [],
      ...(config.navigation.legacyRedirects && route !== '/foundations/products'
        ? { legacyRoutes: ['/foundations/products'] }
        : {}),
      ...(count ? {} : { hidden: true }),
    });
  }

  applyContent(drafts, metadata, input.docs, out);

  // Primary navigation: configured sections that have a visible page.
  const visibleIds = new Set(drafts.filter((d) => !d.hidden).map((d) => d.id));
  const primary: string[] = [];
  if (config.navigation.home && !config.navigation.primary.includes('home')) primary.push('home');
  for (const section of config.navigation.primary) {
    if (visibleIds.has(section) && !primary.includes(section)) primary.push(section);
  }
  if (
    config.products.placement.includes('primary') &&
    visibleIds.has('products') &&
    !primary.includes('products')
  ) {
    primary.push('products');
  }

  const pages = drafts.map((d): PageEntry => {
    const visible = !d.hidden;
    const nav = visible
      ? { ...d.nav, ...(primary.includes(d.id) ? { primary: true } : {}) }
      : { primary: false, sidebar: false, card: false, search: false };
    return {
      id: d.id,
      route: d.route,
      section: d.section,
      kind: d.kind,
      ...(d.eyebrow ? { eyebrow: d.eyebrow } : {}),
      title: d.title,
      ...(d.summary ? { summary: d.summary } : {}),
      ...(d.group ? { group: d.group } : {}),
      ...(d.tags?.length ? { tags: d.tags } : {}),
      ...(d.updated ? { updated: d.updated } : {}),
      ...(d.order === undefined ? {} : { order: d.order }),
      visible,
      availability: d.available,
      nav,
      sections: d.sections,
      ...(d.legacyRoutes?.length ? { legacyRoutes: d.legacyRoutes } : {}),
    };
  });
  return {
    registry: {
      schema: PAGE_REGISTRY_SCHEMA,
      basePath: config.hosting.basePath,
      routing: config.hosting.routing,
      primaryNav: primary,
      pages,
    },
    diagnostics: out.items,
  };
}

/** Layer 3 (authored) and enrichment `docs` facts over built-in and generated values (ADR 0024). */
function applyContent(
  drafts: Draft[],
  metadata: OddkinMetadataLike,
  docs: DocsContent | undefined,
  out: DiagnosticList,
): void {
  const byId = new Map(drafts.map((d) => [d.id, d] as const));

  for (const [id, meta] of Object.entries(metadata.docs ?? {})) {
    const draft = byId.get(id);
    if (!draft) {
      out.warn(
        'content.page.unknown',
        `Enrichment docs refer to unknown page "${id}".`,
        `/docs/${id}`,
      );
      continue;
    }
    if (meta.title?.value) draft.title = meta.title.value;
    if (meta.summary?.value) draft.summary = meta.summary.value;
    if (meta.tags?.length) draft.tags = meta.tags;
    if (meta.order !== undefined) draft.order = meta.order;
    if (meta.visible === false) draft.hidden = true;
    // Dates only from authored metadata or source history; unknown dates are omitted.
    if (meta.updated?.known !== false && typeof meta.updated?.value === 'string') {
      if (DATE.test(meta.updated.value)) draft.updated = meta.updated.value;
      else
        out.warn(
          'content.updated.invalid',
          `Updated date "${meta.updated.value}" is not YYYY-MM-DD; omitted.`,
          `/docs/${id}/updated`,
        );
    }
  }

  if (!docs) return;
  const aliases = docs.aliases ?? {};
  for (const [key, content] of Object.entries(docs.pages)) {
    const id = aliases[key] ?? key;
    const draft = byId.get(id);
    if (!draft) {
      out.warn(
        'content.page.unknown',
        `Authored content refers to unknown page "${key}".`,
        `/pages/${key}`,
      );
      continue;
    }
    applyPage(draft, content, key, out);
  }
}

function applyPage(draft: Draft, content: PageContent, key: string, out: DiagnosticList): void {
  if (content.title) draft.title = content.title;
  if (content.eyebrow) draft.eyebrow = content.eyebrow;
  if (content.summary) draft.summary = content.summary;
  if (content.tags) draft.tags = content.tags;
  if (content.order !== undefined) draft.order = content.order;
  if (content.updated !== undefined) {
    if (DATE.test(content.updated)) draft.updated = content.updated;
    else
      out.warn(
        'content.updated.invalid',
        `Updated date "${content.updated}" is not YYYY-MM-DD; omitted.`,
        `/pages/${key}/updated`,
      );
  }
  if (content.visible === false) draft.hidden = true;
  if (content.visible === true && draft.available === 'unavailable') {
    out.warn(
      'content.visible.unavailable',
      `"${draft.id}" has no data to show; authored visible: true is ignored.`,
      `/pages/${key}/visible`,
    );
  }
  for (const [sectionId, section] of Object.entries(content.sections ?? {})) {
    const index = draft.sections.findIndex((s) => s.id === sectionId);
    if (index === -1) {
      out.warn(
        'content.section.unknown',
        `Page "${draft.id}" has no section "${sectionId}".`,
        `/pages/${key}/sections/${sectionId}`,
      );
      continue;
    }
    const current = draft.sections[index] as SectionEntry;
    const authoredOnly = current.source === 'authored';
    draft.sections[index] = {
      ...current,
      ...(section.title ? { title: section.title } : {}),
      // Authored content can hide a section, show an authored-only section, but cannot show
      // a generated section whose data is missing.
      visible:
        section.visible === false
          ? false
          : authoredOnly
            ? Boolean(section.guidance || section.examples?.length || section.visible)
            : current.visible,
    };
  }
  if (content.sections) {
    const order = (id: string) => content.sections?.[id]?.order;
    const positioned = draft.sections.map((s, i) => ({ s, key: order(s.id) ?? i }));
    positioned.sort((a, b) => a.key - b.key);
    draft.sections = positioned.map((p) => p.s);
  }
}
