/**
 * `llms.txt` for a documentation site (llmstxt.org; agent-tooling.md §5, Discovery): an index of
 * the kits of the packages the site documents, linked by absolute URL, for the site to serve
 * beside the kit files it links. Generated from the same packaged kits the packages ship, so the
 * site and an installed package say the same thing about a version.
 */
import type { Library } from './context.js';
import type { KitManifest } from './kit.js';

/** One package's kit as the site serves it: the kit, and the URL of its directory. */
export interface SiteKit {
  library: Library;
  manifest: KitManifest;
  /** Absolute URL of the directory the kit's files are served from, ending in `/`. */
  url: string;
}

const firstSentence = (text = ''): string => {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  const end = flat.search(/[.!?](\s|$)/);
  return end > -1 ? flat.slice(0, end + 1) : flat;
};

const LABELS: Record<string, string> = {
  choosing: 'Choosing components',
  composition: 'Interfaces as data (composition documents)',
};

/** The index: the site's title and summary, then each package's guide and component references. */
export function siteLlmsText({
  title,
  summary,
  kits,
}: {
  title: string;
  summary?: string;
  kits: SiteKit[];
}): string {
  const link = (kit: SiteKit, path: string) => new URL(path, kit.url).href;
  const sections = kits.flatMap((kit) => {
    const { library, manifest } = kit;
    const declarations = new Map<string, any>(
      (library.cem?.['modules'] ?? [])
        .flatMap((m: any) => m.declarations ?? [])
        .filter((d: any) => d.tagName)
        .map((d: any) => [d.tagName, d]),
    );
    const guides = manifest.entries.filter(
      (e) => e.kind === 'choosing' || e.kind === 'composition',
    );
    const components = manifest.entries.filter((e) => e.kind === 'component');
    const description: string = library.manifest['description'] ?? '';
    return [
      `## ${library.name} ${library.version}`,
      '',
      ...(description ? [description, ''] : []),
      `- [${library.name} guide](${link(kit, 'GUIDE.md')}): install, register, the components by category, and the rules`,
      ...guides.map((e) => `- [${LABELS[e.kind] ?? e.id}](${link(kit, e.path)})`),
      ...components.map((e) => {
        const tag = e.id.replace(/^component:/, '');
        const summaryText = firstSentence(declarations.get(tag)?.description);
        return `- [${tag}](${link(kit, e.path)})${summaryText ? `: ${summaryText}` : ''}`;
      }),
      '',
    ];
  });
  const optional = kits.flatMap((kit) => [
    ...kit.manifest.entries
      .filter((e) => ['tokens', 'recipe', 'stylesheet', 'model'].includes(e.kind))
      .map((e) => {
        const [kind = e.kind, ...name] = e.id.split(':');
        return `- [${kit.library.name}: ${kind} ${name.join(':')}](${link(kit, e.path)})`;
      }),
    `- [${kit.library.name} kit.json](${link(kit, 'kit.json')}): the fingerprint of the metadata the kit was generated from`,
  ]);
  return [
    `# ${title}`,
    '',
    ...(summary ? [`> ${summary}`, ''] : []),
    "Agent kits generated from each package's published metadata, for the versions this site documents. Read a package's guide first; it links one reference per component. The same kit ships in the package, in `node_modules/<package>/agent/`.",
    '',
    ...sections,
    '## Optional',
    '',
    ...optional,
    '',
  ].join('\n');
}
