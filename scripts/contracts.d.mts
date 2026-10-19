export declare const SOURCE: string;
export declare const TARGETS: { readonly markdown: string; readonly index: string };
export declare function generateContracts(
  source: string,
  scope?: string,
): { markdown: string; index: string; ids: string[]; problems: string[] };
