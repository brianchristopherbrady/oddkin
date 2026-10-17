/**
 * Built-in titles for pages and sections (workbench-pages.md §4–§8). Generic structure only:
 * no library facts. Moves to the localizable `./content` catalog with the shell (M5).
 */

/** Foundation ids (mote-metadata v1) → page slug and title, in default order. */
export const FOUNDATIONS: readonly { id: string; slug: string; title: string }[] = [
  { id: 'tokens', slug: 'token-architecture', title: 'Token architecture' },
  { id: 'color', slug: 'color', title: 'Color' },
  { id: 'typography', slug: 'typography', title: 'Typography' },
  { id: 'spacing', slug: 'spacing', title: 'Spacing' },
  { id: 'borders-and-radii', slug: 'borders-and-radii', title: 'Borders and radii' },
  { id: 'elevation', slug: 'elevation', title: 'Elevation' },
  { id: 'motion', slug: 'motion', title: 'Motion' },
  { id: 'themes', slug: 'themes', title: 'Themes' },
  { id: 'responsive', slug: 'responsive-behavior', title: 'Responsive behavior' },
];

export const SECTION_TITLES: Readonly<Record<string, string>> = {
  // Foundations
  'tiers-and-naming': 'Tiers and naming',
  pipeline: 'Source-to-output pipeline',
  'trace-a-token': 'Trace a token',
  consumption: 'Consumption',
  'aliases-and-overrides': 'Aliases and overrides',
  'dependency-policy': 'Dependency policy and direct reads',
  'every-token': 'Every token',
  palettes: 'Palettes and ramps',
  'semantic-roles': 'Semantic roles',
  'interactive-states': 'Interactive states',
  'product-variations': 'Product variations',
  'contrast-pairs': 'Contrast pairs',
  families: 'Families',
  scale: 'Scale',
  'composite-styles': 'Composite styles',
  specimens: 'Specimens',
  vocabulary: 'Semantic vocabulary',
  precedence: 'Precedence and layout behavior',
  'border-widths': 'Border widths and styles',
  'border-colors': 'Border colour roles',
  radii: 'Radii',
  'component-mappings': 'Component mappings',
  samples: 'Samples',
  levels: 'Levels',
  'theme-variations': 'Theme variations',
  'durations-and-easing': 'Durations and easing',
  roles: 'Roles',
  'try-a-duration': 'Try a duration',
  'reduced-motion': 'Reduced motion',
  'themes-and-modes': 'Available themes and modes',
  'scope-contract': 'Scope contract',
  composition: 'Composition and precedence',
  comparisons: 'Comparisons',
  usage: 'Usage snippets',
  'which-query': 'Which query to use',
  conditions: 'Conditions and thresholds',
  profiles: 'Profiles',
  'responsive-roles': 'Responsive roles',
  recipes: 'Recipes',
  'resize-a-container': 'Resize a container',
  reflow: 'Reflow and overflow',
  source: 'Source',
  // Components
  overview: 'Overview',
  'interactive-example': 'Interactive example',
  api: 'API',
  examples: 'Examples',
  tokens: 'Tokens',
  'behavior-and-accessibility': 'Behavior and accessibility',
  guidance: 'Guidance',
  'known-limitations': 'Known limitations',
};

/** `contrast-pairs` → `Contrast pairs` for ids without a built-in title. */
export function sectionTitle(id: string): string {
  const known = SECTION_TITLES[id];
  if (known) return known;
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `DemoCounter` → `Demo counter`; `side-nav` → `Side nav`. */
export function humanize(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
