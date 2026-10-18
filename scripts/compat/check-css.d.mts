export interface Feature {
  id: string;
  syntax: string;
  kind: 'css' | 'api' | 'html';
  bcd: string[];
  webFeature?: string;
  adoption: 'foundation' | 'enhancement' | 'experimental' | 'deferred' | 'declined';
  status: 'implemented' | 'planned' | 'evaluated';
  milestone?: string;
  usedBy?: string[];
  baseline: string;
  enhanced?: string;
  gate?: string;
  detectCss?: string;
  detectApi?: string;
  differences?: string;
  floorExceptions?: Record<string, string>;
  tests?: Array<{ file: string; name: string }>;
  decision?: string;
  useCase?: string;
  notes?: string;
}

export interface Registry {
  checked: string;
  data: Record<string, string>;
  floor: Record<string, string>;
  features: Feature[];
}

export interface TokenSyntax {
  syntax: string;
  bcd: string;
  unsupported: readonly string[];
}

export function loadRegistry(): Registry;
export function checkRegistry(
  registry: Registry,
  options?: { tokensFloor?: Record<string, string> },
): string[];
export function checkTokenSyntax(
  entries: readonly TokenSyntax[],
  floor: Record<string, string>,
): string[];
export function lintCss(
  text: string,
  options: { file: string; registry: Registry },
): { problems: string[]; uses: Map<string, number> };
export function run(options?: {
  write?: boolean;
}): Promise<{ problems: string[]; sources: number; keys: number; features: number }>;
